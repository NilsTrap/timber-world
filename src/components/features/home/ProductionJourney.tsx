"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useJourneyProgress } from "@/hooks/useJourneyProgress";
import { JourneyProgressIndicator } from "./JourneyProgressIndicator";
import { JourneyStage } from "./JourneyStage";
import { JourneyCompletionCTA } from "./JourneyCompletionCTA";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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

/**
 * Production Journey scroll container with 8 full-screen stages.
 * Uses CSS scroll-snap for section-by-section scrolling.
 * Includes keyboard navigation (ArrowUp/ArrowDown) and progress indicator.
 */
export function ProductionJourney() {
  const t = useTranslations("home");
  const { currentStage, containerRef } = useJourneyProgress();
  const reducedMotion = useReducedMotion();

  const scrollToStage = useCallback(
    (stageNum: number) => {
      const stage = document.getElementById(`stage-${stageNum}`);
      if (stage) {
        stage.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
      }
    },
    [reducedMotion]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && currentStage < 8) {
      e.preventDefault();
      scrollToStage(currentStage + 1);
    }
    if (e.key === "ArrowUp" && currentStage > 1) {
      e.preventDefault();
      scrollToStage(currentStage - 1);
    }
  };

  return (
    <section
      ref={containerRef as React.RefObject<HTMLElement>}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative outline-none scroll-smooth"
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

      {/* Progress indicator - only visible when a journey stage is in view */}
      {currentStage > 0 && (
        <JourneyProgressIndicator
          currentStage={currentStage}
          total={8}
          onStageClick={scrollToStage}
        />
      )}

      {/* Journey stages with full-screen backgrounds */}
      {STAGE_KEYS.map((stageKey, i) => (
        <JourneyStage
          key={i + 1}
          stageNumber={i + 1}
          imageFallback={`/images/journey/${stageKey}.jpg`}
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
