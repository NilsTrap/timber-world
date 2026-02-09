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

  // Track output updates for rollback (re-validation update-in-place flow)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatedOutputOriginals: Array<{ id: string; original: any }> = [];
  const insertedOutputIds: string[] = [];

  // Helper to revert status and restore inventory on failure
  const revertChanges = async () => {
    console.log(`[validateProduction] Rolling back - deducted: ${deductedPackages.length}, restored: ${restoredPackages.length}, deleted outputs: ${deletedOutputPackages.length}, updated outputs: ${updatedOutputOriginals.length}, inserted outputs: ${insertedOutputIds.length}`);

    try {
      // 1. Batch-fetch all packages that need rollback
      const allRollbackIds = [
        ...deductedPackages.map((p) => p.packageId),
        ...restoredPackages.map((p) => p.packageId),
      ];
      const uniqueRollbackIds = [...new Set(allRollbackIds)];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rollbackPkgMap = new Map<string, any>();
      if (uniqueRollbackIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rollbackPkgs } = await (supabase as any)
          .from("inventory_packages")
          .select("id, pieces, volume_m3, status")
          .in("id", uniqueRollbackIds);

        rollbackPkgMap = new Map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (rollbackPkgs || []).map((p: any) => [p.id, { ...p }])
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rollbackUpdates: Array<{ packageId: string; update: any }> = [];

      // Undo deductions (add back what was deducted)
      for (const pkg of deductedPackages) {
        const currentPkg = rollbackPkgMap.get(pkg.packageId);
        if (!currentPkg) {
          console.error(`[validateProduction] Package ${pkg.packageId} not found for rollback`);
          continue;
        }
        const currentPieces = parseInt(currentPkg.pieces || "0", 10);
        const currentVolume = Number(currentPkg.volume_m3) || 0;
        // Update in-memory state for cumulative rollback
        currentPkg.pieces = String(currentPieces + pkg.piecesDeducted);
        currentPkg.volume_m3 = currentVolume + pkg.volumeDeducted;
        if (pkg.wasConsumed) currentPkg.status = pkg.originalStatus;
      }

      // Undo restoration (subtract what was restored) - for re-validation
      for (const pkg of restoredPackages) {
        const currentPkg = rollbackPkgMap.get(pkg.packageId);
        if (!currentPkg) {
          console.error(`[validateProduction] Package ${pkg.packageId} not found for un-restore`);
          continue;
        }
        const currentPieces = parseInt(currentPkg.pieces || "0", 10);
        const currentVolume = Number(currentPkg.volume_m3) || 0;
        currentPkg.pieces = String(Math.max(0, currentPieces - pkg.piecesRestored));
        currentPkg.volume_m3 = Math.max(0, currentVolume - pkg.volumeRestored);
        if (pkg.wasConsumed) currentPkg.status = "consumed";
      }

      // Build final update payloads from accumulated in-memory state
      for (const [packageId, pkg] of rollbackPkgMap) {
        rollbackUpdates.push({
          packageId,
          update: { pieces: pkg.pieces, volume_m3: pkg.volume_m3, status: pkg.status },
        });
      }

      // Execute all rollback operations in parallel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rollbackPromises: Promise<any>[] = rollbackUpdates.map(({ packageId, update }) =>
        (supabase as any)
          .from("inventory_packages")
          .update(update)
          .eq("id", packageId)
      );

      // Restore updated output packages to their original field values
      for (const { id, original } of updatedOutputOriginals) {
        rollbackPromises.push(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from("inventory_packages")
            .update(original)
            .eq("id", id)
        );
      }

      // Delete any newly inserted output packages
      if (insertedOutputIds.length > 0) {
        rollbackPromises.push(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from("inventory_packages")
            .delete()
            .in("id", insertedOutputIds)
        );
      }

      // Recreate deleted orphan output packages - for re-validation
      if (deletedOutputPackages.length > 0) {
        rollbackPromises.push(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from("inventory_packages")
            .insert(deletedOutputPackages)
        );
      }

      // Revert entry status
      rollbackPromises.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("portal_production_entries")
          .update({ status: previousStatus })
          .eq("id", productionEntryId)
          .eq("status", "validating")
      );

      const rollbackResults = await Promise.all(rollbackPromises);
      for (const result of rollbackResults) {
        if (result.error) {
          console.error(`[validateProduction] Rollback operation failed:`, result.error);
        }
      }
    } catch (err) {
      console.error(`[validateProduction] Rollback failed with exception:`, err);
    }
  };

  // 2+3. Fetch all inputs and outputs in parallel (independent reads)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [inputsResult, outputsResult] = await Promise.all([
    (supabase as any)
      .from("portal_production_inputs")
      .select("id, package_id, pieces_used, volume_m3")
      .eq("production_entry_id", productionEntryId),
    (supabase as any)
      .from("portal_production_outputs")
      .select("id, package_number, product_name_id, wood_species_id, humidity_id, type_id, processing_id, fsc_id, quality_id, thickness, width, length, pieces, volume_m3, notes")
      .eq("production_entry_id", productionEntryId)
      .order("package_number", { ascending: true }),
  ]);

  const { data: inputs, error: inputsError } = inputsResult;
  const { data: outputs, error: outputsError } = outputsResult;

  if (inputsError) {
    await revertChanges();
    return { success: false, error: "Failed to fetch inputs", code: "QUERY_FAILED" };
  }

  if (!inputs || inputs.length === 0) {
    await revertChanges();
    return { success: false, error: "At least one input is required", code: "VALIDATION_FAILED" };
  }

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

  // Always fetch existing output packages for this entry (handles re-validation AND
  // entries reverted to draft that still have inventory packages from a previous validation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingOutputPkgs, error: existingOutputError } = await (supabase as any)
    .from("inventory_packages")
    .select("*")
    .eq("production_entry_id", productionEntryId);

  if (existingOutputError) {
    console.error("[validateProduction] Failed to fetch existing output packages:", existingOutputError);
  }

  const hasExistingOutputs = (existingOutputPkgs?.length ?? 0) > 0;
  console.log(`[validateProduction] Existing output packages: ${existingOutputPkgs?.length ?? 0}, hasExistingOutputs: ${hasExistingOutputs}, isRevalidation: ${isRevalidation}`);

  // Pre-check: verify package numbers won't conflict with existing inventory within the same organization
  // Package numbers are unique per organization, not globally
  // When existing outputs exist, exclude packages from this entry (they'll be updated in place)
  if (packageNumbers.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("inventory_packages")
      .select("package_number")
      .eq("organisation_id", organisationId)
      .in("package_number", packageNumbers);

    if (hasExistingOutputs) {
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

  // For re-validation: restore inventory state (undo previous input deductions)
  // Only when entry was "validated" — if reverted to "draft", inputs were already restored
  if (isRevalidation) {
    const inputPackageIds = [...new Set(inputs.map((i: { package_id: string }) => i.package_id))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inputPkgsData } = await (supabase as any)
      .from("inventory_packages")
      .select("id, pieces, volume_m3, status")
      .in("id", inputPackageIds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pkgMap = new Map<string, any>(
      (inputPkgsData || []).map((p: any) => [p.id, p])
    );

    // Group inputs by package_id (handle duplicates safely by summing deductions)
    const deductionsByPkg = new Map<string, { piecesToRestore: number; volumeToRestore: number }>();
    for (const input of inputs) {
      const existing = deductionsByPkg.get(input.package_id);
      const piecesToRestore = input.pieces_used || 0;
      const volumeToRestore = Number(input.volume_m3) || 0;
      if (existing) {
        existing.piecesToRestore += piecesToRestore;
        existing.volumeToRestore += volumeToRestore;
      } else {
        deductionsByPkg.set(input.package_id, { piecesToRestore, volumeToRestore });
      }
    }

    // Compute updates and execute in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const restoreUpdates: Array<{ packageId: string; update: any; piecesRestored: number; volumeRestored: number; wasConsumed: boolean }> = [];
    for (const [packageId, { piecesToRestore, volumeToRestore }] of deductionsByPkg) {
      const pkg = pkgMap.get(packageId);
      if (!pkg) continue;

      const currentPieces = parseInt(pkg.pieces || "0", 10);
      const currentVolume = Number(pkg.volume_m3) || 0;
      const wasConsumed = pkg.status === "consumed";

      restoreUpdates.push({
        packageId,
        update: {
          pieces: String(currentPieces + piecesToRestore),
          volume_m3: currentVolume + volumeToRestore,
          status: wasConsumed ? "produced" : pkg.status,
        },
        piecesRestored: piecesToRestore,
        volumeRestored: volumeToRestore,
        wasConsumed,
      });
    }

    // Execute all restore updates in parallel (each targets a different package)
    if (restoreUpdates.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Promise.all(
        restoreUpdates.map(({ packageId, update }) =>
          (supabase as any)
            .from("inventory_packages")
            .update(update)
            .eq("id", packageId)
        )
      );

      // Track restorations for rollback
      for (const { packageId, piecesRestored, volumeRestored, wasConsumed } of restoreUpdates) {
        restoredPackages.push({ packageId, piecesRestored, volumeRestored, wasConsumed });
      }
    }
  }

  // 5. Compute totals
  const totalInputM3 = inputs.reduce((sum: number, i: { volume_m3: number }) => sum + Number(i.volume_m3), 0);
  const totalOutputM3 = outputs.reduce((sum: number, o: { volume_m3: number }) => sum + Number(o.volume_m3), 0);
  const outcomePercentage = totalInputM3 > 0 ? (totalOutputM3 / totalInputM3) * 100 : 0;
  const wastePercentage = 100 - outcomePercentage;

  // 6. Deduct from input inventory packages
  // Batch-fetch all input packages in one query instead of N sequential fetches
  const deductionPackageIds = [...new Set(inputs.map((i: { package_id: string }) => i.package_id))];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deductionPkgs, error: deductionFetchError } = await (supabase as any)
    .from("inventory_packages")
    .select("id, pieces, volume_m3, status")
    .in("id", deductionPackageIds);

  if (deductionFetchError) {
    await revertChanges();
    return { success: false, error: "Failed to fetch input packages", code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deductionPkgMap = new Map<string, any>(
    (deductionPkgs || []).map((p: any) => [p.id, { ...p }])
  );

  // Verify all packages exist
  for (const input of inputs) {
    if (!deductionPkgMap.has(input.package_id)) {
      await revertChanges();
      return { success: false, error: `Input package not found: ${input.package_id}`, code: "NOT_FOUND" };
    }
  }

  // Process deductions in memory (handles duplicate package_ids by mutating the map copy)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingDeductions: Array<{ packageId: string; update: any; deduction: typeof deductedPackages[0] }> = [];

  for (const input of inputs) {
    const pkg = deductionPkgMap.get(input.package_id)!;

    if (input.pieces_used && pkg.pieces) {
      const currentPieces = parseInt(pkg.pieces, 10);

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
        pendingDeductions.push({
          packageId: pkg.id,
          update: { status: "consumed", pieces: "0", volume_m3: 0 },
          deduction: { packageId: pkg.id, piecesDeducted: currentPieces, volumeDeducted: pkgVolume, wasConsumed: true, originalStatus: pkg.status || "produced" },
        });
        // Update in-memory state for duplicate package_id handling
        pkg.pieces = "0";
        pkg.volume_m3 = 0;
        pkg.status = "consumed";
      } else {
        const ratio = remaining / currentPieces;
        const newVolume = pkgVolume * ratio;
        const volumeDeducted = pkgVolume - newVolume;

        pendingDeductions.push({
          packageId: pkg.id,
          update: { pieces: String(remaining), volume_m3: newVolume },
          deduction: { packageId: pkg.id, piecesDeducted: input.pieces_used, volumeDeducted, wasConsumed: false, originalStatus: pkg.status || "produced" },
        });
        // Update in-memory state
        pkg.pieces = String(remaining);
        pkg.volume_m3 = newVolume;
      }
    } else {
      const currentVolume = Number(pkg.volume_m3) || 0;
      const inputVolume = Number(input.volume_m3);

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
        pendingDeductions.push({
          packageId: pkg.id,
          update: { status: "consumed", volume_m3: 0 },
          deduction: { packageId: pkg.id, piecesDeducted: 0, volumeDeducted: currentVolume, wasConsumed: true, originalStatus: pkg.status || "produced" },
        });
        pkg.volume_m3 = 0;
        pkg.status = "consumed";
      } else {
        pendingDeductions.push({
          packageId: pkg.id,
          update: { volume_m3: newVolume },
          deduction: { packageId: pkg.id, piecesDeducted: 0, volumeDeducted: inputVolume, wasConsumed: false, originalStatus: pkg.status || "produced" },
        });
        pkg.volume_m3 = newVolume;
      }
    }
  }

  // Merge deductions for same package (last update wins since we processed sequentially in memory)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mergedDeductions = new Map<string, { update: any; deductions: typeof deductedPackages }>();
  for (const { packageId, update, deduction } of pendingDeductions) {
    const existing = mergedDeductions.get(packageId);
    if (existing) {
      existing.update = update; // Last update wins (cumulative state)
      existing.deductions.push(deduction);
    } else {
      mergedDeductions.set(packageId, { update, deductions: [deduction] });
    }
  }

  // Apply all deductions in parallel (each targets a different package)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deductionResults = await Promise.all(
    [...mergedDeductions.entries()].map(([packageId, { update }]) =>
      (supabase as any)
        .from("inventory_packages")
        .update(update)
        .eq("id", packageId)
    )
  );

  // Check results and track for rollback
  const mergedEntries = [...mergedDeductions.entries()];
  for (let i = 0; i < deductionResults.length; i++) {
    if (deductionResults[i].error) {
      await revertChanges();
      return { success: false, error: `Failed to update package: ${deductionResults[i].error.message}`, code: "UPDATE_FAILED" };
    }
    // Track all deductions for this package
    for (const d of mergedEntries[i]![1].deductions) {
      deductedPackages.push(d);
    }
  }

  // 5. Create/update output inventory packages (using existing package numbers from draft)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildOutputFields = (output: any) => ({
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
    notes: output.notes || null,
    package_number: output.package_number,
  });

  // Build all output packages with their fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outputPackages = outputs.map((output: any, index: number) => ({
    organisation_id: organisationId,
    production_entry_id: productionEntryId,
    shipment_id: null,
    package_number: output.package_number,
    package_sequence: index + 1,
    ...buildOutputFields(output),
  }));

  if (hasExistingOutputs) {
    // Update-in-place flow: sort existing by sequence, update by ID, insert extras, delete orphans
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortedExisting = [...(existingOutputPkgs || [])].sort(
      (a: any, b: any) => (Number(a.package_sequence) || 0) - (Number(b.package_sequence) || 0)
    );
    const reusableCount = Math.min(outputs.length, sortedExisting.length);

    console.log(`[validateProduction] Update-in-place: ${sortedExisting.length} existing, ${outputs.length} new outputs, reusing ${reusableCount}, inserting ${Math.max(0, outputs.length - sortedExisting.length)}, orphaning ${Math.max(0, sortedExisting.length - outputs.length)}`);

    // 1. UPDATE existing packages by ID (reuse first N)
    if (reusableCount > 0) {
      // Save originals for rollback
      for (let i = 0; i < reusableCount; i++) {
        const original = { ...sortedExisting[i] };
        delete original.id;
        delete original.created_at;
        updatedOutputOriginals.push({ id: sortedExisting[i].id, original });
      }

      const updateResults = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        outputPackages.slice(0, reusableCount).map((pkg: any, i: number) => {
          const { organisation_id, production_entry_id, shipment_id, ...fields } = pkg;
          return (supabase as any)
            .from("inventory_packages")
            .update(fields)
            .eq("id", sortedExisting[i].id);
        })
      );

      for (let i = 0; i < updateResults.length; i++) {
        if (updateResults[i].error) {
          console.error("[validateProduction] Failed to update output package:", updateResults[i].error);
          await revertChanges();
          return { success: false, error: `Failed to update output package: ${updateResults[i].error.message}`, code: "UPDATE_FAILED" };
        }
      }
    }

    // 2. INSERT truly new packages (output count grew)
    if (outputs.length > sortedExisting.length) {
      const newPackages = outputPackages.slice(sortedExisting.length);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error: insertError } = await (supabase as any)
        .from("inventory_packages")
        .insert(newPackages)
        .select("id");

      if (insertError) {
        console.error("[validateProduction] Failed to insert new output packages:", insertError);
        await revertChanges();
        return { success: false, error: `Failed to create output packages: ${insertError.message}`, code: "INSERT_FAILED" };
      }
      if (inserted) {
        for (const row of inserted) {
          insertedOutputIds.push(row.id);
        }
      }
    }

    // 3. DELETE orphaned packages (output count shrank)
    if (sortedExisting.length > outputs.length) {
      const orphans = sortedExisting.slice(outputs.length);
      const orphanIds = orphans.map((p: { id: string }) => p.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError, count } = await (supabase as any)
        .from("inventory_packages")
        .delete()
        .in("id", orphanIds);

      if (deleteError) {
        console.error("[validateProduction] Failed to delete orphaned output packages:", deleteError);
        await revertChanges();
        return { success: false, error: `Failed to remove orphaned output packages: ${deleteError.message}`, code: "DELETE_FAILED" };
      }

      // PostgREST may silently skip deletes blocked by FK constraints
      if (count !== null && count !== undefined && count < orphanIds.length) {
        const blockedNumbers = orphans.map((p: { package_number: string }) => p.package_number).join(", ");
        await revertChanges();
        return {
          success: false,
          error: `Cannot remove output packages (${blockedNumbers}) because they are used as inputs in downstream production entries. Remove those references first.`,
          code: "FK_CONSTRAINT",
        };
      }

      deletedOutputPackages = orphans;
    }
  } else {
    // First-time validation: bulk INSERT all output packages
    console.log(`[validateProduction] Using first-time bulk INSERT flow. Output count: ${outputs.length}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("inventory_packages")
      .insert(outputPackages);

    if (insertError) {
      console.error("[validateProduction] Failed to create output packages:", insertError);
      await revertChanges();
      if (insertError.message?.includes("package_number") && insertError.message?.includes("null")) {
        return {
          success: false,
          error: "Please assign package numbers to all outputs first. Use the 'Assign Package Numbers' button before validating.",
          code: "MISSING_PACKAGE_NUMBERS"
        };
      }
      return { success: false, error: `Failed to create output packages: ${insertError.message}`, code: "INSERT_FAILED" };
    }
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
