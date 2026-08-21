import { stageChipStyle } from "../../orders/services/stageColors";

/**
 * Lifecycle stage chip. Colours come from the ONE §12 source
 * (orders/services/stageColors) — no stage colour literals live here.
 */
export function ProjectStageBadge({ stage, label }: { stage: string; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={stageChipStyle(stage)}
    >
      {label}
    </span>
  );
}
