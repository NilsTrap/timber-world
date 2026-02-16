"use client";

import { formatVolume, formatPercent } from "@/lib/utils";
import type { ProcessBreakdownItem } from "../types";

interface ProcessBreakdownTableProps {
  breakdown: ProcessBreakdownItem[];
  onProcessClick: (processName: string) => void;
}

/** Get color class based on outcome percentage */
function getOutcomeColor(percent: number): string {
  if (percent >= 80) return "text-green-600";
  if (percent >= 60) return "text-yellow-600";
  return "text-red-600";
}

/** Format number with comma decimal separator, 2 decimals */
function fmt2(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/**
 * Process Breakdown Table
 *
 * Displays per-process production statistics with color-coded outcome %.
 * Rows are clickable — navigates to Production History filtered by process.
 */
export function ProcessBreakdownTable({ breakdown, onProcessClick }: ProcessBreakdownTableProps) {
  if (breakdown.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-2 py-2 text-left font-medium">Process</th>
            <th className="px-2 py-2 text-right font-medium">Entries</th>
            <th className="px-2 py-2 text-right font-medium">Input m³</th>
            <th className="px-2 py-2 text-right font-medium">Output m³</th>
            <th className="px-2 py-2 text-right font-medium">Outcome %</th>
            <th className="px-2 py-2 text-right font-medium">Waste %</th>
            <th className="px-2 py-2 text-right font-medium">Planned</th>
            <th className="px-2 py-2 text-right font-medium">Actual</th>
            <th className="px-2 py-2 text-right font-medium">Price</th>
            <th className="px-2 py-2 text-right font-medium">Sum</th>
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
              aria-label={`View production history for ${item.processName}`}
            >
              <td className="px-2 py-2 font-medium">{item.processName}</td>
              <td className="px-2 py-2 text-right tabular-nums">{item.totalEntries}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatVolume(item.totalInputM3)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatVolume(item.totalOutputM3)}</td>
              <td className={`px-2 py-2 text-right tabular-nums font-medium ${getOutcomeColor(item.avgOutcomePercent)}`}>
                {formatPercent(item.avgOutcomePercent)}%
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatPercent(item.avgWastePercent)}%
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {item.totalPlannedWork > 0
                  ? `${fmt2(item.totalPlannedWork)} ${item.workUnit || ""}`
                  : "—"}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {item.totalActualWork > 0
                  ? `${fmt2(item.totalActualWork)} ${item.workUnit || ""}`
                  : "—"}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {item.price != null
                  ? `${fmt2(item.price)} / ${item.workUnit || ""}`
                  : "—"}
              </td>
              <td className="px-2 py-2 text-right tabular-nums font-medium">
                {item.totalSum != null
                  ? fmt2(item.totalSum)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
