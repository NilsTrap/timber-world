"use server";

import { createClient } from "@timber/database/server";
import type { JourneyStageView, DateRange } from "../types";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function getDateFilter(dateRange: DateRange): Date | null {
  const now = new Date();
  switch (dateRange) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "all":
    default:
      return null;
  }
}

export async function getJourneyMetrics(
  dateRange: DateRange = "30d"
): Promise<ActionResult<JourneyStageView[]>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);

    // Get journey stage view events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("analytics_events")
      .select("properties")
      .eq("event_name", "journey_stage_view");

    if (dateFilter) {
      query = query.gte("created_at", dateFilter.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch journey metrics:", error);
      return { success: false, error: error.message };
    }

    // Aggregate by stage number
    const stageCounts = new Map<number, { name: string; count: number }>();

    data.forEach((event: { properties: { stageNumber?: number; stageName?: string } }) => {
      const stageNumber = event.properties?.stageNumber;
      const stageName = event.properties?.stageName || `Stage ${stageNumber}`;
      if (stageNumber == null) return;

      const existing = stageCounts.get(stageNumber);
      if (existing) {
        existing.count++;
      } else {
        stageCounts.set(stageNumber, { name: stageName, count: 1 });
      }
    });

    // Sort by stage number and calculate dropoff
    const sorted = Array.from(stageCounts.entries())
      .sort((a, b) => a[0] - b[0]);

    // Calculate dropoff rates
    const result: JourneyStageView[] = sorted.map(([stageNumber, data], index) => {
      const prevItem = index > 0 ? sorted[index - 1] : undefined;
      const previousCount = prevItem ? prevItem[1].count : data.count;
      const dropoffRate = previousCount > 0
        ? Math.round(((previousCount - data.count) / previousCount) * 1000) / 10
        : 0;

      return {
        stageNumber,
        stageName: data.name,
        viewCount: data.count,
        dropoffRate: Math.max(0, dropoffRate), // Can't have negative dropoff
      };
    });

    return { success: true, data: result };
  } catch (err) {
    console.error("Unexpected error fetching journey metrics:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
