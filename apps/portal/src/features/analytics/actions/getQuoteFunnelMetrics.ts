"use server";

import { createClient } from "@timber/database/server";
import type { QuoteFunnelMetrics, DateRange } from "../types";

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

export async function getQuoteFunnelMetrics(
  dateRange: DateRange = "30d"
): Promise<ActionResult<QuoteFunnelMetrics>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("analytics_quote_funnels")
      .select("*");

    if (dateFilter) {
      query = query.gte("created_at", dateFilter.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch quote funnel metrics:", error);
      return { success: false, error: error.message };
    }

    // Calculate funnel metrics
    const funnels = data || [];
    const formViews = funnels.filter((f: { form_viewed: boolean }) => f.form_viewed).length;
    const fieldInteractions = funnels.filter((f: { fields_interacted: boolean }) => f.fields_interacted).length;
    const submissions = funnels.filter((f: { form_submitted: boolean }) => f.form_submitted).length;
    const successes = funnels.filter((f: { submission_success: boolean }) => f.submission_success).length;

    // Conversion rate: views to success
    const conversionRate = formViews > 0 ? (successes / formViews) * 100 : 0;

    // Average time on form (for submitted forms)
    const submittedWithTime = funnels.filter(
      (f: { form_submitted: boolean; time_on_form_ms: number | null }) =>
        f.form_submitted && f.time_on_form_ms != null
    );
    const totalTime = submittedWithTime.reduce(
      (sum: number, f: { time_on_form_ms: number }) => sum + f.time_on_form_ms,
      0
    );
    const avgTimeOnFormMs = submittedWithTime.length > 0 ? totalTime / submittedWithTime.length : 0;

    return {
      success: true,
      data: {
        formViews,
        fieldInteractions,
        submissions,
        successes,
        conversionRate: Math.round(conversionRate * 10) / 10,
        avgTimeOnFormMs: Math.round(avgTimeOnFormMs),
      },
    };
  } catch (err) {
    console.error("Unexpected error fetching quote funnel metrics:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
