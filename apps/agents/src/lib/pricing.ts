// Pure pricing/commission helpers for the agent app (mirrors the portal logic).

export type CalcMethod = "per_piece" | "area" | "volume" | "length";

export interface Dims {
  width_mm?: number | null;
  length_mm?: number | null;
  thickness_mm?: number | null;
}

/** Billable quantity for one piece in the unit's calc method (m²/m³/m or 1). */
export function computeQuantity(method: CalcMethod, d: Dims): number | null {
  const w = d.width_mm != null ? d.width_mm / 1000 : null;
  const l = d.length_mm != null ? d.length_mm / 1000 : null;
  const t = d.thickness_mm != null ? d.thickness_mm / 1000 : null;
  switch (method) {
    case "per_piece": return 1;
    case "length": return l;
    case "area": return w != null && l != null ? w * l : null;
    case "volume": return w != null && l != null && t != null ? w * l * t : null;
    default: return null;
  }
}

export interface CommissionConfig {
  standardPct: number | null;
  maxDiscountPct: number | null;
  discountedPct: number | null;
}

/** Commission rate at a given discount, linearly interpolated. */
export function commissionPctForDiscount(cfg: CommissionConfig, discountPct: number): number {
  const std = cfg.standardPct ?? 0;
  const max = cfg.maxDiscountPct ?? 0;
  const disc = cfg.discountedPct ?? std;
  if (max <= 0) return std;
  const d = Math.min(Math.max(discountPct, 0), max);
  return std + (disc - std) * (d / max);
}

export function clampDiscount(cfg: CommissionConfig, discountPct: number): number {
  const max = cfg.maxDiscountPct ?? 0;
  return Math.min(Math.max(discountPct, 0), max);
}

/** Commission cents on a (discounted) sale price. */
export function commissionCents(cfg: CommissionConfig, saleCents: number, discountPct: number): number {
  const d = clampDiscount(cfg, discountPct);
  const finalCents = Math.round(saleCents * (1 - d / 100));
  return Math.round((finalCents * commissionPctForDiscount(cfg, d)) / 100);
}

export function gbp(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `£${(cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
