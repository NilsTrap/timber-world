"use client";

import { useSyncExternalStore } from "react";

/**
 * Hook to detect user's preference for reduced motion.
 * Returns true if the user has enabled "reduce motion" in their OS settings.
 * Used to disable animations and show static images instead of videos.
 */

// Helper to get the current reduced motion preference
function getReducedMotionPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Subscribe to changes in the reduced motion preference
function subscribeToReducedMotion(callback: () => void): () => void {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

// Server snapshot - always return false (no motion preference on server)
function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionPreference,
    getServerSnapshot
  );
}
