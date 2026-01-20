"use client";

import { useEffect, useState } from "react";

/**
 * Hook to detect if the user has scrolled past the hero section.
 * Returns true when scroll position exceeds the hero threshold (default: 100vh - header height).
 */
export function useScrolledPastHero(threshold: number = 0): boolean {
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    // Calculate threshold: viewport height minus header height (80px)
    const heroThreshold = threshold || window.innerHeight - 80;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      setScrolledPast(scrollY > heroThreshold);
    };

    // Check initial position
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return scrolledPast;
}
