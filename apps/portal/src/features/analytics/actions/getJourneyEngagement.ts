"use server";

import { createClient } from "@timber/database/server";
import type { DateRange } from "../types";

export interface StageEngagement {
  stageNumber: number;
  stageName: string;
  avgTimeSpentSeconds: number;
  avgGalleryDepthPercent: number;
  totalExits: number;
}

export interface GallerySlideEngagement {
  stageNumber: number;
  stageName: string;
  slideIndex: number;
  slideTitle: string;
  viewCount: number;
  avgTimeSpentSeconds: number;
}

export interface JourneyEngagement {
  stageEngagement: StageEngagement[];
  gallerySlideEngagement: GallerySlideEngagement[];
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function getDateFilter(dateRange: DateRange): Date | null {
  const now = new Date();
  switch (dateRange) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "all":
    default:
      return null;
  }
}

export async function getJourneyEngagement(
  dateRange: DateRange = "30d"
): Promise<ActionResult<JourneyEngagement>> {
  try {
    const supabase = await createClient();
    const dateFilter = getDateFilter(dateRange);

    // Get journey stage exit events (time spent per stage)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stageExitQuery = (supabase as any)
      .from("analytics_events")
      .select("properties")
      .eq("event_name", "journey_stage_exit");

    if (dateFilter) {
      stageExitQuery = stageExitQuery.gte("created_at", dateFilter.toISOString());
    }

    const { data: stageExitData, error: stageExitError } = await stageExitQuery;

    if (stageExitError) {
      console.error("Failed to fetch stage exit data:", stageExitError);
      return { success: false, error: stageExitError.message };
    }

    // Aggregate stage engagement
    const stageMap = new Map<
      number,
      {
        stageName: string;
        totalTimeSeconds: number;
        totalGalleryDepth: number;
        count: number;
      }
    >();

    (stageExitData || []).forEach(
      (event: {
        properties: {
          stageNumber?: number;
          stageName?: string;
          timeSpentSeconds?: number;
          galleryDepthPercent?: number;
        };
      }) => {
        const props = event.properties || {};
        const stageNumber = props.stageNumber;
        const stageName = props.stageName || `Stage ${stageNumber}`;
        const timeSeconds = props.timeSpentSeconds || 0;
        const galleryDepth = props.galleryDepthPercent || 0;

        if (stageNumber == null) return;

        const existing = stageMap.get(stageNumber);
        if (existing) {
          existing.totalTimeSeconds += timeSeconds;
          existing.totalGalleryDepth += galleryDepth;
          existing.count++;
        } else {
          stageMap.set(stageNumber, {
            stageName,
            totalTimeSeconds: timeSeconds,
            totalGalleryDepth: galleryDepth,
            count: 1,
          });
        }
      }
    );

    const stageEngagement: StageEngagement[] = Array.from(stageMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([stageNumber, data]) => ({
        stageNumber,
        stageName: data.stageName,
        avgTimeSpentSeconds: Math.round(data.totalTimeSeconds / data.count),
        avgGalleryDepthPercent: Math.round(data.totalGalleryDepth / data.count),
        totalExits: data.count,
      }));

    // Get gallery slide view events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let slideViewQuery = (supabase as any)
      .from("analytics_events")
      .select("properties")
      .eq("event_name", "gallery_slide_view");

    if (dateFilter) {
      slideViewQuery = slideViewQuery.gte("created_at", dateFilter.toISOString());
    }

    const { data: slideViewData, error: slideViewError } = await slideViewQuery;

    if (slideViewError) {
      console.error("Failed to fetch slide view data:", slideViewError);
      return { success: false, error: slideViewError.message };
    }

    // Get gallery slide exit events (time spent)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let slideExitQuery = (supabase as any)
      .from("analytics_events")
      .select("properties")
      .eq("event_name", "gallery_slide_exit");

    if (dateFilter) {
      slideExitQuery = slideExitQuery.gte("created_at", dateFilter.toISOString());
    }

    const { data: slideExitData, error: slideExitError } = await slideExitQuery;

    if (slideExitError) {
      console.error("Failed to fetch slide exit data:", slideExitError);
      return { success: false, error: slideExitError.message };
    }

    // Aggregate slide engagement
    const slideKey = (stageNumber: number, slideIndex: number) =>
      `${stageNumber}-${slideIndex}`;

    const slideViewMap = new Map<string, { stageName: string; slideTitle: string; count: number }>();
    const slideTimeMap = new Map<string, { totalSeconds: number; count: number }>();

    // Count views
    (slideViewData || []).forEach(
      (event: {
        properties: {
          stageNumber?: number;
          stageName?: string;
          slideIndex?: number;
          slideTitle?: string;
        };
      }) => {
        const props = event.properties || {};
        const stageNumber = props.stageNumber;
        const slideIndex = props.slideIndex;
        if (stageNumber == null || slideIndex == null) return;

        const key = slideKey(stageNumber, slideIndex);
        const existing = slideViewMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          slideViewMap.set(key, {
            stageName: props.stageName || `Stage ${stageNumber}`,
            slideTitle: props.slideTitle || `Slide ${slideIndex + 1}`,
            count: 1,
          });
        }
      }
    );

    // Aggregate time spent
    (slideExitData || []).forEach(
      (event: {
        properties: {
          stageNumber?: number;
          slideIndex?: number;
          timeSpentSeconds?: number;
        };
      }) => {
        const props = event.properties || {};
        const stageNumber = props.stageNumber;
        const slideIndex = props.slideIndex;
        const timeSeconds = props.timeSpentSeconds || 0;
        if (stageNumber == null || slideIndex == null) return;

        const key = slideKey(stageNumber, slideIndex);
        const existing = slideTimeMap.get(key);
        if (existing) {
          existing.totalSeconds += timeSeconds;
          existing.count++;
        } else {
          slideTimeMap.set(key, { totalSeconds: timeSeconds, count: 1 });
        }
      }
    );

    // Combine into gallery slide engagement
    const gallerySlideEngagement: GallerySlideEngagement[] = [];

    slideViewMap.forEach((viewData, key) => {
      const parts = key.split("-");
      const stageStr = parts[0] || "0";
      const slideStr = parts[1] || "0";
      const stageNumber = parseInt(stageStr, 10);
      const slideIndex = parseInt(slideStr, 10);

      const timeData = slideTimeMap.get(key);
      const avgTimeSeconds = timeData
        ? Math.round(timeData.totalSeconds / timeData.count)
        : 0;

      gallerySlideEngagement.push({
        stageNumber,
        stageName: viewData.stageName,
        slideIndex,
        slideTitle: viewData.slideTitle,
        viewCount: viewData.count,
        avgTimeSpentSeconds: avgTimeSeconds,
      });
    });

    // Sort by stage, then slide
    gallerySlideEngagement.sort((a, b) => {
      if (a.stageNumber !== b.stageNumber) return a.stageNumber - b.stageNumber;
      return a.slideIndex - b.slideIndex;
    });

    return {
      success: true,
      data: {
        stageEngagement,
        gallerySlideEngagement,
      },
    };
  } catch (err) {
    console.error("Unexpected error fetching journey engagement:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
