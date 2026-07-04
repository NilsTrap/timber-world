import { stageChipStyle, stageLabel } from "../services/stageColors";

/**
 * F2 · The shared deal-stage chip. Renders the §12 palette colour for a stage
 * (via stageColors — the single source of truth). Use everywhere a lifecycle
 * stage is shown so the palette stays consistent and off-palette literals never
 * creep back into components.
 */
export function StageBadge({
  stage,
  className = "",
  strikeThrough = false,
  children,
}: {
  stage: string | null | undefined;
  className?: string;
  /** Cancelled deals read struck-through in some surfaces. */
  strikeThrough?: boolean;
  /** Optional extra content after the label (e.g. the stage caption). */
  children?: React.ReactNode;
}) {
  return (
    <span
      style={stageChipStyle(stage)}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${strikeThrough ? "line-through" : ""} ${className}`}
    >
      {stageLabel(stage)}
      {children}
    </span>
  );
}
