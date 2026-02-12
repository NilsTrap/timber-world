"use server";

import { createClient } from "@timber/database/server";
import type { DateRange } from "../types";

export interface ConsentMetrics {
  totalDecisions: number;
  accepted: number;
  acceptedPercent: number;
  rejected: number;
  rejectedPercent: number;
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

export async function getConsentMetrics(
  dateRange: DateRange = "30d"
): Promise<ActionResult<ConsentMetrics>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);

    // Get consent decision events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("analytics_events")
      .select("properties")
      .eq("event_name", "consent_decision");

    if (dateFilter) {
      query = query.gte("created_at", dateFilter.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch consent metrics:", error);
      return { success: false, error: error.message };
    }

    let accepted = 0;
    let rejected = 0;

    (data || []).forEach(
      (event: { properties: { decision?: string } }) => {
        const decision = event.properties?.decision;
        if (decision === "accepted") {
          accepted++;
        } else if (decision === "rejected") {
          rejected++;
        }
      }
    );

    const totalDecisions = accepted + rejected;

    return {
      success: true,
      data: {
        totalDecisions,
        accepted,
        acceptedPercent: totalDecisions > 0 ? Math.round((accepted / totalDecisions) * 100) : 0,
        rejected,
        rejectedPercent: totalDecisions > 0 ? Math.round((rejected / totalDecisions) * 100) : 0,
      },
    };
  } catch (err) {
    console.error("Unexpected error fetching consent metrics:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
