/**
 * E5 · Catalog → deal line resolver.
 *
 * Turns a chosen catalog variant into a ready-to-insert deal line item:
 * resolves the per-unit price (EUR base cascade, or the derived currency from
 * catalog_currency_prices), the billable unit, the variant's dimensions, and
 * the attribute option ids (so order_line_items.*_option_id get populated).
 *
 * Reuses the canonical catalog pricing primitives (effectiveRateEurCents /
 * computeQuantity) so the deal editor prices standard products the same way
 * the agent storefront does — no duplicated math.
 *
 * Pure helpers are unit-tested; the DB function takes a caller-chosen client.
 */
import { effectiveRateEurCents, computeQuantity, type Dimensions } from "./pricing";
import type { CalcMethod } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = any;

/** catalog_pricing_units.calc_method → order_line_items.unit */
export function calcMethodToLineUnit(calc: CalcMethod): string {
  switch (calc) {
    case "area":
      return "m2";
    case "volume":
      return "m3";
    case "length":
      return "linear_m";
    case "per_piece":
      return "piece";
    default:
      return "m3";
  }
}

/** Map a catalog field_key to the order_line_items attribute + option column. */
export const FIELD_KEY_TO_LINE_ATTR: Record<
  string,
  { value: keyof CatalogLineAttrs; option: keyof CatalogLineAttrs }
> = {
  wood_species: { value: "woodSpecies", option: "woodSpeciesOptionId" },
  humidity: { value: "humidity", option: "humidityOptionId" },
  processing: { value: "processing", option: "processingOptionId" },
  quality: { value: "quality", option: "qualityOptionId" },
  panel_type: { value: "productType", option: "productTypeOptionId" },
};

export interface CatalogLineAttrs {
  productName: string | null;
  woodSpecies: string | null;
  humidity: string | null;
  processing: string | null;
  quality: string | null;
  productType: string | null;
  woodSpeciesOptionId: string | null;
  humidityOptionId: string | null;
  processingOptionId: string | null;
  qualityOptionId: string | null;
  productTypeOptionId: string | null;
}

export interface ResolvedCatalogLine extends CatalogLineAttrs {
  catalogProductId: string;
  catalogVariantId: string;
  isStandard: true;
  unit: string;
  unitPriceCents: number | null; // per-unit rate in the deal currency; null if no price set
  thickness: string | null;
  width: string | null;
  length: string | null;
  /** Billable quantity for one unit of the variant (for area/volume/length). */
  calcMethod: CalcMethod;
  currency: string;
}

function mmToText(v: number | null | undefined): string | null {
  return v == null ? null : String(v);
}

/**
 * Resolve a catalog variant into deal-line fields priced in `currency`
 * (the deal's currency; EUR uses the base cascade, others use the derived
 * catalog_currency_prices cascade). Returns null on unknown variant.
 */
export async function resolveCatalogLine(
  db: DbClient,
  variantId: string,
  currency: string,
): Promise<ResolvedCatalogLine | null> {
  const c = db as DbClient;

  const { data: variant } = await c
    .from("catalog_variants")
    .select(
      "id, product_id, price_eur_cents, thickness_mm, width_mm, length_mm, " +
        "catalog_products(id, name, category_id, base_price_eur_cents, " +
        "catalog_categories(id, primary_unit, default_price_eur_cents))",
    )
    .eq("id", variantId)
    .maybeSingle();
  if (!variant) return null;

  const product = variant.catalog_products;
  const category = product?.catalog_categories;
  if (!product || !category) return null;

  // calc_method for the category's primary unit
  const { data: unitRow } = await c
    .from("catalog_pricing_units")
    .select("calc_method")
    .eq("code", category.primary_unit)
    .maybeSingle();
  const calcMethod: CalcMethod = (unitRow?.calc_method as CalcMethod) ?? "volume";

  // Per-unit rate in the deal currency.
  let unitPriceCents: number | null;
  if (currency === "EUR") {
    unitPriceCents = effectiveRateEurCents(
      variant.price_eur_cents,
      product.base_price_eur_cents,
      category.default_price_eur_cents,
    );
  } else {
    const { data: priceRows } = await c
      .from("catalog_currency_prices")
      .select("entity_type, entity_id, price_cents")
      .eq("currency_code", currency)
      .in("entity_id", [variant.id, product.id, category.id]);
    const map = new Map<string, number>();
    for (const r of priceRows ?? []) map.set(`${r.entity_type}:${r.entity_id}`, r.price_cents);
    unitPriceCents =
      map.get(`variant:${variant.id}`) ??
      map.get(`product:${product.id}`) ??
      map.get(`category:${category.id}`) ??
      null;
  }

  // Attribute options from product + variant EAV field values.
  const attrs: CatalogLineAttrs = {
    productName: product.name ?? null,
    woodSpecies: null,
    humidity: null,
    processing: null,
    quality: null,
    productType: null,
    woodSpeciesOptionId: null,
    humidityOptionId: null,
    processingOptionId: null,
    qualityOptionId: null,
    productTypeOptionId: null,
  };

  const [{ data: pfv }, { data: vfv }] = await Promise.all([
    c
      .from("catalog_product_field_values")
      .select("option_id, value_text, catalog_fields(field_key), catalog_field_options(value)")
      .eq("product_id", product.id),
    c
      .from("catalog_variant_field_values")
      .select("option_id, value_text, catalog_fields(field_key), catalog_field_options(value)")
      .eq("variant_id", variant.id),
  ]);
  for (const row of [...(pfv ?? []), ...(vfv ?? [])]) {
    const key = row.catalog_fields?.field_key as string | undefined;
    if (!key) continue;
    const attr = FIELD_KEY_TO_LINE_ATTR[key];
    if (!attr) continue;
    const optionValue = (row.catalog_field_options?.value as string | undefined) ?? row.value_text ?? null;
    (attrs[attr.value] as string | null) = optionValue;
    (attrs[attr.option] as string | null) = row.option_id ?? null;
  }

  return {
    ...attrs,
    catalogProductId: product.id,
    catalogVariantId: variant.id,
    isStandard: true,
    unit: calcMethodToLineUnit(calcMethod),
    unitPriceCents,
    thickness: mmToText(variant.thickness_mm),
    width: mmToText(variant.width_mm),
    length: mmToText(variant.length_mm),
    calcMethod,
    currency,
  };
}

/** The per-variant billable quantity in the category's unit (1 for per_piece). */
export function variantUnitQuantity(calcMethod: CalcMethod, dims: Dimensions): number | null {
  return computeQuantity(calcMethod, dims);
}

/** Units whose line total = unit price × a quantity column. */
const DERIVABLE_LINE_UNITS = new Set(["m3", "loose_m3", "piece"]);

/**
 * Derive a line total (cents) from unit price × quantity for the derivable
 * units (piece → pieces; m3/loose_m3 → volume). Returns `explicit` for the
 * other units (m2/linear_m/package/crate — no quantity column). Null when the
 * inputs can't produce a total. Pure — shared by appendLineItem + tests.
 */
export function deriveLineTotalCents(
  unit: string,
  unitPriceCents: number | null | undefined,
  qty: { pieces?: string | number | null; volumeM3?: number | null },
  explicit?: number | null,
): number | null {
  if (unitPriceCents == null) return explicit ?? null;
  if (!DERIVABLE_LINE_UNITS.has(unit)) return explicit ?? null;
  const q = unit === "piece" ? Number(qty.pieces ?? 0) : Number(qty.volumeM3 ?? 0);
  return q > 0 ? Math.round(unitPriceCents * q) : null;
}
