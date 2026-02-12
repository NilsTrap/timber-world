"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@timber/ui";
import type { QuoteFunnelMetrics } from "../types";

interface QuoteFunnelChartProps {
  data: QuoteFunnelMetrics;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return "< 1s";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function QuoteFunnelChart({ data }: QuoteFunnelChartProps) {
  const stages = [
    { name: "Form Views", count: data.formViews, color: "bg-blue-500" },
    { name: "Field Interactions", count: data.fieldInteractions, color: "bg-indigo-500" },
    { name: "Submissions", count: data.submissions, color: "bg-purple-500" },
    { name: "Successes", count: data.successes, color: "bg-green-500" },
  ];

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote Request Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const width = (stage.count / maxCount) * 100;
            const prevStage = index > 0 ? stages[index - 1] : undefined;
            const dropoff =
              prevStage
                ? prevStage.count > 0
                  ? Math.round(
                      ((prevStage.count - stage.count) /
                        prevStage.count) *
                        100
                    )
                  : 0
                : null;

            return (
              <div key={stage.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{stage.name}</span>
                  <span className="text-muted-foreground">
                    {stage.count.toLocaleString()}
                    {dropoff !== null && dropoff > 0 && (
                      <span className="text-destructive ml-2">-{dropoff}%</span>
                    )}
                  </span>
                </div>
                <div className="h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className={`h-full ${stage.color} transition-all duration-500`}
                    style={{ width: `${Math.max(width, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Conversion Rate</p>
            <p className="text-2xl font-bold text-green-600">
              {data.conversionRate}%
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg. Time on Form</p>
            <p className="text-2xl font-bold">
              {formatDuration(data.avgTimeOnFormMs)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
