"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@timber/ui";
import { Users, Eye, Clock, ArrowDownUp, Bot, Percent, Cookie } from "lucide-react";
import type { AnalyticsOverview } from "../types";
import type { ConsentMetrics } from "../actions/getConsentMetrics";

interface OverviewMetricsProps {
  data: AnalyticsOverview;
  consentMetrics?: ConsentMetrics | null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return "< 1s";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function OverviewMetrics({ data, consentMetrics }: OverviewMetricsProps) {
  const metrics = [
    {
      title: "Total Sessions",
      value: data.totalSessions.toLocaleString(),
      icon: Users,
      description: "Unique visitor sessions",
    },
    {
      title: "Page Views",
      value: data.totalPageViews.toLocaleString(),
      icon: Eye,
      description: "Total pages viewed",
    },
    {
      title: "Avg. Session",
      value: formatDuration(data.avgSessionDurationMs),
      icon: Clock,
      description: "Average time on site",
    },
    {
      title: "Bounce Rate",
      value: `${data.bounceRate}%`,
      icon: ArrowDownUp,
      description: "Single page visits",
    },
    {
      title: "Bot Traffic",
      value: `${data.botPercentage}%`,
      icon: Bot,
      description: "Automated traffic detected",
    },
    {
      title: "Views/Session",
      value: data.totalSessions > 0
        ? (data.totalPageViews / data.totalSessions).toFixed(1)
        : "0",
      icon: Percent,
      description: "Pages per session",
    },
    {
      title: "Consent Rate",
      value: consentMetrics && consentMetrics.totalDecisions > 0
        ? `${consentMetrics.acceptedPercent}%`
        : "—",
      icon: Cookie,
      description: consentMetrics && consentMetrics.totalDecisions > 0
        ? `${consentMetrics.accepted} of ${consentMetrics.totalDecisions} accepted`
        : "No consent data yet",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {metric.title}
            </CardTitle>
            <metric.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            <p className="text-xs text-muted-foreground">{metric.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
