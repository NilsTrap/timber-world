"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

interface AssignResult {
  success: boolean;
  error?: string;
  assignedNumbers?: string[];
}

/**
 * Lookup the next available package number by checking both
 * inventory_packages and production_outputs tables.
 *
 * Format: N-{process_code}-{0001-9999}
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

  // Return next number (wrap at 9999)
  return maxNumber >= 9999 ? 1 : maxNumber + 1;
}

/**
 * Assign Package Numbers
 *
 * Assigns sequential package numbers to all outputs in a production entry
 * that don't have real numbers yet (empty or placeholder).
 *
 * Uses lookup approach: queries both inventory_packages and production_outputs
 * to find the current max number, then assigns sequentially.
 */
export async function assignPackageNumbers(
  productionEntryId: string
): Promise<AssignResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = await createClient();

  // Get production entry with org and process info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, organisation_id, status, ref_processes!inner(code)")
    .eq("id", productionEntryId)
    .single();

  if (entryError || !entry) {
    return { success: false, error: "Production entry not found" };
  }

  if (entry.status !== "draft") {
    return { success: false, error: "Can only assign numbers to draft productions" };
  }

  const organisationId = entry.organisation_id;
  const processCode = entry.ref_processes?.code;

  if (!processCode) {
    return { success: false, error: "Process code not found" };
  }

  // Get all outputs that need numbers assigned
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outputs, error: outputsError } = await (supabase as any)
    .from("portal_production_outputs")
    .select("id, package_number, sort_order")
    .eq("production_entry_id", productionEntryId)
    .order("sort_order", { ascending: true });

  if (outputsError) {
    return { success: false, error: "Failed to fetch outputs" };
  }

  if (!outputs || outputs.length === 0) {
    return { success: false, error: "No outputs to assign numbers to" };
  }

  // Filter outputs that need numbers (only those with NO package number at all)
  // Don't overwrite package numbers from other processes that were selected via dropdown
  const outputsNeedingNumbers = outputs.filter(
    (o: { package_number: string | null }) =>
      !o.package_number || o.package_number.trim() === ""
  );

  if (outputsNeedingNumbers.length === 0) {
    return { success: true, assignedNumbers: [] };
  }

  // Lookup the next available number
  let nextNumber = await lookupNextNumber(supabase, organisationId, processCode);
  const assignedNumbers: string[] = [];

  // Assign numbers to each output
  for (const output of outputsNeedingNumbers) {
    const packageNumber = `N-${processCode}-${String(nextNumber).padStart(4, "0")}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("portal_production_outputs")
      .update({ package_number: packageNumber })
      .eq("id", output.id);

    if (updateError) {
      console.error("Failed to assign package number:", updateError);
      return {
        success: false,
        error: `Failed to assign number to output. Assigned so far: ${assignedNumbers.join(", ")}`
      };
    }

    assignedNumbers.push(packageNumber);
    nextNumber = nextNumber >= 9999 ? 1 : nextNumber + 1;
  }

  return { success: true, assignedNumbers };
}
