"use server";

import { createClient } from "@timber/database/server";
import type { FilterUsage, DateRange } from "../types";

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

export async function getFilterUsage(
  dateRange: DateRange = "30d"
): Promise<ActionResult<FilterUsage[]>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);

    // Get filter click events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("analytics_events")
      .select("properties")
      .eq("event_name", "filter_click");

    if (dateFilter) {
      query = query.gte("created_at", dateFilter.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch filter usage:", error);
      return { success: false, error: error.message };
    }

    // Aggregate by filter name
    const filterCounts = new Map<string, number>();

    data.forEach((event: { properties: { filterName?: string } }) => {
      const filterName = event.properties?.filterName;
      if (!filterName) return;
      filterCounts.set(filterName, (filterCounts.get(filterName) || 0) + 1);
    });

    // Sort by usage count
    const sorted = Array.from(filterCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([filterName, usageCount]) => ({
        filterName,
        usageCount,
      }));

    return { success: true, data: sorted };
  } catch (err) {
    console.error("Unexpected error fetching filter usage:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
