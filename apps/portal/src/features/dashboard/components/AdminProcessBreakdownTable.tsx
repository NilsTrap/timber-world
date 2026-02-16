"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { AdminProcessBreakdownItem, TrendDirection } from "../types";
import { formatVolume, formatPercent, getOutcomeColor } from "../utils/formatting";

/** Format number with comma decimal separator, 2 decimals */
function fmt2(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

interface AdminProcessBreakdownTableProps {
  breakdown: AdminProcessBreakdownItem[];
  onProcessClick: (processName: string) => void;
}

/** Get trend indicator icon and color */
function TrendIndicator({ trend, value }: { trend: TrendDirection; value: number }) {
  switch (trend) {
    case "up":
      return (
        <span className="inline-flex items-center text-green-600" title={`+${formatPercent(value)}%`}>
          <ArrowUp className="h-4 w-4" />
        </span>
      );
    case "down":
      return (
        <span className="inline-flex items-center text-red-600" title={`-${formatPercent(Math.abs(value))}%`}>
          <ArrowDown className="h-4 w-4" />
        </span>
      );
    case "stable":
    default:
      return (
        <span className="inline-flex items-center text-gray-400" title="No significant change">
          <Minus className="h-4 w-4" />
        </span>
      );
  }
}

/**
 * Admin Process Breakdown Table
 *
 * Displays per-process production statistics with:
 * - Color-coded outcome %
 * - Trend indicators compared to previous period
 * - Date range filter dropdown
 * - Clickable rows for process detail view
 *
 * TODO [i18n]: Replace hardcoded text with useTranslations()
 */
export function AdminProcessBreakdownTable({
  breakdown,
  onProcessClick,
}: AdminProcessBreakdownTableProps) {
  if (breakdown.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <div className="p-4 border-b">
        <h3 className="text-sm font-medium">Per-Process Efficiency</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Process</th>
            <th className="px-4 py-3 text-right font-medium">Entries</th>
            <th className="px-4 py-3 text-right font-medium">Input m³</th>
            <th className="px-4 py-3 text-right font-medium">Output m³</th>
            <th className="px-4 py-3 text-right font-medium">Outcome %</th>
            <th className="px-4 py-3 text-right font-medium">Waste %</th>
            <th className="px-4 py-3 text-right font-medium">Planned</th>
            <th className="px-4 py-3 text-right font-medium">Actual</th>
            <th className="px-4 py-3 text-center font-medium">Trend</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((item) => (
            <tr
              key={item.processId}
              className="border-b last:border-0 hover:bg-accent/50 transition-colors cursor-pointer focus:outline-none focus:bg-accent/50"
              onClick={() => onProcessClick(item.processName)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onProcessClick(item.processName);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View efficiency history for ${item.processName}`}
            >
              <td className="px-4 py-3 font-medium">{item.processName}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {item.totalEntries}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatVolume(item.totalInputM3)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatVolume(item.totalOutputM3)}
              </td>
              <td
                className={`px-4 py-3 text-right tabular-nums font-medium ${getOutcomeColor(item.avgOutcomePercent)}`}
              >
                {formatPercent(item.avgOutcomePercent)}%
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatPercent(item.avgWastePercent)}%
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {item.totalPlannedWork > 0
                  ? `${fmt2(item.totalPlannedWork)} ${item.workUnit || ""}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {item.totalActualWork > 0
                  ? `${fmt2(item.totalActualWork)} ${item.workUnit || ""}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-center">
                <TrendIndicator trend={item.trend} value={item.trendValue} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
