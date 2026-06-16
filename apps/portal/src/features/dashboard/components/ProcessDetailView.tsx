"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@timber/ui";
import { formatDate } from "@/lib/utils";
import { getProcessHistory } from "../actions";
import type { ProcessDetailData, DateRange, ChartDataPoint } from "../types";
import { formatVolume, formatPercent, getOutcomeColor } from "../utils/formatting";

interface ProcessDetailViewProps {
  processId: string | null;
  dateRange?: DateRange;
  onClose: () => void;
}

/**
 * Simple bar chart using divs (no external library needed)
 * Shows outcome % over time
 */
function SimpleChart({ data }: { data: ChartDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
        No chart data available
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.outcomePercent), 100);

  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((item, i) => {
        const height = max > 0 ? (item.outcomePercent / max) * 100 : 0;
        return (
          <div
            key={`${item.date}-${i}`}
            className="flex-1 bg-primary/30 hover:bg-primary/50 rounded-t transition-colors"
            style={{ height: `${height}%`, minHeight: "2px" }}
            title={`${item.date}: ${formatPercent(item.outcomePercent)}%`}
          />
        );
      })}
    </div>
  );
}

/**
 * Process Detail View Modal
 *
 * Displays detailed efficiency history for a specific process:
 * - Bar chart showing outcome % over time
 * - List of recent production entries
 * - Highlighted best and worst performing entries
 *
 * TODO [i18n]: Replace hardcoded text with useTranslations()
 */
export function ProcessDetailView({
  processId,
  dateRange,
  onClose,
}: ProcessDetailViewProps) {
  const [data, setData] = useState<ProcessDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!processId) {
      setData(null);
      return;
    }

    // Capture processId for async closure (TypeScript narrowing)
    const currentProcessId = processId;

    async function fetchData() {
      setLoading(true);
      setError(null);

      const result = await getProcessHistory(currentProcessId, dateRange);

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }

      setLoading(false);
    }

    fetchData();
  }, [processId, dateRange]);

  const isOpen = processId !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {data?.processName ?? "Process"} - Efficiency History
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="py-8 text-center text-muted-foreground">
            Loading...
          </div>
        )}

        {error && (
          <div className="py-8 text-center text-destructive">{error}</div>
        )}

        {!loading && !error && data && (
          <div className="space-y-6">
            {/* Chart Section */}
            <div>
              <h4 className="text-sm font-medium mb-2">Outcome % Over Time</h4>
              <div className="border rounded-lg p-4 bg-muted/20">
                <SimpleChart data={data.chartData} />
              </div>
            </div>

            {/* Best/Worst Entries */}
            {(data.bestEntry || data.worstEntry) && (
              <div className="grid gap-4 md:grid-cols-2">
                {data.bestEntry && (
                  <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
                    <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                      Best Performance
                    </h4>
                    <p className="text-lg font-semibold text-green-600">
                      {formatPercent(data.bestEntry.outcomePercent)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(data.bestEntry.date)} &middot;{" "}
                      {formatVolume(data.bestEntry.inputM3)} m³ →{" "}
                      {formatVolume(data.bestEntry.outputM3)} m³
                    </p>
                  </div>
                )}
                {data.worstEntry && (
                  <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-950/20">
                    <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                      Worst Performance
                    </h4>
                    <p className="text-lg font-semibold text-red-600">
                      {formatPercent(data.worstEntry.outcomePercent)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(data.worstEntry.date)} &middot;{" "}
                      {formatVolume(data.worstEntry.inputM3)} m³ →{" "}
                      {formatVolume(data.worstEntry.outputM3)} m³
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Recent Entries Table */}
            <div>
              <h4 className="text-sm font-medium mb-2">
                Recent Production Entries ({data.historyItems.length})
              </h4>
              {data.historyItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No production entries found for this period.
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm [&_th]:h-8 [&_th]:px-1 [&_th]:py-0 [&_th]:text-xs [&_td]:px-1 [&_td]:py-0.5 [&_td]:text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-right font-medium">Input m³</th>
                        <th className="px-3 py-2 text-right font-medium">Output m³</th>
                        <th className="px-3 py-2 text-right font-medium">Outcome %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.historyItems.slice(0, 10).map((item) => (
                        <tr
                          key={item.entryId}
                          className="border-b last:border-0"
                        >
                          <td className="px-3 py-2">{formatDate(item.date)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatVolume(item.inputM3)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatVolume(item.outputM3)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums font-medium ${getOutcomeColor(item.outcomePercent)}`}
                          >
                            {formatPercent(item.outcomePercent)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.historyItems.length > 10 && (
                    <div className="px-3 py-2 text-center text-xs text-muted-foreground border-t">
                      Showing 10 of {data.historyItems.length} entries
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
