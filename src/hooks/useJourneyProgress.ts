"use client";

import { useEffect, useState, useRef, RefObject } from "react";

type JourneyProgress = {
  currentStage: number;
  isInJourney: boolean;
  containerRef: RefObject<HTMLElement | null>;
};

/**
 * Hook to track scroll position within the production journey section.
 * Uses IntersectionObserver to detect which stage is currently visible.
 * Returns the current stage number (1-8), whether user is in the journey,
 * and a ref to attach to the journey container.
 */
export function useJourneyProgress(): JourneyProgress {
  const [currentStage, setCurrentStage] = useState(0);
  const [isInJourney, setIsInJourney] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const stages = containerRef.current.querySelectorAll("[data-stage]");

    // Observe container to detect if we're in journey section
    const containerObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsInJourney(entry.isIntersecting);
        }
      },
      { threshold: 0.1 }
    );
    containerObserver.observe(containerRef.current);

    // Observe individual stages with 50% threshold
    const stageObserver = new IntersectionObserver(
      (entries) => {
        // Check if any stage is intersecting
        const intersectingEntry = entries.find((entry) => entry.isIntersecting);

        if (intersectingEntry) {
          const stageNum = parseInt(
            intersectingEntry.target.getAttribute("data-stage") || "0"
          );
          setCurrentStage(stageNum);
        } else {
          // Check if all observed stages are above viewport (scrolled back up)
          const allAbove = entries.every(
            (entry) => entry.boundingClientRect.top > 0
          );
          if (allAbove) {
            setCurrentStage(0);
          }
        }
      },
      { threshold: 0.5 }
    );

    stages.forEach((stage) => stageObserver.observe(stage));

    return () => {
      containerObserver.disconnect();
      stageObserver.disconnect();
    };
  }, []);

  return { currentStage, isInJourney, containerRef };
}
