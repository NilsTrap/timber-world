"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate Production Entry
 *
 * Atomic operation that:
 * 1. Verifies preconditions (auth, ownership, draft/validated status, has inputs/outputs)
 * 2. For re-validation (admin edit): restores old inventory state first
 * 3. Computes final metrics (input m³, output m³, outcome %, waste %)
 * 4. Deducts from input inventory packages (partial or full consumption)
 * 5. Creates new inventory packages from outputs
 * 6. Updates the production entry status + stores metrics
 *
 * Super admins can re-validate already validated entries to apply staged changes.
 */
export async function validateProduction(
  productionEntryId: string
): Promise<ActionResult<{ redirectUrl: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const isAdmin = isSuperAdmin(session);
  if (!isProducer(session) && !isAdmin) {
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

  // Admins can validate any entry; regular users only their own
  if (!isAdmin && entry.created_by !== session.id) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Regular users can only validate drafts; admins can re-validate already validated entries
  const isRevalidation = entry.status === "validated";
  if (entry.status !== "draft" && !(isAdmin && isRevalidation)) {
    return { success: false, error: "Entry is already validated", code: "VALIDATION_FAILED" };
  }

  const organisationId = entry.organisation_id;
  const processCode = entry.ref_processes?.code;
  const processName = entry.ref_processes?.value;

  // Atomic lock: transition to validating (prevents race condition with concurrent requests)
  const previousStatus = isRevalidation ? "validated" : "draft";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lockResult, error: lockError } = await (supabase as any)
    .from("portal_production_entries")
    .update({ status: "validating" })
    .eq("id", productionEntryId)
    .eq("status", previousStatus)
    .select("id")
    .single();

  if (lockError || !lockResult) {
    return { success: false, error: "Entry is already being validated", code: "VALIDATION_FAILED" };
  }

  // Track deductions for rollback
  const deductedPackages: Array<{
    packageId: string;
    piecesDeducted: number;
    volumeDeducted: number;
    wasConsumed: boolean;
    originalStatus: string;
  }> = [];

  // Track restoration for rollback (re-validation only)
  const restoredPackages: Array<{
    packageId: string;
    piecesRestored: number;
    volumeRestored: number;
    wasConsumed: boolean;
  }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deletedOutputPackages: any[] = [];

  // Helper to revert status and restore inventory on failure
  const revertChanges = async () => {
    console.log(`[validateProduction] Rolling back - deducted: ${deductedPackages.length}, restored: ${restoredPackages.length}, deleted outputs: ${deletedOutputPackages.length}`);

    try {
      // 1. Undo deductions (add back what was deducted)
      for (const pkg of deductedPackages) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentPkg, error: fetchError } = await (supabase as any)
          .from("inventory_packages")
          .select("pieces, volume_m3, status")
          .eq("id", pkg.packageId)
          .single();

        if (fetchError) {
          console.error(`[validateProduction] Failed to fetch package ${pkg.packageId} for rollback:`, fetchError);
          continue;
        }

        if (currentPkg) {
          const currentPieces = parseInt(currentPkg.pieces || "0", 10);
          const currentVolume = Number(currentPkg.volume_m3) || 0;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updateError } = await (supabase as any)
            .from("inventory_packages")
            .update({
              pieces: String(currentPieces + pkg.piecesDeducted),
              volume_m3: currentVolume + pkg.volumeDeducted,
              status: pkg.wasConsumed ? pkg.originalStatus : currentPkg.status,
            })
            .eq("id", pkg.packageId);

          if (updateError) {
            console.error(`[validateProduction] Failed to restore package ${pkg.packageId}:`, updateError);
          } else {
            console.log(`[validateProduction] Restored package ${pkg.packageId}: +${pkg.piecesDeducted} pieces, +${pkg.volumeDeducted} m³`);
          }
        }
      }

      // 2. Undo restoration (subtract what was restored) - for re-validation
      for (const pkg of restoredPackages) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentPkg, error: fetchError } = await (supabase as any)
          .from("inventory_packages")
          .select("pieces, volume_m3")
          .eq("id", pkg.packageId)
          .single();

        if (fetchError) {
          console.error(`[validateProduction] Failed to fetch package ${pkg.packageId} for un-restore:`, fetchError);
          continue;
        }

        if (currentPkg) {
          const currentPieces = parseInt(currentPkg.pieces || "0", 10);
          const currentVolume = Number(currentPkg.volume_m3) || 0;

          const newPieces = Math.max(0, currentPieces - pkg.piecesRestored);
          const newVolume = Math.max(0, currentVolume - pkg.volumeRestored);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updateError } = await (supabase as any)
            .from("inventory_packages")
            .update({
              pieces: String(newPieces),
              volume_m3: newVolume,
              status: pkg.wasConsumed ? "consumed" : undefined,
            })
            .eq("id", pkg.packageId);

          if (updateError) {
            console.error(`[validateProduction] Failed to un-restore package ${pkg.packageId}:`, updateError);
          }
        }
      }

      // 3. Recreate deleted output packages - for re-validation
      if (deletedOutputPackages.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from("inventory_packages")
          .insert(deletedOutputPackages);

        if (insertError) {
          console.error(`[validateProduction] Failed to recreate deleted outputs:`, insertError);
        }
      }

      // 4. Revert entry status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: statusError } = await (supabase as any)
        .from("portal_production_entries")
        .update({ status: previousStatus })
        .eq("id", productionEntryId)
        .eq("status", "validating");

      if (statusError) {
        console.error(`[validateProduction] Failed to revert entry status:`, statusError);
      }
    } catch (err) {
      console.error(`[validateProduction] Rollback failed with exception:`, err);
    }
  };

  // 2. Fetch all inputs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inputs, error: inputsError } = await (supabase as any)
    .from("portal_production_inputs")
    .select("id, package_id, pieces_used, volume_m3")
    .eq("production_entry_id", productionEntryId);

  if (inputsError) {
    await revertChanges();
    return { success: false, error: "Failed to fetch inputs", code: "QUERY_FAILED" };
  }

  if (!inputs || inputs.length === 0) {
    await revertChanges();
    return { success: false, error: "At least one input is required", code: "VALIDATION_FAILED" };
  }

  // 3. Fetch all outputs (ordered by package_number to preserve row sequence)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outputs, error: outputsError } = await (supabase as any)
    .from("portal_production_outputs")
    .select("id, package_number, product_name_id, wood_species_id, humidity_id, type_id, processing_id, fsc_id, quality_id, thickness, width, length, pieces, volume_m3")
    .eq("production_entry_id", productionEntryId)
    .order("package_number", { ascending: true });

  if (outputsError) {
    await revertChanges();
    return { success: false, error: "Failed to fetch outputs", code: "QUERY_FAILED" };
  }

  if (!outputs || outputs.length === 0) {
    await revertChanges();
    return { success: false, error: "At least one output is required", code: "VALIDATION_FAILED" };
  }

  // Validate all required fields are filled for each output
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i] as any;
    const rowNum = i + 1;

    // Check required reference fields
    if (!output.product_name_id) {
      await revertChanges();
      return { success: false, error: `Output row ${rowNum}: Product is required`, code: "VALIDATION_FAILED" };
    }
    if (!output.wood_species_id) {
      await revertChanges();
      return { success: false, error: `Output row ${rowNum}: Wood species is required`, code: "VALIDATION_FAILED" };
    }
    if (!output.humidity_id) {
      await revertChanges();
      return { success: false, error: `Output row ${rowNum}: Humidity is required`, code: "VALIDATION_FAILED" };
    }
    if (!output.type_id) {
      await revertChanges();
      return { success: false, error: `Output row ${rowNum}: Type is required`, code: "VALIDATION_FAILED" };
    }
    if (!output.processing_id) {
      await revertChanges();
      return { success: false, error: `Output row ${rowNum}: Processing is required`, code: "VALIDATION_FAILED" };
    }
    if (!output.fsc_id) {
      await revertChanges();
      return { success: false, error: `Output row ${rowNum}: FSC is required`, code: "VALIDATION_FAILED" };
    }
    if (!output.quality_id) {
      await revertChanges();
      return { success: false, error: `Output row ${rowNum}: Quality is required`, code: "VALIDATION_FAILED" };
    }

    // Check required dimension fields
    if (!output.thickness || output.thickness === "" || output.thickness === "0") {
      await revertChanges();
      return { success: false, error: `Output row ${rowNum}: Thickness is required`, code: "VALIDATION_FAILED" };
    }
    if (!output.width || output.width === "" || output.width === "0") {
      await revertChanges();
      return { success: false, error: `Output row ${rowNum}: Width is required`, code: "VALIDATION_FAILED" };
    }
    if (!output.length || output.length === "" || output.length === "0") {
      await revertChanges();
      return { success: false, error: `Output row ${rowNum}: Length is required`, code: "VALIDATION_FAILED" };
    }

    // Check pieces OR volume is provided
    // Pieces can be empty only if volume is manually entered (volume > 0)
    const hasPieces = output.pieces && output.pieces !== "" && output.pieces !== "0";
    const hasVolume = output.volume_m3 && Number(output.volume_m3) > 0;

    if (!hasPieces && !hasVolume) {
      await revertChanges();
      return { success: false, error: `Output row ${rowNum}: Either pieces or volume must be provided`, code: "VALIDATION_FAILED" };
    }
  }

  // Check all outputs have volume > 0
  const invalidOutput = outputs.find((o: { volume_m3: number }) => !o.volume_m3 || Number(o.volume_m3) <= 0);
  if (invalidOutput) {
    await revertChanges();
    return { success: false, error: "All outputs must have volume > 0", code: "VALIDATION_FAILED" };
  }

  // Check all outputs have package numbers assigned
  console.log("[validateProduction] Checking outputs for package numbers:",
    outputs.map((o: any) => ({ id: o.id, package_number: o.package_number, type: typeof o.package_number }))
  );

  for (const output of outputs) {
    const pn = (output as any).package_number;
    if (pn === null || pn === undefined || pn === "" || (typeof pn === "string" && !pn.trim())) {
      console.log("[validateProduction] Found output without package number:", output);
      await revertChanges();
      return {
        success: false,
        error: "Please assign package numbers to all outputs first. Use the 'Assign Package Numbers' button before validating.",
        code: "MISSING_PACKAGE_NUMBERS"
      };
    }
  }

  // 4. Package numbers are already assigned in the draft - just use them
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packageNumbers = outputs.map((o: any) => o.package_number);

  // Pre-check: verify package numbers won't conflict with existing inventory
  // For re-validation, exclude packages from this entry (they'll be deleted)
  if (packageNumbers.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("inventory_packages")
      .select("package_number")
      .in("package_number", packageNumbers);

    if (isRevalidation) {
      query = query.neq("production_entry_id", productionEntryId);
    }

    const { data: existing } = await query;
    if (existing && existing.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conflicts = existing.map((e: any) => e.package_number).join(", ");
      await revertChanges();
      return { success: false, error: `Output package numbers already exist in inventory: ${conflicts}`, code: "VALIDATION_FAILED" };
    }
  }

  // For re-validation: NOW restore inventory and delete outputs (after all preconditions passed)
  if (isRevalidation) {
    // 1. Restore each input package to pre-validation state
    for (const input of inputs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pkg } = await (supabase as any)
        .from("inventory_packages")
        .select("pieces, volume_m3, status")
        .eq("id", input.package_id)
        .single();

      if (pkg) {
        const currentPieces = parseInt(pkg.pieces || "0", 10);
        const currentVolume = Number(pkg.volume_m3) || 0;
        const piecesToRestore = input.pieces_used || 0;
        const volumeToRestore = Number(input.volume_m3) || 0;
        const wasConsumed = pkg.status === "consumed";

        const restoredPieces = currentPieces + piecesToRestore;
        const restoredVolume = currentVolume + volumeToRestore;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("inventory_packages")
          .update({
            pieces: String(restoredPieces),
            volume_m3: restoredVolume,
            status: wasConsumed ? "produced" : pkg.status,
          })
          .eq("id", input.package_id);

        // Track restoration for rollback
        restoredPackages.push({
          packageId: input.package_id,
          piecesRestored: piecesToRestore,
          volumeRestored: volumeToRestore,
          wasConsumed,
        });
      }
    }

    // 2. Save existing output packages before deleting (for rollback)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingOutputs } = await (supabase as any)
      .from("inventory_packages")
      .select("*")
      .eq("production_entry_id", productionEntryId);

    if (existingOutputs) {
      deletedOutputPackages = existingOutputs;
    }

    // 3. Delete existing output inventory packages for this entry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("inventory_packages")
      .delete()
      .eq("production_entry_id", productionEntryId);
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
      await revertChanges();
      return { success: false, error: `Input package not found: ${input.package_id}`, code: "NOT_FOUND" };
    }

    if (input.pieces_used && pkg.pieces) {
      const currentPieces = parseInt(pkg.pieces, 10);

      // Guard: reject if pieces_used exceeds currently available pieces
      if (!isNaN(currentPieces) && input.pieces_used > currentPieces) {
        await revertChanges();
        return {
          success: false,
          error: `Input uses ${input.pieces_used} pieces but package only has ${currentPieces} available`,
          code: "VALIDATION_FAILED",
        };
      }

      const remaining = currentPieces - input.pieces_used;

      const pkgVolume = Number(pkg.volume_m3) || 0;

      if (remaining <= 0) {
        // Fully consumed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("inventory_packages")
          .update({ status: "consumed", pieces: "0", volume_m3: 0 })
          .eq("id", pkg.id);

        if (updateError) {
          await revertChanges();
          return { success: false, error: `Failed to update package: ${updateError.message}`, code: "UPDATE_FAILED" };
        }

        // Track deduction for rollback
        deductedPackages.push({
          packageId: pkg.id,
          piecesDeducted: currentPieces,
          volumeDeducted: pkgVolume,
          wasConsumed: true,
          originalStatus: "produced",
        });
      } else {
        // Partial consumption: reduce pieces and volume proportionally
        const ratio = remaining / currentPieces;
        const newVolume = pkgVolume * ratio;
        const volumeDeducted = pkgVolume - newVolume;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("inventory_packages")
          .update({ pieces: String(remaining), volume_m3: newVolume })
          .eq("id", pkg.id);

        if (updateError) {
          await revertChanges();
          return { success: false, error: `Failed to update package: ${updateError.message}`, code: "UPDATE_FAILED" };
        }

        // Track deduction for rollback
        deductedPackages.push({
          packageId: pkg.id,
          piecesDeducted: input.pieces_used,
          volumeDeducted: volumeDeducted,
          wasConsumed: false,
          originalStatus: "produced",
        });
      }
    } else {
      // No countable pieces — use volume deduction
      const currentVolume = Number(pkg.volume_m3) || 0;
      const inputVolume = Number(input.volume_m3);

      // Guard: reject if volume exceeds currently available
      if (inputVolume > currentVolume) {
        await revertChanges();
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
          await revertChanges();
          return { success: false, error: `Failed to update package: ${updateError.message}`, code: "UPDATE_FAILED" };
        }

        // Track deduction for rollback
        deductedPackages.push({
          packageId: pkg.id,
          piecesDeducted: 0,
          volumeDeducted: currentVolume,
          wasConsumed: true,
          originalStatus: "produced",
        });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("inventory_packages")
          .update({ volume_m3: newVolume })
          .eq("id", pkg.id);

        if (updateError) {
          await revertChanges();
          return { success: false, error: `Failed to update package: ${updateError.message}`, code: "UPDATE_FAILED" };
        }

        // Track deduction for rollback
        deductedPackages.push({
          packageId: pkg.id,
          piecesDeducted: 0,
          volumeDeducted: inputVolume,
          wasConsumed: false,
          originalStatus: "produced",
        });
      }
    }
  }

  // 5. Create output inventory packages (using existing package numbers from draft)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outputPackages = outputs.map((output: any, index: number) => ({
    organisation_id: organisationId,
    production_entry_id: productionEntryId,
    shipment_id: null,
    package_number: output.package_number,
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
    console.error("[validateProduction] Failed to create output packages:", insertError);
    await revertChanges();
    // Provide user-friendly error message
    if (insertError.message?.includes("package_number") && insertError.message?.includes("null")) {
      return {
        success: false,
        error: "Please assign package numbers to all outputs first. Use the 'Assign Package Numbers' button before validating.",
        code: "MISSING_PACKAGE_NUMBERS"
      };
    }
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
    await revertChanges();
    return { success: false, error: `Failed to update entry: ${updateEntryError.message}`, code: "UPDATE_FAILED" };
  }

  return { success: true, data: { redirectUrl: "/production" } };
}
