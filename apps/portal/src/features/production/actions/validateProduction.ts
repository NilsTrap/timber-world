"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate Production Entry
 *
 * Atomic operation that:
 * 1. Verifies preconditions (auth, ownership, draft status, has inputs/outputs)
 * 2. Computes final metrics (input m³, output m³, outcome %, waste %)
 * 3. Deducts from input inventory packages (partial or full consumption)
 * 4. Creates new inventory packages from outputs
 * 5. Updates the production entry status + stores metrics
 */
export async function validateProduction(
  productionEntryId: string
): Promise<ActionResult<{ redirectUrl: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isProducer(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!productionEntryId || !UUID_REGEX.test(productionEntryId)) {
    return { success: false, error: "Invalid production entry ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // 1. Fetch entry and verify ownership (include process info for package numbering)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, status, created_by, organisation_id, ref_processes!inner(code, value)")
    .eq("id", productionEntryId)
    .single();

  if (entryError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  if (entry.created_by !== session.id) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (entry.status !== "draft") {
    return { success: false, error: "Entry is already validated", code: "VALIDATION_FAILED" };
  }

  const organisationId = entry.organisation_id;
  const processCode = entry.ref_processes?.code;
  const processName = entry.ref_processes?.value;

  // Atomic lock: transition draft → validating (prevents race condition with concurrent requests)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lockResult, error: lockError } = await (supabase as any)
    .from("portal_production_entries")
    .update({ status: "validating" })
    .eq("id", productionEntryId)
    .eq("status", "draft")
    .select("id")
    .single();

  if (lockError || !lockResult) {
    return { success: false, error: "Entry is already being validated", code: "VALIDATION_FAILED" };
  }

  // Helper to revert status on failure
  const revertStatus = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("portal_production_entries")
      .update({ status: "draft" })
      .eq("id", productionEntryId)
      .eq("status", "validating");
  };

  // 2. Fetch all inputs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inputs, error: inputsError } = await (supabase as any)
    .from("portal_production_inputs")
    .select("id, package_id, pieces_used, volume_m3")
    .eq("production_entry_id", productionEntryId);

  if (inputsError) {
    await revertStatus();
    return { success: false, error: "Failed to fetch inputs", code: "QUERY_FAILED" };
  }

  if (!inputs || inputs.length === 0) {
    await revertStatus();
    return { success: false, error: "At least one input is required", code: "VALIDATION_FAILED" };
  }

  // 3. Fetch all outputs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outputs, error: outputsError } = await (supabase as any)
    .from("portal_production_outputs")
    .select("id, package_number, product_name_id, wood_species_id, humidity_id, type_id, processing_id, fsc_id, quality_id, thickness, width, length, pieces, volume_m3")
    .eq("production_entry_id", productionEntryId);

  if (outputsError) {
    await revertStatus();
    return { success: false, error: "Failed to fetch outputs", code: "QUERY_FAILED" };
  }

  if (!outputs || outputs.length === 0) {
    await revertStatus();
    return { success: false, error: "At least one output is required", code: "VALIDATION_FAILED" };
  }

  // Check all outputs have volume > 0
  const invalidOutput = outputs.find((o: { volume_m3: number }) => !o.volume_m3 || Number(o.volume_m3) <= 0);
  if (invalidOutput) {
    await revertStatus();
    return { success: false, error: "All outputs must have volume > 0", code: "VALIDATION_FAILED" };
  }

  // 4. Generate final package numbers for outputs
  // For "Sorting" process, inherit the process code from input packages
  const isSortingProcess = processName?.toLowerCase() === "sorting";
  let effectiveProcessCode = processCode;

  if (isSortingProcess && inputs.length > 0) {
    // Get the first input package to extract its process code
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inputPkg } = await (supabase as any)
      .from("inventory_packages")
      .select("package_number")
      .eq("id", inputs[0].package_id)
      .single();

    if (inputPkg?.package_number) {
      const match = inputPkg.package_number.match(/^N-([A-Z]{2})-\d+$/);
      if (match) {
        effectiveProcessCode = match[1];
      }
    }
  }

  // Generate final package numbers using the counter
  const finalPackageNumbers: string[] = [];
  for (let i = 0; i < outputs.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pkgNumResult, error: pkgNumError } = await (supabase as any)
      .rpc("generate_production_package_number", {
        p_organisation_id: organisationId,
        p_process_code: effectiveProcessCode,
      });

    if (pkgNumError) {
      await revertStatus();
      return { success: false, error: `Failed to generate package number: ${pkgNumError.message}`, code: "PKG_NUM_FAILED" };
    }

    finalPackageNumbers.push(pkgNumResult as string);
  }

  // Update production outputs with final package numbers
  for (let i = 0; i < outputs.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateOutputError } = await (supabase as any)
      .from("portal_production_outputs")
      .update({ package_number: finalPackageNumbers[i] })
      .eq("id", outputs[i].id);

    if (updateOutputError) {
      await revertStatus();
      return { success: false, error: `Failed to update output package number: ${updateOutputError.message}`, code: "UPDATE_FAILED" };
    }
  }

  // 6. Pre-check: verify final package numbers won't conflict
  if (finalPackageNumbers.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from("inventory_packages")
      .select("package_number")
      .in("package_number", finalPackageNumbers);
    if (existing && existing.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conflicts = existing.map((e: any) => e.package_number).join(", ");
      await revertStatus();
      return { success: false, error: `Output package numbers already exist: ${conflicts}`, code: "VALIDATION_FAILED" };
    }
  }

  // 5. Compute totals
  const totalInputM3 = inputs.reduce((sum: number, i: { volume_m3: number }) => sum + Number(i.volume_m3), 0);
  const totalOutputM3 = outputs.reduce((sum: number, o: { volume_m3: number }) => sum + Number(o.volume_m3), 0);
  const outcomePercentage = totalInputM3 > 0 ? (totalOutputM3 / totalInputM3) * 100 : 0;
  const wastePercentage = 100 - outcomePercentage;

  // 6. Deduct from input inventory packages
  for (const input of inputs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pkg, error: pkgError } = await (supabase as any)
      .from("inventory_packages")
      .select("id, pieces, volume_m3")
      .eq("id", input.package_id)
      .single();

    if (pkgError || !pkg) {
      await revertStatus();
      return { success: false, error: `Input package not found: ${input.package_id}`, code: "NOT_FOUND" };
    }

    if (input.pieces_used && pkg.pieces) {
      const currentPieces = parseInt(pkg.pieces, 10);

      // Guard: reject if pieces_used exceeds currently available pieces
      if (!isNaN(currentPieces) && input.pieces_used > currentPieces) {
        await revertStatus();
        return {
          success: false,
          error: `Input uses ${input.pieces_used} pieces but package only has ${currentPieces} available`,
          code: "VALIDATION_FAILED",
        };
      }

      const remaining = currentPieces - input.pieces_used;

      if (remaining <= 0) {
        // Fully consumed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("inventory_packages")
          .update({ status: "consumed", pieces: "0", volume_m3: 0 })
          .eq("id", pkg.id);

        if (updateError) {
          await revertStatus();
          return { success: false, error: `Failed to update package: ${updateError.message}`, code: "UPDATE_FAILED" };
        }
      } else {
        // Partial consumption: reduce pieces and volume proportionally
        const ratio = remaining / currentPieces;
        const newVolume = Number(pkg.volume_m3) * ratio;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("inventory_packages")
          .update({ pieces: String(remaining), volume_m3: newVolume })
          .eq("id", pkg.id);

        if (updateError) {
          await revertStatus();
          return { success: false, error: `Failed to update package: ${updateError.message}`, code: "UPDATE_FAILED" };
        }
      }
    } else {
      // No countable pieces — use volume deduction
      const currentVolume = Number(pkg.volume_m3) || 0;
      const inputVolume = Number(input.volume_m3);

      // Guard: reject if volume exceeds currently available
      if (inputVolume > currentVolume) {
        await revertStatus();
        return {
          success: false,
          error: `Input uses ${inputVolume.toFixed(3)} m³ but package only has ${currentVolume.toFixed(3)} m³ available`,
          code: "VALIDATION_FAILED",
        };
      }

      const newVolume = Math.max(0, currentVolume - inputVolume);

      if (newVolume <= 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("inventory_packages")
          .update({ status: "consumed", volume_m3: 0 })
          .eq("id", pkg.id);

        if (updateError) {
          await revertStatus();
          return { success: false, error: `Failed to update package: ${updateError.message}`, code: "UPDATE_FAILED" };
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("inventory_packages")
          .update({ volume_m3: newVolume })
          .eq("id", pkg.id);

        if (updateError) {
          await revertStatus();
          return { success: false, error: `Failed to update package: ${updateError.message}`, code: "UPDATE_FAILED" };
        }
      }
    }
  }

  // 7. Create output inventory packages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outputPackages = outputs.map((output: any, index: number) => ({
    production_entry_id: productionEntryId,
    shipment_id: null,
    package_number: finalPackageNumbers[index],
    package_sequence: index + 1,
    product_name_id: output.product_name_id,
    wood_species_id: output.wood_species_id,
    humidity_id: output.humidity_id,
    type_id: output.type_id,
    processing_id: output.processing_id,
    fsc_id: output.fsc_id,
    quality_id: output.quality_id,
    thickness: output.thickness,
    width: output.width,
    length: output.length,
    pieces: output.pieces,
    volume_m3: output.volume_m3,
    volume_is_calculated: false,
    status: "produced",
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any)
    .from("inventory_packages")
    .insert(outputPackages);

  if (insertError) {
    await revertStatus();
    return { success: false, error: `Failed to create output packages: ${insertError.message}`, code: "INSERT_FAILED" };
  }

  // 8. Finalize: transition validating → validated with totals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateEntryError } = await (supabase as any)
    .from("portal_production_entries")
    .update({
      status: "validated",
      validated_at: new Date().toISOString(),
      total_input_m3: totalInputM3,
      total_output_m3: totalOutputM3,
      outcome_percentage: outcomePercentage,
      waste_percentage: wastePercentage,
    })
    .eq("id", productionEntryId)
    .eq("status", "validating");

  if (updateEntryError) {
    await revertStatus();
    return { success: false, error: `Failed to update entry: ${updateEntryError.message}`, code: "UPDATE_FAILED" };
  }

  return { success: true, data: { redirectUrl: "/production" } };
}
