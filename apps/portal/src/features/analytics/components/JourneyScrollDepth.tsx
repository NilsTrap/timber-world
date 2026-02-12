"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@timber/ui";
import type { JourneyStageView } from "../types";

interface JourneyScrollDepthProps {
  data: JourneyStageView[];
}

export function JourneyScrollDepth({ data }: JourneyScrollDepthProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Journey Scroll Depth</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No journey data available</p>
        </CardContent>
      </Card>
    );
  }

  const maxViews = Math.max(...data.map((s) => s.viewCount), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journey Scroll Depth</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((stage) => {
            const width = (stage.viewCount / maxViews) * 100;

            return (
              <div key={stage.stageNumber}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">
                    {stage.stageNumber}. {stage.stageName}
                  </span>
                  <span className="text-muted-foreground">
                    {stage.viewCount.toLocaleString()} views
                    {stage.dropoffRate > 0 && (
                      <span className="text-destructive ml-2">
                        -{stage.dropoffRate}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-6 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-amber-500/70 transition-all duration-500"
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
