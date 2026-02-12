"use server";

import { createClient } from "@timber/database/server";
import type { DateRange } from "../types";

export interface FilterValueUsage {
  value: string;
  count: number;
}

export interface DetailedFilterUsage {
  filterName: string;
  totalClicks: number;
  values: FilterValueUsage[];
}

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

export async function getDetailedFilterUsage(
  dateRange: DateRange = "30d"
): Promise<ActionResult<DetailedFilterUsage[]>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);

    // Get all filter click events
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

    // Aggregate by filter name and value
    const filterMap = new Map<string, Map<string, number>>();

    (data || []).forEach(
      (event: { properties: { filterName?: string; filterValue?: string; action?: string } }) => {
        const props = event.properties || {};
        const filterName = props.filterName;
        const filterValue = props.filterValue;
        // Only count "add" actions (not "remove")
        const action = props.action;

        if (!filterName || !filterValue || action !== "add") return;

        if (!filterMap.has(filterName)) {
          filterMap.set(filterName, new Map());
        }

        const valueMap = filterMap.get(filterName)!;
        valueMap.set(filterValue, (valueMap.get(filterValue) || 0) + 1);
      }
    );

    // Convert to array and sort
    const result: DetailedFilterUsage[] = Array.from(filterMap.entries())
      .map(([filterName, valueMap]) => {
        const values = Array.from(valueMap.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count);

        const totalClicks = values.reduce((sum, v) => sum + v.count, 0);

        return {
          filterName,
          totalClicks,
          values,
        };
      })
      .sort((a, b) => b.totalClicks - a.totalClicks);

    return { success: true, data: result };
  } catch (err) {
    console.error("Unexpected error fetching detailed filter usage:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
