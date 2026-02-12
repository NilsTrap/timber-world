"use server";

import { createClient } from "@timber/database/server";
import type { DateRange } from "../types";

export interface VisitorEngagement {
  totalSessions: number;
  stockPageViewers: number;
  stockPageViewerPercent: number;
  journeyStarters: number;
  journeyStarterPercent: number;
  filterUsers: number;
  filterUserPercent: number;
  quoteFormViewers: number;
  quoteFormViewerPercent: number;
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

export async function getVisitorEngagement(
  dateRange: DateRange = "30d"
): Promise<ActionResult<VisitorEngagement>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);

    // Get total sessions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sessionsQuery = (supabase as any)
      .from("analytics_sessions")
      .select("session_id", { count: "exact" });

    if (dateFilter) {
      sessionsQuery = sessionsQuery.gte("created_at", dateFilter.toISOString());
    }

    const { count: totalSessions, error: sessionsError } = await sessionsQuery;

    if (sessionsError) {
      console.error("Failed to fetch sessions:", sessionsError);
      return { success: false, error: sessionsError.message };
    }

    const total = totalSessions || 0;

    if (total === 0) {
      return {
        success: true,
        data: {
          totalSessions: 0,
          stockPageViewers: 0,
          stockPageViewerPercent: 0,
          journeyStarters: 0,
          journeyStarterPercent: 0,
          filterUsers: 0,
          filterUserPercent: 0,
          quoteFormViewers: 0,
          quoteFormViewerPercent: 0,
        },
      };
    }

    // Get sessions that viewed stock pages (/products)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stockQuery = (supabase as any)
      .from("analytics_events")
      .select("session_id")
      .eq("event_name", "page_view")
      .like("page_path", "%/products%");

    if (dateFilter) {
      stockQuery = stockQuery.gte("created_at", dateFilter.toISOString());
    }

    const { data: stockData, error: stockError } = await stockQuery;

    if (stockError) {
      console.error("Failed to fetch stock viewers:", stockError);
      return { success: false, error: stockError.message };
    }

    const stockViewerSessions = new Set(
      (stockData || []).map((e: { session_id: string }) => e.session_id)
    );

    // Get sessions that started journey (viewed any journey stage)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let journeyQuery = (supabase as any)
      .from("analytics_events")
      .select("session_id")
      .eq("event_name", "journey_stage_view");

    if (dateFilter) {
      journeyQuery = journeyQuery.gte("created_at", dateFilter.toISOString());
    }

    const { data: journeyData, error: journeyError } = await journeyQuery;

    if (journeyError) {
      console.error("Failed to fetch journey starters:", journeyError);
      return { success: false, error: journeyError.message };
    }

    const journeyStarterSessions = new Set(
      (journeyData || []).map((e: { session_id: string }) => e.session_id)
    );

    // Get sessions that used filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filterQuery = (supabase as any)
      .from("analytics_events")
      .select("session_id")
      .eq("event_name", "filter_click");

    if (dateFilter) {
      filterQuery = filterQuery.gte("created_at", dateFilter.toISOString());
    }

    const { data: filterData, error: filterError } = await filterQuery;

    if (filterError) {
      console.error("Failed to fetch filter users:", filterError);
      return { success: false, error: filterError.message };
    }

    const filterUserSessions = new Set(
      (filterData || []).map((e: { session_id: string }) => e.session_id)
    );

    // Get sessions that viewed quote form
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let quoteQuery = (supabase as any)
      .from("analytics_events")
      .select("session_id")
      .eq("event_name", "quote_form_view");

    if (dateFilter) {
      quoteQuery = quoteQuery.gte("created_at", dateFilter.toISOString());
    }

    const { data: quoteData, error: quoteError } = await quoteQuery;

    if (quoteError) {
      console.error("Failed to fetch quote viewers:", quoteError);
      return { success: false, error: quoteError.message };
    }

    const quoteViewerSessions = new Set(
      (quoteData || []).map((e: { session_id: string }) => e.session_id)
    );

    const stockPageViewers = stockViewerSessions.size;
    const journeyStarters = journeyStarterSessions.size;
    const filterUsers = filterUserSessions.size;
    const quoteFormViewers = quoteViewerSessions.size;

    return {
      success: true,
      data: {
        totalSessions: total,
        stockPageViewers,
        stockPageViewerPercent: Math.round((stockPageViewers / total) * 100),
        journeyStarters,
        journeyStarterPercent: Math.round((journeyStarters / total) * 100),
        filterUsers,
        filterUserPercent: Math.round((filterUsers / total) * 100),
        quoteFormViewers,
        quoteFormViewerPercent: Math.round((quoteFormViewers / total) * 100),
      },
    };
  } catch (err) {
    console.error("Unexpected error fetching visitor engagement:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
