"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { CompetitorPriceDb, ActionResult, PricingFilters } from "../types";

/**
 * Get competitor pricing data with optional filters
 */
export async function getCompetitorPrices(
  filters?: PricingFilters
): Promise<ActionResult<CompetitorPriceDb[]>> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  const supabase = await createClient();

  // Build query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("competitor_prices")
    .select("*")
    .order("thickness_mm", { ascending: true })
    .order("width_mm", { ascending: true })
    .order("length_mm", { ascending: true });

  // Apply filters
  if (filters?.source) {
    query = query.eq("source", filters.source);
  }
  if (filters?.thickness) {
    query = query.eq("thickness_mm", filters.thickness);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch competitor prices:", error);
    return {
      success: false,
      error: "Failed to fetch competitor prices",
      code: "FETCH_FAILED",
    };
  }

  return {
    success: true,
    data: data as CompetitorPriceDb[],
  };
}

/**
 * Get unique sources from competitor prices
 */
export async function getCompetitorSources(): Promise<ActionResult<string[]>> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("competitor_prices")
    .select("source")
    .order("source");

  if (error) {
    console.error("Failed to fetch sources:", error);
    return {
      success: false,
      error: "Failed to fetch sources",
      code: "FETCH_FAILED",
    };
  }

  // Get unique sources
  const sources = [...new Set((data as { source: string }[]).map((d) => d.source))];

  return {
    success: true,
    data: sources,
  };
}

/**
 * Get unique thicknesses from competitor prices
 */
export async function getCompetitorThicknesses(
  source?: string
): Promise<ActionResult<number[]>> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("competitor_prices")
    .select("thickness_mm")
    .order("thickness_mm");

  if (source) {
    query = query.eq("source", source);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch thicknesses:", error);
    return {
      success: false,
      error: "Failed to fetch thicknesses",
      code: "FETCH_FAILED",
    };
  }

  // Get unique thicknesses
  const thicknesses = [
    ...new Set((data as { thickness_mm: number }[]).map((d) => d.thickness_mm)),
  ];

  return {
    success: true,
    data: thicknesses,
  };
}
