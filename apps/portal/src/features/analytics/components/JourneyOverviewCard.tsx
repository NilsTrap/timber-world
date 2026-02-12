"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@timber/ui";
import type { JourneyStageView } from "../types";
import type { JourneyEngagement } from "../actions/getJourneyEngagement";

interface JourneyOverviewCardProps {
  stageViews: JourneyStageView[];
  engagement: JourneyEngagement | null;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export function JourneyOverviewCard({ stageViews, engagement }: JourneyOverviewCardProps) {
  if (stageViews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Journey Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No journey data available</p>
        </CardContent>
      </Card>
    );
  }

  // Build a map of stage engagement data
  const stageEngagementMap = new Map<number, {
    avgTimeSpentSeconds: number;
    totalExits: number;
    avgGalleryDepthPercent: number;
  }>();

  engagement?.stageEngagement.forEach((stage) => {
    stageEngagementMap.set(stage.stageNumber, {
      avgTimeSpentSeconds: stage.avgTimeSpentSeconds,
      totalExits: stage.totalExits,
      avgGalleryDepthPercent: stage.avgGalleryDepthPercent,
    });
  });

  // Build a map of gallery slides by stage
  type GallerySlide = NonNullable<JourneyEngagement>["gallerySlideEngagement"][number];
  const slidesByStage = new Map<number, GallerySlide[]>();
  engagement?.gallerySlideEngagement.forEach((slide) => {
    if (!slidesByStage.has(slide.stageNumber)) {
      slidesByStage.set(slide.stageNumber, []);
    }
    slidesByStage.get(slide.stageNumber)!.push(slide);
  });

  const maxViews = Math.max(...stageViews.map((s) => s.viewCount), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journey Overview</CardTitle>
        <p className="text-sm text-muted-foreground">
          Stage views, gallery depth, and time spent
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stageViews.map((stage) => {
            const engagementData = stageEngagementMap.get(stage.stageNumber);
            const slides = slidesByStage.get(stage.stageNumber) || [];
            const viewWidth = (stage.viewCount / maxViews) * 100;

            return (
              <div key={stage.stageNumber} className="border rounded-lg overflow-hidden">
                {/* Stage Header */}
                <div className="p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">
                      {stage.stageNumber}. {stage.stageName}
                    </span>
                    <div className="flex items-center gap-4 text-sm">
                      <span>{stage.viewCount} views</span>
                      {engagementData && (
                        <span className="text-muted-foreground">
                          avg {formatTime(engagementData.avgTimeSpentSeconds)}
                        </span>
                      )}
                      {stage.dropoffRate > 0 && (
                        <span className="text-destructive">
                          -{stage.dropoffRate}% dropoff
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500/70 transition-all duration-500"
                      style={{ width: `${Math.max(viewWidth, 2)}%` }}
                    />
                  </div>
                  {engagementData && engagementData.avgGalleryDepthPercent > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Gallery depth: {engagementData.avgGalleryDepthPercent}%
                    </div>
                  )}
                </div>

                {/* Gallery Slides */}
                {slides.length > 0 && (
                  <div className="p-3 space-y-2 border-t">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Gallery Slides
                    </div>
                    {slides.map((slide) => (
                      <div
                        key={`${slide.stageNumber}-${slide.slideIndex}`}
                        className="flex items-center justify-between text-sm pl-4 py-1"
                      >
                        <span className="text-muted-foreground">
                          {slide.slideIndex + 1}. {slide.slideTitle}
                        </span>
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <span>{slide.viewCount} views</span>
                          {slide.avgTimeSpentSeconds > 0 && (
                            <span>{formatTime(slide.avgTimeSpentSeconds)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
