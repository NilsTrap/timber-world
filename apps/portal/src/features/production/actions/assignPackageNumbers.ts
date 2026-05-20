"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

interface AssignResult {
  success: boolean;
  error?: string;
  assignedNumbers?: string[];
}

/**
 * Build a Set of every package number currently in use for this org+process,
 * across both validated inventory and draft production outputs.
 *
 * Format: N-{process_code}-{0001-9999}
 */
async function loadTakenNumbers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organisationId: string,
  processCode: string
): Promise<Set<number>> {
  const pattern = `N-${processCode}-%`;
  const numberRegex = new RegExp(`^N-${processCode}-(\\d+)$`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invData } = await (supabase as any)
    .from("inventory_packages")
    .select("package_number")
    .eq("organisation_id", organisationId)
    .like("package_number", pattern);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prodData } = await (supabase as any)
    .from("portal_production_outputs")
    .select("package_number, portal_production_entries!inner(organisation_id)")
    .eq("portal_production_entries.organisation_id", organisationId)
    .like("package_number", pattern);

  const taken = new Set<number>();
  for (const row of [...(invData ?? []), ...(prodData ?? [])]) {
    const match = row.package_number?.match(numberRegex);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n)) taken.add(n);
    }
  }
  return taken;
}

/**
 * Find the next free package number above `from`. Verifies that the candidate
 * is not already in the taken set — this is the defensive check that catches
 * cases where "max(taken)+1" would lie (stale MAX, gaps from deleted drafts
 * whose validated inventory survived, manual entries, etc.). When taken,
 * candidates are skipped one at a time. Wraps at 9999 back to 1.
 */
function nextFreeNumber(taken: Set<number>, from: number): number {
  let n = from;
  // Bounded loop so a fully-saturated 1..9999 range fails predictably instead
  // of hanging. 9999 iterations is the absolute worst case.
  for (let i = 0; i < 9999; i++) {
    if (!taken.has(n)) return n;
    n = n >= 9999 ? 1 : n + 1;
  }
  throw new Error("All package numbers 1..9999 are taken");
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

  // Load the currently-taken numbers, then assign by walking forward from
  // max+1 but skipping any candidate already in the taken set. This protects
  // against gaps caused by re-validated entries, deleted drafts whose
  // validated inventory survived, manual edits, etc.
  const taken = await loadTakenNumbers(supabase, organisationId, processCode);
  let candidate = taken.size === 0 ? 1 : Math.max(...taken) + 1;
  if (candidate > 9999) candidate = 1;
  const assignedNumbers: string[] = [];

  for (const output of outputsNeedingNumbers) {
    try {
      candidate = nextFreeNumber(taken, candidate);
    } catch (e) {
      return {
        success: false,
        error: `Cannot assign package number: ${(e as Error).message}. Assigned so far: ${assignedNumbers.join(", ")}`,
      };
    }
    const packageNumber = `N-${processCode}-${String(candidate).padStart(4, "0")}`;

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
    // Reserve this number locally so the loop's next iteration skips it,
    // and advance the candidate cursor.
    taken.add(candidate);
    candidate = candidate >= 9999 ? 1 : candidate + 1;
  }

  return { success: true, assignedNumbers };
}
