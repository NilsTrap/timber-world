import { stageChipStyle } from "../../orders/services/stageColors";

/**
 * Lifecycle stage chip. Colours come from the ONE §12 source
 * (orders/services/stageColors) — no stage colour literals live here.
 */
export function ProjectStageBadge({ stage, label, color }: { stage: string; label: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={color ? { backgroundColor: `${color}1A`, color } : stageChipStyle(stage)}
    >
      {label}
    </span>
  );
}
