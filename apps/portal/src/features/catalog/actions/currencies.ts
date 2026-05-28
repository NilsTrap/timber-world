"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { applyCharmRounding } from "../charmRounding";
import type { ActionResult, CatalogCurrency, RoundingRule } from "../types";

const ECB_DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

function toCurrency(row: any): CatalogCurrency {
  return {
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    isBase: row.is_base,
    exchangeRate: row.exchange_rate != null ? Number(row.exchange_rate) : null,
    rateSource: row.rate_source,
    rateFetchedAt: row.rate_fetched_at,
    roundingRule: row.rounding_rule ?? null,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

export async function getCurrencies(): Promise<ActionResult<CatalogCurrency[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_currencies")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map(toCurrency) };
}

export interface SaveCurrencyInput {
  code: string;
  name: string;
  symbol: string;
  roundingRule?: RoundingRule | null;
  isActive?: boolean;
  sortOrder?: number;
}

export async function saveCurrency(input: SaveCurrencyInput): Promise<ActionResult<CatalogCurrency>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const code = input.code.trim().toUpperCase();

  // Upsert by primary key (code). is_base is never set here (only EUR seeded as base).
  const { data, error } = await (supabase as any)
    .from("catalog_currencies")
    .upsert({
      code,
      name: input.name,
      symbol: input.symbol,
      rounding_rule: input.roundingRule ?? null,
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
    }, { onConflict: "code" })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/catalog/currencies");
  return { success: true, data: toCurrency(data) };
}

export async function deleteCurrency(code: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { data: cur } = await (supabase as any).from("catalog_currencies").select("is_base").eq("code", code).single();
  if (cur?.is_base) return { success: false, error: "The base currency (EUR) cannot be deleted.", code: "BASE_CURRENCY" };

  const { error } = await (supabase as any).from("catalog_currencies").delete().eq("code", code);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/catalog/currencies");
  return { success: true, data: null };
}

/**
 * Fetch the latest ECB EUR->code reference rate, then recompute and store
 * charm-rounded prices for every catalog entity that has an EUR price set.
 * Manually triggered — derived prices go stale until this runs again.
 */
export async function updateCurrencyPrices(
  code: string
): Promise<ActionResult<{ rate: number; updated: number; fetchedAt: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();

  const { data: currency, error: curErr } = await (supabase as any)
    .from("catalog_currencies").select("*").eq("code", code).single();
  if (curErr || !currency) return { success: false, error: "Currency not found" };
  if (currency.is_base) return { success: false, error: "The base currency needs no conversion." };

  // 1. Fetch ECB daily reference rate (units of `code` per 1 EUR).
  let rate: number;
  try {
    const res = await fetch(ECB_DAILY_URL, { cache: "no-store" });
    if (!res.ok) return { success: false, error: `ECB request failed (${res.status})` };
    const xml = await res.text();
    const match = new RegExp(`currency=['"]${code}['"]\\s+rate=['"]([0-9.]+)['"]`).exec(xml);
    if (!match || !match[1]) return { success: false, error: `ECB did not return a rate for ${code}` };
    rate = parseFloat(match[1]);
  } catch (e: any) {
    return { success: false, error: `Could not reach ECB: ${e?.message ?? "network error"}` };
  }

  const fetchedAt = new Date().toISOString();
  await (supabase as any)
    .from("catalog_currencies")
    .update({ exchange_rate: rate, rate_source: "ecb", rate_fetched_at: fetchedAt })
    .eq("code", code);

  const rule: RoundingRule | null = currency.rounding_rule ?? null;
  const convert = (eurCents: number): number => {
    const major = (eurCents / 100) * rate;
    return Math.round(applyCharmRounding(major, rule) * 100);
  };

  // 2. Collect every EUR price across categories / products / variants.
  const rows: { entity_type: string; entity_id: string; currency_code: string; price_cents: number }[] = [];

  const [{ data: cats }, { data: prods }, { data: vars }] = await Promise.all([
    (supabase as any).from("catalog_categories").select("id, default_price_eur_cents").not("default_price_eur_cents", "is", null),
    (supabase as any).from("catalog_products").select("id, base_price_eur_cents").not("base_price_eur_cents", "is", null),
    (supabase as any).from("catalog_variants").select("id, price_eur_cents").not("price_eur_cents", "is", null),
  ]);

  for (const c of cats || []) rows.push({ entity_type: "category", entity_id: c.id, currency_code: code, price_cents: convert(c.default_price_eur_cents) });
  for (const p of prods || []) rows.push({ entity_type: "product", entity_id: p.id, currency_code: code, price_cents: convert(p.base_price_eur_cents) });
  for (const v of vars || []) rows.push({ entity_type: "variant", entity_id: v.id, currency_code: code, price_cents: convert(v.price_eur_cents) });

  // 3. Replace this currency's derived prices.
  await (supabase as any).from("catalog_currency_prices").delete().eq("currency_code", code);
  if (rows.length > 0) {
    const { error: insErr } = await (supabase as any).from("catalog_currency_prices").insert(rows);
    if (insErr) return { success: false, error: insErr.message };
  }

  revalidatePath("/admin/catalog/currencies");
  return { success: true, data: { rate, updated: rows.length, fetchedAt } };
}
