"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lookup the next available package number by checking both
 * inventory_packages and production_outputs tables.
 */
async function lookupNextNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organisationId: string,
  processCode: string
): Promise<number> {
  const pattern = `N-${processCode}-%`;
  const regex = `^N-${processCode}-(\\d+)$`;

  // Query max from inventory_packages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invData } = await (supabase as any)
    .from("inventory_packages")
    .select("package_number")
    .eq("organisation_id", organisationId)
    .like("package_number", pattern);

  // Query max from portal_production_outputs (for drafts not yet in inventory)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prodData } = await (supabase as any)
    .from("portal_production_outputs")
    .select("package_number, portal_production_entries!inner(organisation_id)")
    .eq("portal_production_entries.organisation_id", organisationId)
    .like("package_number", pattern);

  // Find the maximum number from both sources
  let maxNumber = 0;
  const numberRegex = new RegExp(regex);

  for (const row of invData || []) {
    const match = row.package_number?.match(numberRegex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  }

  for (const row of prodData || []) {
    const match = row.package_number?.match(numberRegex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  }

  return maxNumber >= 9999 ? 1 : maxNumber + 1;
}

interface OutputRowInput {
  dbId: string | null;
  packageNumber: string;
  productNameId: string;
  woodSpeciesId: string;
  humidityId: string;
  typeId: string;
  processingId: string;
  fscId: string;
  qualityId: string;
  thickness: string;
  width: string;
  length: string;
  pieces: string;
  volumeM3: number;
  notes: string;
}

interface SaveResult {
  /** Map of clientIndex → new dbId for inserted rows */
  insertedIds: Record<number, string>;
  /** Map of clientIndex → generated package number for inserted rows */
  packageNumbers: Record<number, string>;
}

/**
 * Save Production Outputs (Batch Diff)
 *
 * Compares client rows with existing DB rows for the entry:
 * - Rows with dbId=null → INSERT
 * - Rows with dbId that differ → UPDATE
 * - DB rows not in client list → DELETE
 *
 * Changes are staged in portal_production_outputs. Inventory changes
 * are only applied when the entry is validated via validateProduction.
 *
 * Returns the newly inserted row IDs mapped by their index.
 */
export async function saveProductionOutputs(
  productionEntryId: string,
  rows: OutputRowInput[]
): Promise<ActionResult<SaveResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const isAdmin = isSuperAdmin(session);
  if (!isProducer(session) && !isAdmin) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!productionEntryId || !UUID_REGEX.test(productionEntryId)) {
    return { success: false, error: "Invalid entry ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Verify production entry ownership and get org/process info for package numbering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, created_by, status, organisation_id, process_id, ref_processes!inner(code, value)")
    .eq("id", productionEntryId)
    .single();

  if (entryError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  // Admins can edit any entry; regular users only their own
  if (!isAdmin && entry.created_by !== session.id) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Regular users can only modify drafts; admins can modify validated entries too
  if (!isAdmin && entry.status !== "draft") {
    return { success: false, error: "Cannot modify a validated production entry", code: "VALIDATION_FAILED" };
  }
  if (isAdmin && entry.status !== "draft" && entry.status !== "validated") {
    return { success: false, error: "Cannot modify entry in this status", code: "VALIDATION_FAILED" };
  }

  const isValidated = entry.status === "validated";

  const organisationId = entry.organisation_id;
  const processCode = entry.ref_processes?.code;
  const processName = entry.ref_processes?.value;

  // For "Sorting" process, inherit the process code from input packages
  // since sorting doesn't change the product type
  const isSortingProcess = processName?.toLowerCase() === "sorting";
  let inheritedProcessCode: string | null = null;

  if (isSortingProcess) {
    // Fetch input packages to get their process codes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inputs, error: inputsError } = await (supabase as any)
      .from("portal_production_inputs")
      .select("inventory_packages!inner(package_number)")
      .eq("production_entry_id", productionEntryId)
      .limit(1);

    if (!inputsError && inputs && inputs.length > 0) {
      const inputPackageNumber = inputs[0]?.inventory_packages?.package_number;
      if (inputPackageNumber) {
        // Extract process code from package number format: N-{CODE}-{NNNN}
        const match = inputPackageNumber.match(/^N-([A-Z]{2})-\d+$/);
        if (match) {
          inheritedProcessCode = match[1];
        }
      }
    }
  }

  // Use inherited code for Sorting, otherwise use the process's own code
  const effectiveProcessCode = inheritedProcessCode || processCode;

  // Fetch existing DB rows with full data for diff comparison
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRows, error: fetchError } = await (supabase as any)
    .from("portal_production_outputs")
    .select("id, package_number, product_name_id, wood_species_id, humidity_id, type_id, processing_id, fsc_id, quality_id, thickness, width, length, pieces, volume_m3, notes")
    .eq("production_entry_id", productionEntryId);

  if (fetchError) {
    return { success: false, error: `Failed to fetch existing outputs: ${fetchError.message}`, code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingMap = new Map<string, any>((existingRows || []).map((r: any) => [r.id, r]));
  const clientDbIds = new Set<string>(rows.filter((r) => r.dbId).map((r) => r.dbId!));

  // DELETE: DB rows not in client list
  const toDelete = [...existingMap.keys()].filter((id) => !clientDbIds.has(id));

  // For validated entries, check if deleted outputs are used as inputs elsewhere
  if (isValidated && toDelete.length > 0) {
    // Get the package numbers of outputs being deleted
    const packageNumbersToDelete = toDelete
      .map((id) => existingMap.get(id)?.package_number)
      .filter(Boolean);

    if (packageNumbersToDelete.length > 0) {
      // Check if any of these packages are used as inputs in other production entries
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: usedAsInput } = await (supabase as any)
        .from("portal_production_inputs")
        .select("inventory_packages!inner(package_number)")
        .in("inventory_packages.package_number", packageNumbersToDelete);

      if (usedAsInput && usedAsInput.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const usedPackages = usedAsInput.map((u: any) => u.inventory_packages.package_number).join(", ");
        return {
          success: false,
          error: `Cannot delete outputs that are used as inputs in other production entries: ${usedPackages}`,
          code: "VALIDATION_FAILED",
        };
      }
    }
  }

  if (toDelete.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from("portal_production_outputs")
      .delete()
      .in("id", toDelete);

    if (deleteError) {
      return { success: false, error: `Failed to delete outputs: ${deleteError.message}`, code: "DELETE_FAILED" };
    }
  }

  const insertedIds: Record<number, string> = {};
  const packageNumbers: Record<number, string> = {};

  // Helper to build DB row payload
  function toDbRow(row: OutputRowInput, index: number) {
    return {
      production_entry_id: productionEntryId,
      package_number: row.packageNumber || null,
      product_name_id: row.productNameId || null,
      wood_species_id: row.woodSpeciesId || null,
      humidity_id: row.humidityId || null,
      type_id: row.typeId || null,
      processing_id: row.processingId || null,
      fsc_id: row.fscId || null,
      quality_id: row.qualityId || null,
      thickness: row.thickness || null,
      width: row.width || null,
      length: row.length || null,
      pieces: row.pieces || null,
      volume_m3: row.volumeM3,
      notes: row.notes || null,
      sort_order: index,
    };
  }

  // Helper to build inventory package payload
  function toInventoryPackage(row: OutputRowInput, index: number) {
    return {
      organisation_id: organisationId,
      production_entry_id: productionEntryId,
      shipment_id: null,
      package_number: row.packageNumber,
      package_sequence: index + 1,
      product_name_id: row.productNameId || null,
      wood_species_id: row.woodSpeciesId || null,
      humidity_id: row.humidityId || null,
      type_id: row.typeId || null,
      processing_id: row.processingId || null,
      fsc_id: row.fscId || null,
      quality_id: row.qualityId || null,
      thickness: row.thickness || null,
      width: row.width || null,
      length: row.length || null,
      pieces: row.pieces || null,
      volume_m3: row.volumeM3,
      volume_is_calculated: false,
      status: "produced",
    };
  }

  // Helper to check if a row has changed compared to DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function hasChanged(row: OutputRowInput, existing: any): boolean {
    if (row.packageNumber !== existing.package_number) return true;
    if ((row.productNameId || null) !== existing.product_name_id) return true;
    if ((row.woodSpeciesId || null) !== existing.wood_species_id) return true;
    if ((row.humidityId || null) !== existing.humidity_id) return true;
    if ((row.typeId || null) !== existing.type_id) return true;
    if ((row.processingId || null) !== existing.processing_id) return true;
    if ((row.fscId || null) !== existing.fsc_id) return true;
    if ((row.qualityId || null) !== existing.quality_id) return true;
    if ((row.thickness || null) !== existing.thickness) return true;
    if ((row.width || null) !== existing.width) return true;
    if ((row.length || null) !== existing.length) return true;
    if ((row.pieces || null) !== existing.pieces) return true;
    if (row.volumeM3 !== parseFloat(existing.volume_m3)) return true;
    if ((row.notes || null) !== existing.notes) return true;
    return false;
  }

  // Separate rows into inserts, updates, and rows needing package number assignment
  const toInsert: { index: number; row: OutputRowInput; payload: ReturnType<typeof toDbRow> }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toUpdate: { id: string; row: OutputRowInput; existing: any; payload: ReturnType<typeof toDbRow> }[] = [];
  // Existing rows that need a package number assigned (already in DB but missing number)
  const needsPackageNumber: { index: number; id: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!row.dbId) {
      toInsert.push({ index: i, row, payload: toDbRow(row, i) });
    } else {
      const existing = existingMap.get(row.dbId);
      if (existing) {
        // Check if this existing row needs a package number assigned
        if (!existing.package_number && !row.packageNumber) {
          needsPackageNumber.push({ index: i, id: row.dbId });
        }
        if (hasChanged(row, existing)) {
          toUpdate.push({ id: row.dbId, row, existing, payload: toDbRow(row, i) });
        }
      }
    }
  }

  // INSERT new rows with auto-assigned package numbers
  if (toInsert.length > 0) {
    // Get the next available package number
    let nextNumber = await lookupNextNumber(supabase, organisationId, effectiveProcessCode);

    for (const { index, row, payload } of toInsert) {
      // Auto-assign package number if not already set
      const assignedPackageNumber = row.packageNumber || `N-${effectiveProcessCode}-${String(nextNumber).padStart(4, "0")}`;
      const payloadWithNumber = { ...payload, package_number: assignedPackageNumber };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error: insertError } = await (supabase as any)
        .from("portal_production_outputs")
        .insert(payloadWithNumber)
        .select("id, package_number")
        .single();

      if (insertError) {
        console.error("Failed to insert output row:", insertError);
        return { success: false, error: `Failed to save output: ${insertError.message}`, code: "INSERT_FAILED" };
      }

      insertedIds[index] = inserted.id;
      packageNumbers[index] = inserted.package_number || "";

      // Only increment if we auto-assigned (not if user provided one)
      if (!row.packageNumber) {
        nextNumber = nextNumber >= 9999 ? 1 : nextNumber + 1;
      }
    }
  }

  // UPDATE only changed rows (individual queries — Supabase doesn't support batch update)
  for (const { id, row, existing, payload } of toUpdate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("portal_production_outputs")
      .update(payload)
      .eq("id", id);

    if (updateError) {
      console.error(`Failed to update output row ${id}:`, updateError);
      return { success: false, error: `Failed to update output: ${updateError.message}`, code: "UPDATE_FAILED" };
    }
  }

  // ASSIGN package numbers to existing rows that are missing them
  if (needsPackageNumber.length > 0) {
    // Reuse nextNumber from inserts if available, otherwise look it up
    let nextNumber =
      toInsert.length > 0
        ? await lookupNextNumber(supabase, organisationId, effectiveProcessCode)
        : await lookupNextNumber(supabase, organisationId, effectiveProcessCode);

    for (const { index, id } of needsPackageNumber) {
      const assignedNumber = `N-${effectiveProcessCode}-${String(nextNumber).padStart(4, "0")}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: assignError } = await (supabase as any)
        .from("portal_production_outputs")
        .update({ package_number: assignedNumber })
        .eq("id", id);

      if (assignError) {
        console.error(`Failed to assign package number to row ${id}:`, assignError);
      } else {
        packageNumbers[index] = assignedNumber;
        nextNumber = nextNumber >= 9999 ? 1 : nextNumber + 1;
      }
    }
  }

  return { success: true, data: { insertedIds, packageNumbers } };
}
