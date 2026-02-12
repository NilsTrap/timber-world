"use server";

import { createClient } from "@timber/database/server";
import type { TopProduct, DateRange } from "../types";

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

export async function getProductMetrics(
  dateRange: DateRange = "30d",
  limit: number = 10
): Promise<ActionResult<TopProduct[]>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);

    // Get product view and product select events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("analytics_events")
      .select("properties")
      .in("event_name", ["product_view", "product_select"]);

    if (dateFilter) {
      query = query.gte("created_at", dateFilter.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch product metrics:", error);
      return { success: false, error: error.message };
    }

    // Aggregate by product
    const productCounts = new Map<string, { name: string; species: string | null; count: number }>();

    data.forEach((event: { properties: { productId?: string; productName?: string; species?: string } }) => {
      const props = event.properties || {};
      const productId = props.productId;
      if (!productId) return;

      const existing = productCounts.get(productId);
      if (existing) {
        existing.count++;
      } else {
        productCounts.set(productId, {
          name: props.productName || productId,
          species: props.species || null,
          count: 1,
        });
      }
    });

    // Sort and take top N
    const sorted = Array.from(productCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        species: data.species,
        viewCount: data.count,
      }));

    return { success: true, data: sorted };
  } catch (err) {
    console.error("Unexpected error fetching product metrics:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
