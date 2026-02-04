"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

export interface NextPackageNumber {
  processCode: string;
  processName: string;
  nextNumber: string;
}

const PACKAGE_NUMBER_REGEX = /^N-([A-Z]{2})-(\d+)$/;

/**
 * Get Next Package Numbers
 *
 * Fetches the next available package number for each process.
 * Used to populate the package number dropdown in production outputs.
 *
 * Optimised: fetches all package numbers in 2 queries (inventory + drafts)
 * instead of 2 queries per process.
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

  // Fetch entry and processes in parallel (both are independent reads)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [entryResult, processesResult] = await Promise.all([
    (supabase as any)
      .from("portal_production_entries")
      .select("organisation_id")
      .eq("id", productionEntryId)
      .single(),
    (supabase as any)
      .from("ref_processes")
      .select("id, code, value")
      .order("code", { ascending: true }),
  ]);

  if (entryResult.error || !entryResult.data) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }
  if (processesResult.error) {
    return { success: false, error: "Failed to fetch processes", code: "QUERY_FAILED" };
  }

  const organisationId = entryResult.data.organisation_id;
  const processes = processesResult.data || [];

  // Fetch ALL package numbers from both sources in parallel (2 queries instead of 2N)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invResult, prodResult] = await Promise.all([
    (supabase as any)
      .from("inventory_packages")
      .select("package_number")
      .eq("organisation_id", organisationId)
      .like("package_number", "N-%-"),
    (supabase as any)
      .from("portal_production_outputs")
      .select("package_number, portal_production_entries!inner(organisation_id)")
      .eq("portal_production_entries.organisation_id", organisationId)
      .like("package_number", "N-%-"),
  ]);

  // Build a map of processCode → Set<number> from all existing package numbers
  const existingByProcess = new Map<string, Set<number>>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (invResult.data || []) as any[]) {
    const match = row.package_number?.match(PACKAGE_NUMBER_REGEX);
    if (match && match[1] && match[2]) {
      const code = match[1];
      if (!existingByProcess.has(code)) existingByProcess.set(code, new Set());
      existingByProcess.get(code)!.add(parseInt(match[2], 10));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (prodResult.data || []) as any[]) {
    const match = row.package_number?.match(PACKAGE_NUMBER_REGEX);
    if (match && match[1] && match[2]) {
      const code = match[1];
      if (!existingByProcess.has(code)) existingByProcess.set(code, new Set());
      existingByProcess.get(code)!.add(parseInt(match[2], 10));
    }
  }

  // Add taken numbers from client-side
  for (const taken of takenNumbers) {
    const match = taken.match(PACKAGE_NUMBER_REGEX);
    if (match && match[1] && match[2]) {
      const code = match[1];
      if (!existingByProcess.has(code)) existingByProcess.set(code, new Set());
      existingByProcess.get(code)!.add(parseInt(match[2], 10));
    }
  }

  // Compute next available number for each process (pure in-memory, no DB queries)
  const takenSet = new Set(takenNumbers);
  const results: NextPackageNumber[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const process of processes as any[]) {
    const processCode = process.code;
    const existingNumbers = existingByProcess.get(processCode) ?? new Set<number>();

    // Find next available number (starting from 1)
    let nextNum = 1;
    while (existingNumbers.has(nextNum) && nextNum <= 9999) {
      nextNum++;
    }
    if (nextNum > 9999) nextNum = 1;

    const nextNumber = `N-${processCode}-${String(nextNum).padStart(4, "0")}`;

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
