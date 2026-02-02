"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

export interface NextPackageNumber {
  processCode: string;
  processName: string;
  nextNumber: string;
}

/**
 * Get Next Package Numbers
 *
 * Fetches the next available package number for each process.
 * Used to populate the package number dropdown in production outputs.
 *
 * @param productionEntryId - The production entry to get numbers for (used to determine organisation)
 * @param takenNumbers - Numbers already taken in the current draft (client-side tracking)
 */
export async function getNextPackageNumbers(
  productionEntryId: string,
  takenNumbers: string[] = []
): Promise<ActionResult<NextPackageNumber[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // Get the organisation ID from the production entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("organisation_id")
    .eq("id", productionEntryId)
    .single();

  if (entryError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  const organisationId = entry.organisation_id;

  // Get all processes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: processes, error: processesError } = await (supabase as any)
    .from("ref_processes")
    .select("id, code, value")
    .order("code", { ascending: true });

  if (processesError) {
    return { success: false, error: "Failed to fetch processes", code: "QUERY_FAILED" };
  }

  const results: NextPackageNumber[] = [];
  const takenSet = new Set(takenNumbers);

  for (const process of processes || []) {
    const processCode = process.code;
    const pattern = `N-${processCode}-%`;
    const regex = new RegExp(`^N-${processCode}-(\\d+)$`);

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

    // Collect all existing numbers for this process
    const existingNumbers = new Set<number>();

    for (const row of invData || []) {
      const match = row.package_number?.match(regex);
      if (match) {
        existingNumbers.add(parseInt(match[1], 10));
      }
    }

    for (const row of prodData || []) {
      const match = row.package_number?.match(regex);
      if (match) {
        existingNumbers.add(parseInt(match[1], 10));
      }
    }

    // Also add taken numbers from client-side
    for (const taken of takenNumbers) {
      const match = taken.match(regex);
      if (match && match[1]) {
        existingNumbers.add(parseInt(match[1], 10));
      }
    }

    // Find next available number (starting from 1)
    let nextNum = 1;
    while (existingNumbers.has(nextNum) && nextNum <= 9999) {
      nextNum++;
    }
    if (nextNum > 9999) nextNum = 1; // wrap around

    const nextNumber = `N-${processCode}-${String(nextNum).padStart(4, "0")}`;

    // Skip if this number is in the taken set
    if (!takenSet.has(nextNumber)) {
      results.push({
        processCode,
        processName: process.value,
        nextNumber,
      });
    }
  }

  return { success: true, data: results };
}
