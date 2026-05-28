export interface CommissionConfig {
  standardPct: number | null;
  maxDiscountPct: number | null;
  discountedPct: number | null;
}

export interface CommissionResult {
  /** commission rate that applies at the given discount (interpolated) */
  pct: number;
  /** commission amount in cents on the final (discounted) sale */
  cents: number;
}

/**
 * Commission rate for a given discount, linearly interpolated between the
 * standard rate (0 discount) and the discounted rate (max discount).
 *  - no config or no standard rate -> 0
 *  - maxDiscount 0 (or missing) -> always the standard rate
 *  - discount clamped to [0, maxDiscount]
 */
export function commissionPctForDiscount(cfg: CommissionConfig, discountPct: number): number {
  const std = cfg.standardPct ?? 0;
  const max = cfg.maxDiscountPct ?? 0;
  const disc = cfg.discountedPct ?? std;
  if (max <= 0) return std;
  const d = Math.min(Math.max(discountPct, 0), max);
  return std + (disc - std) * (d / max);
}

/** Clamp a requested discount to the category's allowed maximum. */
export function clampDiscount(cfg: CommissionConfig, discountPct: number): number {
  const max = cfg.maxDiscountPct ?? 0;
  return Math.min(Math.max(discountPct, 0), max);
}

/**
 * Commission on a sale.
 *  saleSubtotalCents = price before discount
 *  discountPct       = discount applied (clamped to max)
 * Commission is taken on the FINAL (discounted) sale price.
 */
export function computeCommission(
  cfg: CommissionConfig,
  saleSubtotalCents: number,
  discountPct: number
): CommissionResult {
  const d = clampDiscount(cfg, discountPct);
  const finalCents = Math.round(saleSubtotalCents * (1 - d / 100));
  const pct = commissionPctForDiscount(cfg, d);
  return { pct, cents: Math.round((finalCents * pct) / 100) };
}
