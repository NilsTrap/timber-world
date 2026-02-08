"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

const STAGE_KEYS = [
  "forest",
  "sawmill",
  "kiln",
  "factory",
  "workshop",
  "warehouse",
] as const;

/**
 * JourneyStageNav - Fixed left sidebar showing all journey stages.
 * Highlights the current stage and allows navigation by clicking.
 */
export function JourneyStageNav() {
  const t = useTranslations("home");
  const [currentStage, setCurrentStage] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Find all stage elements
    const stages = document.querySelectorAll("[data-stage]");
    if (stages.length === 0) return;

    // Track which stage is most visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const stageNum = parseInt(
              entry.target.getAttribute("data-stage") || "1",
              10
            );
            setCurrentStage(stageNum);
          }
        });
      },
      { threshold: 0.5 }
    );

    stages.forEach((stage) => observer.observe(stage));

    // Show nav when first stage is visible, hide on hero
    const heroObserver = new IntersectionObserver(
      (entries) => {
        const heroEntry = entries[0];
        if (heroEntry) {
          // Hide nav when hero is more than 50% visible
          setIsVisible(!heroEntry.isIntersecting || heroEntry.intersectionRatio < 0.5);
        }
      },
      { threshold: 0.5 }
    );

    const hero = document.querySelector("[data-hero]");
    if (hero) {
      heroObserver.observe(hero);
    } else {
      // No hero marker, show nav immediately
      setIsVisible(true);
    }

    return () => {
      observer.disconnect();
      heroObserver.disconnect();
    };
  }, []);

  const scrollToStage = (stageNumber: number) => {
    const stage = document.querySelector(`[data-stage="${stageNumber}"]`);
    if (stage) {
      stage.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (!isVisible) return null;

  return (
    <nav
      className="fixed left-6 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-3"
      aria-label="Journey stages"
    >
      {STAGE_KEYS.map((stageKey, index) => {
        const stageNumber = index + 1;
        const isActive = currentStage === stageNumber;

        return (
          <button
            key={stageKey}
            onClick={() => scrollToStage(stageNumber)}
            className={`text-left text-lg font-medium transition-all duration-300 ${
              isActive
                ? "text-white scale-105"
                : "text-white/40 hover:text-white/70"
            }`}
            aria-current={isActive ? "true" : undefined}
          >
            {t(`journey.${stageKey}`)}
          </button>
        );
      })}
    </nav>
  );
}
