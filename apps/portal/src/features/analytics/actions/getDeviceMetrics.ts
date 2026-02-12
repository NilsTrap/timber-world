"use server";

import { createClient } from "@timber/database/server";
import type { DeviceBreakdown, BrowserBreakdown, DateRange } from "../types";

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

export async function getDeviceBreakdown(
  dateRange: DateRange = "30d",
  excludeBots: boolean = true
): Promise<ActionResult<DeviceBreakdown[]>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("analytics_sessions")
      .select("device_type");

    if (dateFilter) {
      query = query.gte("created_at", dateFilter.toISOString());
    }
    if (excludeBots) {
      query = query.eq("is_bot", false);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch device breakdown:", error);
      return { success: false, error: error.message };
    }

    // Aggregate by device type
    const deviceCounts = new Map<string, number>();
    data.forEach((session: { device_type: string | null }) => {
      const deviceType = session.device_type || "unknown";
      deviceCounts.set(deviceType, (deviceCounts.get(deviceType) || 0) + 1);
    });

    const total = data.length;

    // Sort by count
    const sorted = Array.from(deviceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([deviceType, count]) => ({
        deviceType,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }));

    return { success: true, data: sorted };
  } catch (err) {
    console.error("Unexpected error fetching device breakdown:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getBrowserBreakdown(
  dateRange: DateRange = "30d",
  excludeBots: boolean = true
): Promise<ActionResult<BrowserBreakdown[]>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("analytics_sessions")
      .select("browser");

    if (dateFilter) {
      query = query.gte("created_at", dateFilter.toISOString());
    }
    if (excludeBots) {
      query = query.eq("is_bot", false);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch browser breakdown:", error);
      return { success: false, error: error.message };
    }

    // Aggregate by browser
    const browserCounts = new Map<string, number>();
    data.forEach((session: { browser: string | null }) => {
      const browser = session.browser || "unknown";
      browserCounts.set(browser, (browserCounts.get(browser) || 0) + 1);
    });

    const total = data.length;

    // Sort by count
    const sorted = Array.from(browserCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([browser, count]) => ({
        browser,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }));

    return { success: true, data: sorted };
  } catch (err) {
    console.error("Unexpected error fetching browser breakdown:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
