"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { JOURNEY_STAGES, PRODUCT_SLOTS, type MarketingText, type JourneySectionTexts, type HeroTexts, type ProductTexts, type ActionResult } from "../types";

/**
 * Database row shape (snake_case)
 */
interface MarketingTextRow {
  id: string;
  category: string;
  section: string;
  key: string;
  locale: string;
  value: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Transform database row to frontend type
 */
function transformRow(row: MarketingTextRow): MarketingText {
  return {
    id: row.id,
    category: row.category,
    section: row.section,
    key: row.key,
    locale: row.locale,
    value: row.value,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get Marketing Texts
 *
 * Fetches all marketing texts for a category and locale.
 * Admin only endpoint.
 */
export async function getMarketingTexts(
  category: string = "journey",
  locale: string = "en"
): Promise<ActionResult<MarketingText[]>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Check admin role
  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  const supabase = await createClient();

  // 3. Fetch texts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("marketing_texts")
    .select("*")
    .eq("category", category)
    .eq("locale", locale)
    .order("sort_order");

  if (error) {
    console.error("Failed to fetch marketing texts:", error);
    return {
      success: false,
      error: "Failed to fetch texts",
      code: "FETCH_FAILED",
    };
  }

  return {
    success: true,
    data: (data as MarketingTextRow[]).map(transformRow),
  };
}

/**
 * Get Journey Texts Grouped by Section
 *
 * Returns texts organized by journey stage with substages.
 */
export async function getJourneyTextsGrouped(
  locale: string = "en"
): Promise<ActionResult<JourneySectionTexts[]>> {
  const result = await getMarketingTexts("journey", locale);

  if (!result.success) {
    return result;
  }

  const texts = result.data;
  const textMap = new Map<string, string>();

  // Build a map of section.key -> value
  for (const text of texts) {
    textMap.set(`${text.section}.${text.key}`, text.value);
  }

  // Group by journey stages
  const grouped: JourneySectionTexts[] = JOURNEY_STAGES.map((stage) => ({
    section: stage.key,
    title: textMap.get(`${stage.key}.title`) || stage.label,
    description: textMap.get(`${stage.key}.description`) || "",
    substages: stage.substages.map((substage) => ({
      key: substage,
      title: textMap.get(`${stage.key}.${substage}Title`) || substage,
      description: textMap.get(`${stage.key}.${substage}Description`) || "",
    })),
  }));

  return {
    success: true,
    data: grouped,
  };
}

/**
 * Get Hero Texts
 *
 * Returns hero section texts (slogan and subtitle).
 */
export async function getHeroTexts(
  locale: string = "en"
): Promise<ActionResult<HeroTexts>> {
  const result = await getMarketingTexts("hero", locale);

  if (!result.success) {
    return result;
  }

  const texts = result.data;
  const textMap = new Map<string, string>();

  for (const text of texts) {
    textMap.set(text.key, text.value);
  }

  return {
    success: true,
    data: {
      slogan: textMap.get("slogan") || "From Forest to Product",
      subtitle: textMap.get("subtitle") || "We Take Care of It",
    },
  };
}

/**
 * Get Product Texts
 *
 * Returns product titles and descriptions.
 */
export async function getProductTexts(
  locale: string = "en"
): Promise<ActionResult<ProductTexts[]>> {
  const result = await getMarketingTexts("products", locale);

  if (!result.success) {
    return result;
  }

  const texts = result.data;
  const textMap = new Map<string, string>();

  for (const text of texts) {
    textMap.set(`${text.section}.${text.key}`, text.value);
  }

  const products: ProductTexts[] = PRODUCT_SLOTS.map((slot) => ({
    key: slot.key,
    title: textMap.get(`${slot.key}.title`) || slot.label,
    description: textMap.get(`${slot.key}.description`) || "",
  }));

  return {
    success: true,
    data: products,
  };
}
