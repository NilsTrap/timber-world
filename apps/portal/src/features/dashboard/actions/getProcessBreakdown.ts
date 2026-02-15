"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer } from "@/lib/auth";
import type { ActionResult, ProcessBreakdownItem } from "../types";

/**
 * Get Process Breakdown for Producer Dashboard
 *
 * Groups validated production entries by process, computing per-process:
 * - Total entries count
 * - Total input m3
 * - Total output m3
 * - Weighted average outcome %
 * - Weighted average waste %
 */
export async function getProcessBreakdown(): Promise<ActionResult<ProcessBreakdownItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isProducer(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Use currentOrganizationId (Epic 10) with fallback to organisationId (legacy)
  const orgId = session.currentOrganizationId || session.organisationId;
  if (!orgId) {
    return { success: false, error: "No organisation linked", code: "NO_ORGANISATION_LINK" };
  }

  const supabase = await createClient();

  // Fetch all validated entries for this organisation with process names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_production_entries")
    .select("process_id, total_input_m3, total_output_m3, ref_processes(value)")
    .eq("organisation_id", orgId)
    .eq("status", "validated");

  if (error) {
    return { success: false, error: error.message, code: "QUERY_FAILED" };
  }

  // Group by process_id
  const processMap = new Map<string, {
    processName: string;
    totalEntries: number;
    totalInputM3: number;
    totalOutputM3: number;
  }>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    const processId = row.process_id as string;
    const processName = row.ref_processes?.value ?? "Unknown";
    const inputM3 = Number(row.total_input_m3) || 0;
    const outputM3 = Number(row.total_output_m3) || 0;

    const existing = processMap.get(processId);
    if (existing) {
      existing.totalEntries += 1;
      existing.totalInputM3 += inputM3;
      existing.totalOutputM3 += outputM3;
    } else {
      processMap.set(processId, {
        processName,
        totalEntries: 1,
        totalInputM3: inputM3,
        totalOutputM3: outputM3,
      });
    }
  }

  // Build result with computed averages
  const breakdown: ProcessBreakdownItem[] = [];
  for (const [processId, stats] of processMap) {
    const avgOutcomePercent = stats.totalInputM3 > 0
      ? (stats.totalOutputM3 / stats.totalInputM3) * 100
      : 0;
    const avgWastePercent = stats.totalInputM3 > 0
      ? 100 - avgOutcomePercent
      : 0;

    breakdown.push({
      processId,
      processName: stats.processName,
      totalEntries: stats.totalEntries,
      totalInputM3: stats.totalInputM3,
      totalOutputM3: stats.totalOutputM3,
      avgOutcomePercent,
      avgWastePercent,
    });
  }

  // Sort by process name
  breakdown.sort((a, b) => a.processName.localeCompare(b.processName));

  return { success: true, data: breakdown };
}
