"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Hook to detect if the user has scrolled past the hero section.
 * Returns true when scroll position exceeds the hero threshold (default: 100vh - header height).
 *
 * Uses a small delay on initial check to handle navigation transitions gracefully,
 * preventing flash when the scroll position hasn't reset yet.
 */
export function useScrolledPastHero(threshold: number = 0): boolean {
  const [scrolledPast, setScrolledPast] = useState(false);
  const initialCheckDone = useRef(false);

  useEffect(() => {
    // Calculate threshold: viewport height minus header height (80px)
    const heroThreshold = threshold || window.innerHeight - 80;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      setScrolledPast(scrollY > heroThreshold);
    };

    // Delay initial check to allow scroll position to reset after navigation
    // This prevents the header flash when coming from a scrolled page
    if (!initialCheckDone.current) {
      initialCheckDone.current = true;
      // Use requestAnimationFrame to check after browser has settled
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          handleScroll();
        });
      });
    } else {
      handleScroll();
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return scrolledPast;
}
