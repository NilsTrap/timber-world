import type { CalcMethod } from "./types";

export interface Dimensions {
  widthMm?: number | null;
  lengthMm?: number | null;
  thicknessMm?: number | null;
}

/**
 * Billable quantity for one variant in the unit's calc method.
 * Returns null when a required dimension is missing (-> "price unavailable").
 *  area   = width(m) × length(m)            [m²]
 *  volume = width(m) × length(m) × thick(m) [m³]
 *  length = length(m)                       [m]
 *  per_piece = 1
 */
export function computeQuantity(calcMethod: CalcMethod, dims: Dimensions): number | null {
  const w = mm(dims.widthMm);
  const l = mm(dims.lengthMm);
  const t = mm(dims.thicknessMm);
  switch (calcMethod) {
    case "per_piece":
      return 1;
    case "length":
      return l;
    case "area":
      return w != null && l != null ? round4(w * l) : null;
    case "volume":
      return w != null && l != null && t != null ? round4(w * l * t) : null;
    default:
      return null;
  }
}

/** Effective per-unit EUR rate: variant override -> product base -> category default. */
export function effectiveRateEurCents(
  variantCents: number | null | undefined,
  productCents: number | null | undefined,
  categoryCents: number | null | undefined
): number | null {
  return variantCents ?? productCents ?? categoryCents ?? null;
}

/** Line total in cents = rate × quantity (rounded to whole cents). */
export function lineTotalCents(rateCents: number | null, quantity: number | null): number | null {
  if (rateCents == null || quantity == null) return null;
  return Math.round(rateCents * quantity);
}

export function formatMoney(cents: number | null | undefined, symbol: string): string {
  if (cents == null) return "—";
  return `${symbol}${(cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function mm(v: number | null | undefined): number | null {
  return v == null ? null : v / 1000;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
