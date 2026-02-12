"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@timber/ui";
import type { VisitorEngagement } from "../actions/getVisitorEngagement";

interface VisitorEngagementCardProps {
  data: VisitorEngagement;
}

interface EngagementMetric {
  label: string;
  count: number;
  percent: number;
  color: string;
}

export function VisitorEngagementCard({ data }: VisitorEngagementCardProps) {
  const metrics: EngagementMetric[] = [
    {
      label: "Viewed Stock Pages",
      count: data.stockPageViewers,
      percent: data.stockPageViewerPercent,
      color: "bg-blue-500",
    },
    {
      label: "Started Journey",
      count: data.journeyStarters,
      percent: data.journeyStarterPercent,
      color: "bg-green-500",
    },
    {
      label: "Used Filters",
      count: data.filterUsers,
      percent: data.filterUserPercent,
      color: "bg-amber-500",
    },
    {
      label: "Viewed Quote Form",
      count: data.quoteFormViewers,
      percent: data.quoteFormViewerPercent,
      color: "bg-purple-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitor Engagement</CardTitle>
        <p className="text-sm text-muted-foreground">
          {data.totalSessions.toLocaleString()} total sessions
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{metric.label}</span>
                <span className="text-muted-foreground">
                  {metric.count.toLocaleString()} ({metric.percent}%)
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${metric.color} transition-all duration-500`}
                  style={{ width: `${Math.max(metric.percent, 1)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
