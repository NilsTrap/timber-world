"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useJourneyProgress } from "@/hooks/useJourneyProgress";
import { JourneyStage } from "./JourneyStage";
import { JourneyCompletionCTA } from "./JourneyCompletionCTA";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { GalleryImage } from "./HorizontalGallery";

// Translation keys for stage names (matches i18n keys in messages/*.json)
const STAGE_KEYS = [
  "forest",
  "sawmill",
  "kilns",
  "elements",
  "cnc",
  "finishing",
  "qualityControl",
  "delivery",
] as const;

// Gallery images for stages that have multiple images
// Stages with galleries: Sawmill (2), Elements (4), CNC (5), Finishing (6)
const STAGE_GALLERY_IMAGES: Record<string, GalleryImage[]> = {
  sawmill: [
    { src: "https://placehold.co/1920x1080/8B4513/FFFFFF?text=Sawmill+2", alt: "Sawmill cutting operation" },
    { src: "https://placehold.co/1920x1080/8B4513/FFFFFF?text=Sawmill+3", alt: "Sawmill machinery" },
    { src: "https://placehold.co/1920x1080/8B4513/FFFFFF?text=Sawmill+4", alt: "Sawmill precision cutting" },
  ],
  elements: [
    { src: "https://placehold.co/1920x1080/DEB887/333333?text=Elements+2", alt: "Panel selection process" },
    { src: "https://placehold.co/1920x1080/DEB887/333333?text=Elements+3", alt: "Color sorting elements" },
    { src: "https://placehold.co/1920x1080/DEB887/333333?text=Elements+4", alt: "Quality inspection" },
  ],
  cnc: [
    { src: "https://placehold.co/1920x1080/4A4A4A/FFFFFF?text=CNC+2", alt: "CNC milling operation" },
    { src: "https://placehold.co/1920x1080/4A4A4A/FFFFFF?text=CNC+3", alt: "CNC precision routing" },
    { src: "https://placehold.co/1920x1080/4A4A4A/FFFFFF?text=CNC+4", alt: "CNC finished piece" },
  ],
  finishing: [
    { src: "https://placehold.co/1920x1080/CD853F/FFFFFF?text=Finishing+2", alt: "Varnishing process" },
    { src: "https://placehold.co/1920x1080/CD853F/FFFFFF?text=Finishing+3", alt: "Waxing application" },
    { src: "https://placehold.co/1920x1080/CD853F/FFFFFF?text=Finishing+4", alt: "Final polish" },
  ],
};

/**
 * Production Journey scroll container with 8 full-screen stages.
 * Uses CSS scroll-snap for section-by-section scrolling.
 * Includes keyboard navigation (ArrowUp/ArrowDown).
 */
export function ProductionJourney() {
  const t = useTranslations("home");
  const { currentStage, containerRef } = useJourneyProgress();
  const reducedMotion = useReducedMotion();

  // Page tracking constants
  const TOTAL_PAGES = STAGE_KEYS.length + 2; // hero (1) + 8 stages + CTA (1) = 10 pages
  const GAP_THRESHOLD_MS = 40; // Gap between events to detect new gesture
  const DELTA_THRESHOLD = 5; // Minimum delta to trigger page move

  // Current page tracking refs
  const currentPageRef = useRef<number>(0);
  const hasMovedRef = useRef<boolean>(false);
  const lastEventTimeRef = useRef<number>(0);

  // Unified page navigation function
  const goToPage = useCallback((page: number) => {
    const targetPage = Math.max(0, Math.min(page, TOTAL_PAGES - 1));
    if (targetPage === currentPageRef.current) return;

    currentPageRef.current = targetPage;
    const viewportHeight = window.innerHeight;
    const targetY = targetPage * viewportHeight;

    window.scrollTo({
      top: targetY,
      behavior: reducedMotion ? 'auto' : 'smooth'
    });
  }, [reducedMotion, TOTAL_PAGES]);

  // Scroll to top on page load/refresh - disable browser scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    currentPageRef.current = 0;
  }, []);

  // Controlled page-by-page scrolling
  useEffect(() => {
    if (reducedMotion) return;

    const viewportHeight = window.innerHeight;

    // Initialize current page (should be 0 after refresh)
    currentPageRef.current = Math.round(window.scrollY / viewportHeight);

    // Handle wheel events - detect gesture boundaries by event gaps
    const handleWheel = (e: WheelEvent) => {
      // Always update time tracking first
      const now = performance.now();
      const timeSinceLastEvent = now - lastEventTimeRef.current;
      lastEventTimeRef.current = now;

      // Let gallery handle its own horizontal swipes
      const target = e.target as HTMLElement;
      const isInGallery = target.closest('[aria-roledescription="carousel"]');

      if (isInGallery && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Horizontal swipe in gallery - let gallery handle it
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // If in gallery with horizontal swipe, don't do vertical page navigation
      if (isInGallery && Math.abs(e.deltaX) > DELTA_THRESHOLD) {
        return;
      }

      // Gap detected = new gesture, allow new page move
      if (timeSinceLastEvent > GAP_THRESHOLD_MS) {
        hasMovedRef.current = false;
      }

      // Move page on first significant delta of each gesture
      if (!hasMovedRef.current && Math.abs(e.deltaY) > DELTA_THRESHOLD) {
        hasMovedRef.current = true;
        const direction = e.deltaY > 0 ? 1 : -1;
        goToPage(currentPageRef.current + direction);
      }
    };

    // Handle touch events for mobile swipe
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.changedTouches[0]?.clientY ?? 0;
      const deltaY = touchStartY - touchEndY;

      // Simply move +1 or -1 from current tracked page
      if (deltaY > 10) {
        goToPage(currentPageRef.current + 1);
      } else if (deltaY < -10) {
        goToPage(currentPageRef.current - 1);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel, { capture: true });
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [reducedMotion, goToPage, GAP_THRESHOLD_MS, DELTA_THRESHOLD]);

  // Keyboard navigation - uses same goToPage for consistency
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && currentPageRef.current < TOTAL_PAGES - 1) {
      e.preventDefault();
      goToPage(currentPageRef.current + 1);
    }
    if (e.key === "ArrowUp" && currentPageRef.current > 0) {
      e.preventDefault();
      goToPage(currentPageRef.current - 1);
    }
  };

  // Total scroll height for stacking cards effect
  const totalScrollHeight = `${(STAGE_KEYS.length + 1) * 100}vh`;

  return (
    <section
      ref={containerRef as React.RefObject<HTMLElement>}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="outline-none"
      style={{ height: totalScrollHeight }}
      role="region"
      aria-label={t("journey.progressNavigation")}
    >
      {/* Screen reader announcement for stage changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {currentStage > 0 &&
          t("journey.stageOf", { current: currentStage, total: 8 }) +
            ": " +
            t(`journey.${STAGE_KEYS[currentStage - 1]}`)}
      </div>

      {/* Journey stages with full-screen backgrounds - stacking cards effect */}
      {STAGE_KEYS.map((stageKey, i) => (
        <JourneyStage
          key={i + 1}
          stageNumber={i + 1}
          totalStages={STAGE_KEYS.length}
          imageFallback={`/images/journey/${stageKey}.jpg`}
          galleryImages={STAGE_GALLERY_IMAGES[stageKey]}
          headline={t(`journey.${stageKey}`)}
          subtext={t(`journey.${stageKey}Description`)}
          altText={t("journey.stageAlt", {
            number: i + 1,
            name: t(`journey.${stageKey}`),
          })}
          priority={i === 0}
        />
      ))}

      {/* CTA section after journey completion */}
      <JourneyCompletionCTA />
    </section>
  );
}
