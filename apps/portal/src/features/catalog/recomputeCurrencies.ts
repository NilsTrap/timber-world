import { createClient } from "@/lib/supabase/server";
import { applyCharmRounding } from "./charmRounding";
import type { RoundingRule } from "./types";

/**
 * Keep an entity's derived-currency prices in sync after its EUR price changes.
 * For each active non-base currency that has a rate:
 *  - manual overrides are left untouched,
 *  - a null EUR price drops the auto row (so it falls back to inheritance),
 *  - otherwise the charm-rounded converted price is upserted as an auto row.
 * Runs within a server action (admin cookies satisfy RLS).
 */
export async function recomputeEntityCurrencies(
  entityType: "category" | "product" | "variant",
  entityId: string,
  eurCents: number | null
): Promise<void> {
  const supabase = await createClient();

  const { data: currencies } = await (supabase as any)
    .from("catalog_currencies")
    .select("code, exchange_rate, rounding_rule")
    .eq("is_base", false)
    .eq("is_active", true);

  for (const cur of currencies || []) {
    if (cur.exchange_rate == null) continue;
    const code = cur.code;

    const { data: existing } = await (supabase as any)
      .from("catalog_currency_prices")
      .select("is_manual")
      .match({ entity_type: entityType, entity_id: entityId, currency_code: code })
      .maybeSingle();
    if (existing?.is_manual) continue; // never clobber a hand-set price

    if (eurCents == null) {
      await (supabase as any)
        .from("catalog_currency_prices")
        .delete()
        .match({ entity_type: entityType, entity_id: entityId, currency_code: code, is_manual: false });
      continue;
    }

    const rule: RoundingRule | null = cur.rounding_rule ?? null;
    const major = (eurCents / 100) * Number(cur.exchange_rate);
    const priceCents = Math.round(applyCharmRounding(major, rule) * 100);

    await (supabase as any)
      .from("catalog_currency_prices")
      .upsert({
        entity_type: entityType, entity_id: entityId, currency_code: code,
        price_cents: priceCents, is_manual: false,
      }, { onConflict: "entity_type,entity_id,currency_code" });
  }
}
