"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@timber/ui";
import type { DetailedFilterUsage } from "../actions/getDetailedFilterUsage";

interface DetailedFilterUsageCardProps {
  data: DetailedFilterUsage[];
}

// Friendly names for filter keys
const FILTER_LABELS: Record<string, string> = {
  product: "Product Type",
  species: "Wood Species",
  width: "Width",
  length: "Length",
  thickness: "Thickness",
  qualityGrade: "Quality Grade",
  type: "Type",
  humidity: "Humidity",
  processing: "Processing",
  fscCertified: "FSC Certified",
};

export function DetailedFilterUsageCard({ data }: DetailedFilterUsageCardProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Filter Usage Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No filter usage data available</p>
        </CardContent>
      </Card>
    );
  }

  const totalClicks = data.reduce((sum, f) => sum + f.totalClicks, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filter Usage Details</CardTitle>
        <p className="text-sm text-muted-foreground">
          {totalClicks.toLocaleString()} total filter selections
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {data.map((filter) => {
            const label = FILTER_LABELS[filter.filterName] || filter.filterName;

            return (
              <div key={filter.filterName}>
                {/* Filter Category Header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b">
                  <span className="font-semibold text-base">{label}</span>
                  <span className="text-sm font-medium">
                    {filter.totalClicks} clicks
                  </span>
                </div>

                {/* Filter Values */}
                <div className="space-y-2 pl-4">
                  {filter.values.map((value) => {
                    const percent = Math.round((value.count / filter.totalClicks) * 100);
                    return (
                      <div key={value.value}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-foreground">{value.value}</span>
                          <span className="text-muted-foreground whitespace-nowrap ml-4">
                            {value.count} ({percent}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500/70 transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
