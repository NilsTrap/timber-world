import { formatVolume, formatPercent } from "@/lib/utils";
import type { OrgUserMetrics } from "../types";

interface OrgUserDashboardMetricsProps {
  metrics: OrgUserMetrics | null;
}

/**
 * Org User Dashboard Metric Cards
 *
 * Displays 4 metric cards in a grid:
 * - Total Inventory (m3)
 * - Production Volume (all-time output m3)
 * - Outcome Rate (weighted average %)
 * - Waste Rate (weighted average %)
 *
 * Shows "--" for zero/empty values.
 */
export function OrgUserDashboardMetrics({ metrics }: OrgUserDashboardMetricsProps) {
  const hasData = metrics && (metrics.totalInventoryM3 > 0 || metrics.totalProductionVolumeM3 > 0);

  const cards = [
    {
      title: "Total Inventory",
      value: hasData && metrics.totalInventoryM3 > 0 ? `${formatVolume(metrics.totalInventoryM3)} m\u00B3` : "--",
      subtitle: "Cubic meters available",
    },
    {
      title: "Production Volume",
      value: hasData && metrics.totalProductionVolumeM3 > 0 ? `${formatVolume(metrics.totalProductionVolumeM3)} m\u00B3` : "--",
      subtitle: "All-time output",
    },
    {
      title: "Outcome Rate",
      value: hasData && metrics.overallOutcomePercent > 0 ? `${formatPercent(metrics.overallOutcomePercent)}%` : "--",
      subtitle: "Weighted average",
    },
    {
      title: "Waste Rate",
      value: hasData && metrics.overallWastePercent > 0 ? `${formatPercent(metrics.overallWastePercent)}%` : "--",
      subtitle: "Weighted average",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.title} className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">
            {card.title}
          </h3>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{card.value}</p>
          <p className="text-xs text-muted-foreground">{card.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
