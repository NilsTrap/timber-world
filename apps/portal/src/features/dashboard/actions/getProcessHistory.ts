"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type {
  ActionResult,
  ProcessDetailData,
  ProcessHistoryItem,
  ChartDataPoint,
  DateRange,
} from "../types";

/**
 * Get Process History for Detail View
 *
 * Fetches production entries for a specific process across all organisations.
 * Includes:
 * - List of recent entries (date, input, output, outcome %)
 * - Chart data (outcome % over time)
 * - Best and worst performing entries
 *
 * @param processId - The process UUID to fetch history for
 * @param dateRange - Optional date range filter
 */
export async function getProcessHistory(
  processId: string,
  dateRange?: DateRange
): Promise<ActionResult<ProcessDetailData>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!processId) {
    return { success: false, error: "Process ID is required", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Fetch process name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: processData, error: processError } = await (supabase as any)
    .from("ref_processes")
    .select("value")
    .eq("id", processId)
    .single();

  if (processError) {
    console.error("[getProcessHistory] Failed to fetch process:", processError.message);
    return { success: false, error: "Process not found", code: "NOT_FOUND" };
  }

  const processName = processData?.value ?? "Unknown";

  // Fetch validated entries for this process
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("portal_production_entries")
    .select("id, validated_at, total_input_m3, total_output_m3, created_by")
    .eq("process_id", processId)
    .eq("status", "validated")
    .order("validated_at", { ascending: false });

  if (dateRange) {
    query = query.gte("validated_at", dateRange.start);
    if (dateRange.end) {
      query = query.lte("validated_at", dateRange.end);
    }
  }

  // Limit to recent 50 entries for performance
  query = query.limit(50);

  const { data: entries, error: entriesError } = await query;

  if (entriesError) {
    console.error("[getProcessHistory] Failed to fetch entries:", entriesError.message);
    return { success: false, error: entriesError.message, code: "QUERY_FAILED" };
  }

  const historyItems: ProcessHistoryItem[] = [];
  const chartData: ChartDataPoint[] = [];
  let bestEntry: ProcessHistoryItem | null = null;
  let worstEntry: ProcessHistoryItem | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const entry of (entries ?? []) as any[]) {
    const inputM3 = Number(entry.total_input_m3) || 0;
    const outputM3 = Number(entry.total_output_m3) || 0;
    const outcomePercent = inputM3 > 0 ? (outputM3 / inputM3) * 100 : 0;
    const date = entry.validated_at?.split("T")[0] ?? "";

    const historyItem: ProcessHistoryItem = {
      entryId: entry.id,
      date,
      inputM3,
      outputM3,
      outcomePercent,
      createdBy: entry.created_by ?? "Unknown",
    };

    historyItems.push(historyItem);

    // Chart data (reverse order for chronological display)
    chartData.unshift({
      date,
      outcomePercent,
    });

    // Track best and worst entries (only entries with input > 0)
    if (inputM3 > 0) {
      if (!bestEntry || outcomePercent > bestEntry.outcomePercent) {
        bestEntry = historyItem;
      }
      if (!worstEntry || outcomePercent < worstEntry.outcomePercent) {
        worstEntry = historyItem;
      }
    }
  }

  return {
    success: true,
    data: {
      processId,
      processName,
      historyItems,
      chartData,
      bestEntry,
      worstEntry,
    },
  };
}
