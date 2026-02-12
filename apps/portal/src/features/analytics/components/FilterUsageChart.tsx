"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@timber/ui";
import type { FilterUsage } from "../types";

interface FilterUsageChartProps {
  data: FilterUsage[];
}

// Display-friendly filter names
const FILTER_LABELS: Record<string, string> = {
  product: "Product",
  species: "Species",
  humidity: "Humidity",
  type: "Type",
  qualityGrade: "Quality Grade",
  thickness: "Thickness",
  width: "Width",
  length: "Length",
  fscCertified: "FSC Certified",
  processing: "Processing",
};

export function FilterUsageChart({ data }: FilterUsageChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Filter Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No filter usage data available</p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((f) => f.usageCount), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filter Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((filter) => {
            const width = (filter.usageCount / maxCount) * 100;
            const label = FILTER_LABELS[filter.filterName] || filter.filterName;

            return (
              <div key={filter.filterName}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">
                    {filter.usageCount.toLocaleString()} clicks
                  </span>
                </div>
                <div className="h-6 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-forest-green/70 transition-all duration-500"
                    style={{ width: `${Math.max(width, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
