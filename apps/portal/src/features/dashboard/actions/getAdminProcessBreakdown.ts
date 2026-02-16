"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, isSuperAdmin } from "@/lib/auth";
import type {
  ActionResult,
  AdminProcessBreakdownItem,
  DateRange,
  TrendDirection,
} from "../types";

interface ProcessStats {
  processName: string;
  totalEntries: number;
  totalInputM3: number;
  totalOutputM3: number;
  totalPlannedWork: number;
  totalActualWork: number;
  workUnit: string | null;
}

/**
 * Calculate trend direction based on percentage point change
 * - Up if improvement > 1%
 * - Down if decline > 1%
 * - Stable if within ±1%
 */
function calculateTrend(
  currentOutcome: number,
  previousOutcome: number
): { trend: TrendDirection; trendValue: number } {
  const trendValue = currentOutcome - previousOutcome;

  if (trendValue > 1) {
    return { trend: "up", trendValue };
  } else if (trendValue < -1) {
    return { trend: "down", trendValue };
  }
  return { trend: "stable", trendValue };
}

/**
 * Calculate the previous period date range
 * Previous period has the same duration as current, ending where current starts
 */
function getPreviousPeriodRange(dateRange: DateRange): DateRange {
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  const durationMs = end.getTime() - start.getTime();

  const prevEnd = new Date(start.getTime() - 1); // 1ms before current start
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return {
    start: prevStart.toISOString(),
    end: prevEnd.toISOString(),
  };
}

/**
 * Fetch and aggregate production entries by process
 */
async function fetchProcessStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  dateRange?: DateRange,
  orgIds?: string[]
): Promise<Map<string, ProcessStats>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("portal_production_entries")
    .select("process_id, total_input_m3, total_output_m3, planned_work, actual_work, ref_processes(value, work_unit)")
    .eq("status", "validated");

  // Apply org filter when specified (multi-select)
  if (orgIds && orgIds.length > 0) {
    query = query.in("organisation_id", orgIds);
  }

  if (dateRange) {
    query = query.gte("validated_at", dateRange.start);
    if (dateRange.end) {
      query = query.lte("validated_at", dateRange.end);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getAdminProcessBreakdown] Query failed:", error.message);
    throw new Error(error.message);
  }

  const processMap = new Map<string, ProcessStats>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    const processId = row.process_id as string;
    const processName = row.ref_processes?.value ?? "Unknown";
    const workUnit = row.ref_processes?.work_unit ?? null;
    const inputM3 = Number(row.total_input_m3) || 0;
    const outputM3 = Number(row.total_output_m3) || 0;
    const plannedWork = Number(row.planned_work) || 0;
    const actualWork = Number(row.actual_work) || 0;

    const existing = processMap.get(processId);
    if (existing) {
      existing.totalEntries += 1;
      existing.totalInputM3 += inputM3;
      existing.totalOutputM3 += outputM3;
      existing.totalPlannedWork += plannedWork;
      existing.totalActualWork += actualWork;
    } else {
      processMap.set(processId, {
        processName,
        totalEntries: 1,
        totalInputM3: inputM3,
        totalOutputM3: outputM3,
        totalPlannedWork: plannedWork,
        totalActualWork: actualWork,
        workUnit,
      });
    }
  }

  return processMap;
}

/**
 * Get Admin Process Breakdown with Trend Indicators
 *
 * Groups validated production entries by process across ALL producers.
 * Computes per-process stats and trend compared to previous period.
 *
 * @param dateRange - Optional date range filter
 * @param orgIds - Optional org IDs for Super Admin to filter by specific organisations (multi-select)
 */
export async function getAdminProcessBreakdown(
  dateRange?: DateRange,
  orgIds?: string[]
): Promise<ActionResult<AdminProcessBreakdownItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Determine org filter for Super Admin
  const effectiveOrgIds = isSuperAdmin(session) ? orgIds : undefined;

  try {
    // Fetch current period stats
    const currentStats = await fetchProcessStats(supabase, dateRange, effectiveOrgIds);

    // Fetch previous period stats for trend calculation (only if date range specified)
    let previousStats: Map<string, ProcessStats> | null = null;
    if (dateRange) {
      const previousRange = getPreviousPeriodRange(dateRange);
      previousStats = await fetchProcessStats(supabase, previousRange, effectiveOrgIds);
    }

    // Build result with computed averages and trends
    const breakdown: AdminProcessBreakdownItem[] = [];

    for (const [processId, stats] of currentStats) {
      const avgOutcomePercent =
        stats.totalInputM3 > 0
          ? (stats.totalOutputM3 / stats.totalInputM3) * 100
          : 0;
      const avgWastePercent =
        stats.totalInputM3 > 0 ? 100 - avgOutcomePercent : 0;

      // Calculate trend vs previous period
      let trend: TrendDirection = "stable";
      let trendValue = 0;

      if (previousStats) {
        const prevProcessStats = previousStats.get(processId);
        if (prevProcessStats && prevProcessStats.totalInputM3 > 0) {
          const prevOutcome =
            (prevProcessStats.totalOutputM3 / prevProcessStats.totalInputM3) * 100;
          const trendResult = calculateTrend(avgOutcomePercent, prevOutcome);
          trend = trendResult.trend;
          trendValue = trendResult.trendValue;
        }
      }

      breakdown.push({
        processId,
        processName: stats.processName,
        totalEntries: stats.totalEntries,
        totalInputM3: stats.totalInputM3,
        totalOutputM3: stats.totalOutputM3,
        avgOutcomePercent,
        avgWastePercent,
        trend,
        trendValue,
        totalPlannedWork: stats.totalPlannedWork,
        totalActualWork: stats.totalActualWork,
        workUnit: stats.workUnit,
      });
    }

    // Sort by process name
    breakdown.sort((a, b) => a.processName.localeCompare(b.processName));

    return { success: true, data: breakdown };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message, code: "QUERY_FAILED" };
  }
}
