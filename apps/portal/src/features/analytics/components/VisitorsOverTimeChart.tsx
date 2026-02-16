"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@timber/ui";
import type { VisitorsByDay } from "../types";

interface VisitorsOverTimeChartProps {
  data: VisitorsByDay[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function VisitorsOverTimeChart({ data }: VisitorsOverTimeChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unique Visitors Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.visitorCount), 1);
  const totalVisitors = data.reduce((sum, d) => sum + d.visitorCount, 0);
  const avgVisitors = Math.round(totalVisitors / data.length);

  // Determine how many labels to show based on data length
  const labelInterval = data.length <= 7 ? 1 : data.length <= 14 ? 2 : data.length <= 30 ? 5 : 10;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Unique Visitors Over Time</CardTitle>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total: </span>
            <span className="font-semibold">{totalVisitors.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Avg/day: </span>
            <span className="font-semibold">{avgVisitors.toLocaleString()}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bar chart */}
        <div className="h-48 flex items-end gap-[2px]">
          {data.map((day, index) => {
            const heightPx = maxCount > 0 ? (day.visitorCount / maxCount) * 192 : 0;
            const isToday = index === data.length - 1;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col justify-end items-center group relative h-full"
              >
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                  <div className="bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-md whitespace-nowrap border">
                    <div className="font-medium">{formatDateFull(day.date)}</div>
                    <div>{day.visitorCount.toLocaleString()} visitors</div>
                  </div>
                </div>

                {/* Bar */}
                <div
                  className={`w-full rounded-t transition-all duration-200 ${
                    isToday
                      ? "bg-primary hover:bg-primary/80"
                      : "bg-primary/60 hover:bg-primary/80"
                  }`}
                  style={{ height: `${Math.max(heightPx, 4)}px` }}
                />
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex mt-2 text-xs text-muted-foreground">
          {data.map((day, index) => {
            // Show label at intervals
            const showLabel = index % labelInterval === 0 || index === data.length - 1;
            return (
              <div key={day.date} className="flex-1 text-center">
                {showLabel ? formatDate(day.date) : ""}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
