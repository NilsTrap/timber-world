"use server";

import { createClient } from "@timber/database/server";
import type { VisitorsByDay, DateRange } from "../types";

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

function getDaysInRange(dateRange: DateRange): number {
  switch (dateRange) {
    case "today":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "all":
    default:
      return 30; // Default to 30 days for "all time" chart
  }
}

/**
 * Format a Date as YYYY-MM-DD in UTC (to match database timestamps)
 */
function formatDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get unique visitors grouped by day
 *
 * Returns daily visitor counts for the selected date range.
 * For "all time", returns the last 30 days of data.
 */
export async function getVisitorsByDay(
  dateRange: DateRange = "30d",
  excludeBots: boolean = true
): Promise<ActionResult<VisitorsByDay[]>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);
    const daysInRange = getDaysInRange(dateRange);

    // Build query for sessions - include ip_address for unique visitor counting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("analytics_sessions")
      .select("session_id, first_seen_at, ip_address");

    if (dateFilter) {
      query = query.gte("created_at", dateFilter.toISOString());
    }
    if (excludeBots) {
      query = query.eq("is_bot", false);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error("Failed to fetch sessions for visitors by day:", error);
      return { success: false, error: error.message };
    }

    // Use UTC "today" to match database timestamps
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (!sessions || sessions.length === 0) {
      // No sessions found, return empty array with all days as 0
      const result: VisitorsByDay[] = [];

      for (let i = daysInRange - 1; i >= 0; i--) {
        const date = new Date(todayUTC);
        date.setUTCDate(date.getUTCDate() - i);
        result.push({ date: formatDateUTC(date), visitorCount: 0 });
      }

      return { success: true, data: result };
    }

    // Group sessions by date (YYYY-MM-DD in UTC)
    // Count unique visitors by IP address (not session_id)
    const visitorsByDate = new Map<string, Set<string>>();

    sessions.forEach((session: { session_id: string; first_seen_at: string; ip_address: string | null }) => {
      if (!session.first_seen_at) return;
      // Use IP address for unique visitor counting, fall back to session_id if no IP
      const visitorId = session.ip_address || session.session_id;
      // Extract YYYY-MM-DD from ISO timestamp
      const dateParts = session.first_seen_at.split("T");
      const date = dateParts[0] ?? session.first_seen_at.slice(0, 10);
      if (!visitorsByDate.has(date)) {
        visitorsByDate.set(date, new Set());
      }
      visitorsByDate.get(date)!.add(visitorId);
    });

    // Generate all dates in range (to fill gaps with 0)
    const result: VisitorsByDay[] = [];

    for (let i = daysInRange - 1; i >= 0; i--) {
      const date = new Date(todayUTC);
      date.setUTCDate(date.getUTCDate() - i);
      const dateStr = formatDateUTC(date);

      const visitors = visitorsByDate.get(dateStr);
      result.push({
        date: dateStr,
        visitorCount: visitors ? visitors.size : 0,
      });
    }

    return { success: true, data: result };
  } catch (err) {
    console.error("Unexpected error fetching visitors by day:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
