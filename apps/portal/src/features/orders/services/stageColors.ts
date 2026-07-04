/**
 * F2 (spec §12) · The ONE source of truth for deal lifecycle stage colours.
 *
 * The brand palette (§12) pins three stages and lets the rest be tuned within
 * the same palette (never off-palette). We render solid chips with per-chip text
 * colour chosen for contrast (§12: "may be tuned to meet contrast requirements"):
 * dark text on the light warm chips, white on the darker ones.
 *
 * Every surface that shows a stage badge (Orders overview, the deal stage rail,
 * the deal header) imports from here — there are no stage colour literals in the
 * components. `StageBadge` is the shared renderer.
 */
export interface StageColor {
  label: string;
  /** Solid chip background — a §12 palette hex. */
  bg: string;
  /** Chip text colour, contrast-tuned against `bg`. */
  fg: string;
}

const NEUTRAL: StageColor = { label: "—", bg: "#E5E7EB", fg: "#374151" };

/**
 * §12 mapping. Spec-fixed: Draft #D89B33, Delivered→Success #2E9748,
 * Cancelled→Error #CA3733. Tuned-within-palette middles: Confirmed→Pending
 * #F6D44B, Produced→Info #2682CC, Loaded→Warning #F6A338.
 */
export const STAGE_COLORS: Record<string, StageColor> = {
  draft:     { label: "Draft",     bg: "#D89B33", fg: "#1F2937" },
  confirmed: { label: "Confirmed", bg: "#F6D44B", fg: "#1F2937" },
  produced:  { label: "Produced",  bg: "#2682CC", fg: "#FFFFFF" },
  loaded:    { label: "Loaded",    bg: "#F6A338", fg: "#1F2937" },
  delivered: { label: "Delivered", bg: "#2E9748", fg: "#FFFFFF" },
  cancelled: { label: "Cancelled", bg: "#CA3733", fg: "#FFFFFF" },
};

/** Stage → its §12 colour, with a neutral fallback for any unknown value. */
export function stageColor(stage: string | null | undefined): StageColor {
  return (stage && STAGE_COLORS[stage]) || { ...NEUTRAL, label: stage ?? "—" };
}

/** Inline style for a solid stage chip (background + contrast-tuned text). */
export function stageChipStyle(stage: string | null | undefined): { backgroundColor: string; color: string } {
  const c = stageColor(stage);
  return { backgroundColor: c.bg, color: c.fg };
}

/** Human label for a stage (falls back to the raw value). */
export function stageLabel(stage: string | null | undefined): string {
  return stageColor(stage).label;
}
