"use server";

import { createClient } from "@timber/database/server";
import type { VisitorsByCountry, DateRange } from "../types";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ISO 3166-1 alpha-2 country names (common subset)
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  CZ: "Czech Republic",
  PL: "Poland",
  SK: "Slovakia",
  HU: "Hungary",
  RO: "Romania",
  BG: "Bulgaria",
  IT: "Italy",
  ES: "Spain",
  PT: "Portugal",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IE: "Ireland",
  CA: "Canada",
  AU: "Australia",
  NZ: "New Zealand",
  JP: "Japan",
  CN: "China",
  IN: "India",
  BR: "Brazil",
  MX: "Mexico",
  AR: "Argentina",
};

function getCountryName(code: string | null): string {
  if (!code) return "Unknown";
  return COUNTRY_NAMES[code.toUpperCase()] || code.toUpperCase();
}

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

export async function getVisitorsByCountry(
  dateRange: DateRange = "30d",
  excludeBots: boolean = true,
  limit: number = 10
): Promise<ActionResult<VisitorsByCountry[]>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("analytics_sessions")
      .select("country_code");

    if (dateFilter) {
      query = query.gte("created_at", dateFilter.toISOString());
    }
    if (excludeBots) {
      query = query.eq("is_bot", false);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch visitors by country:", error);
      return { success: false, error: error.message };
    }

    // Aggregate by country
    const countryCounts = new Map<string, number>();
    data.forEach((session: { country_code: string | null }) => {
      const code = session.country_code || "UNKNOWN";
      countryCounts.set(code, (countryCounts.get(code) || 0) + 1);
    });

    const total = data.length;

    // Sort and take top N
    const sorted = Array.from(countryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([code, count]) => ({
        countryCode: code,
        countryName: getCountryName(code),
        visitorCount: count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }));

    return { success: true, data: sorted };
  } catch (err) {
    console.error("Unexpected error fetching visitors by country:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
