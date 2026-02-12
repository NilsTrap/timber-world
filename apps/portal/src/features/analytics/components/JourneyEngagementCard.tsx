"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@timber/ui";
import type { JourneyEngagement } from "../actions/getJourneyEngagement";

interface JourneyEngagementCardProps {
  data: JourneyEngagement;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export function JourneyEngagementCard({ data }: JourneyEngagementCardProps) {
  const [selectedStage, setSelectedStage] = useState<number | null>(null);

  const { stageEngagement, gallerySlideEngagement } = data;

  const hasStageData = stageEngagement.length > 0;
  const hasSlideData = gallerySlideEngagement.length > 0;

  if (!hasStageData && !hasSlideData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Journey Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No journey engagement data available yet. Data will appear after visitors browse through the journey stages.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group slides by stage
  const slidesByStage = new Map<number, typeof gallerySlideEngagement>();
  gallerySlideEngagement.forEach((slide) => {
    if (!slidesByStage.has(slide.stageNumber)) {
      slidesByStage.set(slide.stageNumber, []);
    }
    slidesByStage.get(slide.stageNumber)!.push(slide);
  });

  const maxTimeSpent = hasStageData
    ? Math.max(...stageEngagement.map((s) => s.avgTimeSpentSeconds), 1)
    : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journey Engagement</CardTitle>
        <p className="text-sm text-muted-foreground">
          Time spent and gallery depth by stage
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="stages">
          <TabsList className="mb-4">
            <TabsTrigger value="stages">Stage Overview</TabsTrigger>
            <TabsTrigger value="gallery">Gallery Slides</TabsTrigger>
          </TabsList>

          <TabsContent value="stages">
            {hasStageData ? (
              <div className="space-y-4">
                {stageEngagement.map((stage) => {
                  const timePercent = (stage.avgTimeSpentSeconds / maxTimeSpent) * 100;

                  return (
                    <div
                      key={stage.stageNumber}
                      className="p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() =>
                        setSelectedStage(
                          selectedStage === stage.stageNumber ? null : stage.stageNumber
                        )
                      }
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">
                          {stage.stageNumber}. {stage.stageName}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {stage.totalExits} exits
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Avg. Time Spent
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${timePercent}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium min-w-[60px] text-right">
                              {formatTime(stage.avgTimeSpentSeconds)}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Gallery Depth
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 transition-all duration-300"
                                style={{ width: `${stage.avgGalleryDepthPercent}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium min-w-[60px] text-right">
                              {stage.avgGalleryDepthPercent}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Stage engagement data will appear after visitors spend time on journey stages.
              </p>
            )}
          </TabsContent>

          <TabsContent value="gallery">
            {hasSlideData ? (
              <div className="space-y-6">
                {Array.from(slidesByStage.entries()).map(([stageNumber, slides]) => {
                  const stageName = slides[0]?.stageName || `Stage ${stageNumber}`;

                  return (
                    <div key={stageNumber}>
                      <h4 className="font-medium mb-3">
                        {stageNumber}. {stageName}
                      </h4>
                      <div className="space-y-2 pl-4 border-l-2 border-muted">
                        {slides.map((slide) => (
                          <div
                            key={`${slide.stageNumber}-${slide.slideIndex}`}
                            className="flex items-center justify-between py-1"
                          >
                            <span className="text-sm">
                              <span className="text-muted-foreground">
                                Slide {slide.slideIndex + 1}:
                              </span>{" "}
                              {slide.slideTitle}
                            </span>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-muted-foreground">
                                {slide.viewCount} views
                              </span>
                              <span className="text-muted-foreground">
                                avg {formatTime(slide.avgTimeSpentSeconds)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Gallery slide data will appear after visitors browse through gallery images.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
