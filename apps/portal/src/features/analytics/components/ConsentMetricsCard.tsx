"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@timber/ui";
import { Check, X } from "lucide-react";
import type { ConsentMetrics } from "../actions/getConsentMetrics";

interface ConsentMetricsCardProps {
  data: ConsentMetrics;
}

export function ConsentMetricsCard({ data }: ConsentMetricsCardProps) {
  if (data.totalDecisions === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cookie Consent</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No consent data available yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cookie Consent</CardTitle>
        <p className="text-sm text-muted-foreground">
          {data.totalDecisions.toLocaleString()} total decisions
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Accepted */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-green-100 text-green-600">
                  <Check className="h-4 w-4" />
                </div>
                <span className="font-medium">Accepted</span>
              </div>
              <span className="text-sm">
                {data.accepted.toLocaleString()} ({data.acceptedPercent}%)
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${data.acceptedPercent}%` }}
              />
            </div>
          </div>

          {/* Rejected */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-red-100 text-red-600">
                  <X className="h-4 w-4" />
                </div>
                <span className="font-medium">Rejected</span>
              </div>
              <span className="text-sm">
                {data.rejected.toLocaleString()} ({data.rejectedPercent}%)
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${data.rejectedPercent}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
