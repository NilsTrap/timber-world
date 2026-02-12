"use client";

import { useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "tw_analytics_session";
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

interface SessionData {
  id: string;
  expiresAt: number;
}

interface TrackOptions {
  eventName: string;
  eventCategory?: string;
  properties?: Record<string, unknown>;
  // Quote funnel specific
  funnelAction?: "view" | "field_focus" | "submit" | "success";
  fieldName?: string;
  selectedProductIds?: string[];
  timeOnFormMs?: number;
}

interface UseAnalyticsOptions {
  enabled?: boolean;
  userId?: string;
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function getOrCreateSession(): string {
  if (typeof window === "undefined") return "";

  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const data: SessionData = JSON.parse(stored);
      if (data.expiresAt > Date.now()) {
        // Refresh expiry
        const refreshed: SessionData = {
          id: data.id,
          expiresAt: Date.now() + SESSION_EXPIRY_MS,
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
        return data.id;
      }
    }

    // Create new session
    const newSession: SessionData = {
      id: generateSessionId(),
      expiresAt: Date.now() + SESSION_EXPIRY_MS,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    return newSession.id;
  } catch {
    // Fallback if sessionStorage fails
    return generateSessionId();
  }
}

function sendBeacon(url: string, data: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  // Use fetch with keepalive for reliable tracking
  // sendBeacon with Blob can have Content-Type issues in some browsers
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    keepalive: true,
  }).catch(() => {
    // Silently fail - analytics should never break the app
  });
}

export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const { enabled = true, userId } = options;
  const pathname = usePathname();
  const trackedProductsRef = useRef<Set<string>>(new Set());
  const trackedJourneyStagesRef = useRef<Set<string>>(new Set());
  const trackedGallerySlidesRef = useRef<Set<string>>(new Set());

  const track = useCallback(
    (trackOptions: TrackOptions) => {
      // Don't track if disabled (no consent)
      if (!enabled) return;

      const sessionId = getOrCreateSession();
      if (!sessionId) return;

      const locale = typeof document !== "undefined"
        ? document.documentElement.lang
        : undefined;
      const referrer = typeof document !== "undefined"
        ? document.referrer
        : undefined;

      const payload = {
        sessionId,
        eventName: trackOptions.eventName,
        eventCategory: trackOptions.eventCategory,
        properties: trackOptions.properties,
        pagePath: pathname,
        locale,
        referrer,
        userId,
        funnelAction: trackOptions.funnelAction,
        fieldName: trackOptions.fieldName,
        selectedProductIds: trackOptions.selectedProductIds,
        timeOnFormMs: trackOptions.timeOnFormMs,
      };

      sendBeacon("/api/analytics/track", payload);
    },
    [pathname, enabled, userId]
  );

  const trackPageView = useCallback(() => {
    track({
      eventName: "page_view",
      eventCategory: "navigation",
    });
  }, [track]);

  const trackProductView = useCallback(
    (productId: string, productName: string, species?: string) => {
      // Deduplicate within session
      if (trackedProductsRef.current.has(productId)) return;
      trackedProductsRef.current.add(productId);

      track({
        eventName: "product_view",
        eventCategory: "catalog",
        properties: { productId, productName, species },
      });
    },
    [track]
  );

  const trackFilterClick = useCallback(
    (filterName: string, filterValue: string, action: "add" | "remove") => {
      track({
        eventName: "filter_click",
        eventCategory: "catalog",
        properties: { filterName, filterValue, action },
      });
    },
    [track]
  );

  const trackProductSelect = useCallback(
    (productId: string, action: "add" | "remove", currentCount: number) => {
      track({
        eventName: "product_select",
        eventCategory: "catalog",
        properties: { productId, action, currentCount },
      });
    },
    [track]
  );

  const trackQuoteFormView = useCallback(
    (source: string, selectedCount: number, selectedProductIds: string[]) => {
      track({
        eventName: "quote_form_view",
        eventCategory: "quote",
        properties: { source, selectedCount },
        funnelAction: "view",
        selectedProductIds,
      });
    },
    [track]
  );

  const trackQuoteFieldFocus = useCallback(
    (fieldName: string) => {
      track({
        eventName: "quote_field_focus",
        eventCategory: "quote",
        properties: { fieldName },
        funnelAction: "field_focus",
        fieldName,
      });
    },
    [track]
  );

  const trackQuoteSubmit = useCallback(
    (productIds: string[], timeOnFormMs: number) => {
      track({
        eventName: "quote_submit",
        eventCategory: "quote",
        properties: { productIds, timeOnForm: timeOnFormMs },
        funnelAction: "submit",
        selectedProductIds: productIds,
        timeOnFormMs,
      });
    },
    [track]
  );

  const trackQuoteSuccess = useCallback(
    (timeOnFormMs: number) => {
      track({
        eventName: "quote_success",
        eventCategory: "quote",
        properties: { timeOnForm: timeOnFormMs },
        funnelAction: "success",
        timeOnFormMs,
      });
    },
    [track]
  );

  const trackJourneyStageView = useCallback(
    (stageNumber: number, stageName: string) => {
      const key = `${stageNumber}-${stageName}`;
      // Deduplicate within session
      if (trackedJourneyStagesRef.current.has(key)) return;
      trackedJourneyStagesRef.current.add(key);

      track({
        eventName: "journey_stage_view",
        eventCategory: "journey",
        properties: { stageNumber, stageName },
      });
    },
    [track]
  );

  // Track time spent on a journey stage when user leaves it
  const trackJourneyStageExit = useCallback(
    (stageNumber: number, stageName: string, timeSpentMs: number, maxSlideReached: number, totalSlides: number) => {
      track({
        eventName: "journey_stage_exit",
        eventCategory: "journey",
        properties: {
          stageNumber,
          stageName,
          timeSpentMs,
          timeSpentSeconds: Math.round(timeSpentMs / 1000),
          maxSlideReached,
          totalSlides,
          galleryDepthPercent: totalSlides > 1 ? Math.round((maxSlideReached / (totalSlides - 1)) * 100) : 100,
        },
      });
    },
    [track]
  );

  // Track gallery slide view (which slide in a stage gallery)
  const trackGallerySlideView = useCallback(
    (stageNumber: number, stageName: string, slideIndex: number, slideTitle?: string) => {
      const key = `${stageNumber}-${slideIndex}`;
      // Deduplicate within session
      if (trackedGallerySlidesRef.current.has(key)) return;
      trackedGallerySlidesRef.current.add(key);

      track({
        eventName: "gallery_slide_view",
        eventCategory: "journey",
        properties: {
          stageNumber,
          stageName,
          slideIndex,
          slideTitle: slideTitle || `Slide ${slideIndex + 1}`,
        },
      });
    },
    [track]
  );

  // Track time spent on a gallery slide
  const trackGallerySlideExit = useCallback(
    (stageNumber: number, stageName: string, slideIndex: number, timeSpentMs: number, slideTitle?: string) => {
      track({
        eventName: "gallery_slide_exit",
        eventCategory: "journey",
        properties: {
          stageNumber,
          stageName,
          slideIndex,
          slideTitle: slideTitle || `Slide ${slideIndex + 1}`,
          timeSpentMs,
          timeSpentSeconds: Math.round(timeSpentMs / 1000),
        },
      });
    },
    [track]
  );

  return {
    track,
    trackPageView,
    trackProductView,
    trackFilterClick,
    trackProductSelect,
    trackQuoteFormView,
    trackQuoteFieldFocus,
    trackQuoteSubmit,
    trackQuoteSuccess,
    trackJourneyStageView,
    trackJourneyStageExit,
    trackGallerySlideView,
    trackGallerySlideExit,
    isEnabled: enabled,
  };
}
