"use server";

import { createClient } from "@timber/database/server";
import type { AnalyticsOverview, DateRange } from "../types";

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

export async function getAnalyticsOverview(
  dateRange: DateRange = "30d",
  excludeBots: boolean = true
): Promise<ActionResult<AnalyticsOverview>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);

    // Build base query for sessions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sessionsQuery = (supabase as any)
      .from("analytics_sessions")
      .select("id, session_id, is_bot, first_seen_at, last_seen_at");

    if (dateFilter) {
      sessionsQuery = sessionsQuery.gte("created_at", dateFilter.toISOString());
    }
    if (excludeBots) {
      sessionsQuery = sessionsQuery.eq("is_bot", false);
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery;

    if (sessionsError) {
      console.error("Failed to fetch sessions:", sessionsError);
      return { success: false, error: sessionsError.message };
    }

    // Build query for page views
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let eventsQuery = (supabase as any)
      .from("analytics_events")
      .select("id, session_id, event_name");

    if (dateFilter) {
      eventsQuery = eventsQuery.gte("created_at", dateFilter.toISOString());
    }

    const { data: events, error: eventsError } = await eventsQuery;

    if (eventsError) {
      console.error("Failed to fetch events:", eventsError);
      return { success: false, error: eventsError.message };
    }

    // Filter events by non-bot sessions if excluding bots
    const validSessionIds = excludeBots
      ? new Set(sessions.map((s: { session_id: string }) => s.session_id))
      : new Set(sessions.map((s: { session_id: string }) => s.session_id));

    const filteredEvents = events.filter((e: { session_id: string }) =>
      validSessionIds.has(e.session_id)
    );

    const pageViews = filteredEvents.filter(
      (e: { event_name: string }) => e.event_name === "page_view"
    );

    // Calculate metrics
    const totalSessions = sessions.length;
    const totalPageViews = pageViews.length;
    const uniqueVisitors = new Set(sessions.map((s: { session_id: string }) => s.session_id)).size;

    // Bounce rate: sessions with only 1 page view
    const sessionPageCounts = new Map<string, number>();
    pageViews.forEach((e: { session_id: string }) => {
      sessionPageCounts.set(e.session_id, (sessionPageCounts.get(e.session_id) || 0) + 1);
    });
    const bouncedSessions = Array.from(sessionPageCounts.values()).filter(count => count === 1).length;
    const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;

    // Average session duration
    let totalDuration = 0;
    let sessionsWithDuration = 0;
    sessions.forEach((s: { first_seen_at: string; last_seen_at: string }) => {
      const first = new Date(s.first_seen_at).getTime();
      const last = new Date(s.last_seen_at).getTime();
      const duration = last - first;
      if (duration > 0) {
        totalDuration += duration;
        sessionsWithDuration++;
      }
    });
    const avgSessionDurationMs = sessionsWithDuration > 0 ? totalDuration / sessionsWithDuration : 0;

    // Bot percentage (from all sessions, not filtered)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allSessionsQuery = (supabase as any)
      .from("analytics_sessions")
      .select("is_bot");
    if (dateFilter) {
      allSessionsQuery = allSessionsQuery.gte("created_at", dateFilter.toISOString());
    }
    const { data: allSessions } = await allSessionsQuery;
    const botCount = allSessions?.filter((s: { is_bot: boolean }) => s.is_bot).length || 0;
    const botPercentage = allSessions?.length > 0 ? (botCount / allSessions.length) * 100 : 0;

    return {
      success: true,
      data: {
        totalSessions,
        totalPageViews,
        uniqueVisitors,
        bounceRate: Math.round(bounceRate * 10) / 10,
        avgSessionDurationMs: Math.round(avgSessionDurationMs),
        botPercentage: Math.round(botPercentage * 10) / 10,
      },
    };
  } catch (err) {
    console.error("Unexpected error fetching analytics overview:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
