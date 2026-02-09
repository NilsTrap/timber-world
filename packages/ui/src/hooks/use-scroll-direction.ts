"use client";

import { useSyncExternalStore, useEffect } from "react";

type ScrollDirection = "up" | "down" | "idle";

// Module-level state for shared scroll tracking
let lastScrollY = 0;
let direction: ScrollDirection = "idle";
const listeners = new Set<() => void>();

function handleScroll() {
  const currentScrollY = window.scrollY;
  // Use a 5px threshold to avoid jitter
  if (currentScrollY > lastScrollY + 5) {
    direction = "down";
  } else if (currentScrollY < lastScrollY - 5) {
    direction = "up";
  }
  lastScrollY = currentScrollY;
  listeners.forEach((listener) => listener());
}

// Reset state when scroll position is at top (handles navigation)
function resetIfAtTop() {
  if (window.scrollY === 0) {
    lastScrollY = 0;
    direction = "idle";
    listeners.forEach((listener) => listener());
  }
}

function subscribe(callback: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("scroll", handleScroll, { passive: true });
  }
  listeners.add(callback);

  // Check and reset on subscribe (handles navigation)
  resetIfAtTop();

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      window.removeEventListener("scroll", handleScroll);
    }
  };
}

function getSnapshot(): ScrollDirection {
  return direction;
}

function getServerSnapshot(): ScrollDirection {
  return "idle";
}

/**
 * Hook to detect scroll direction using useSyncExternalStore.
 * Returns 'up', 'down', or 'idle' based on scroll direction.
 * Uses a shared listener to avoid multiple scroll event handlers.
 * Automatically resets to 'idle' when scroll position is at top.
 */
export function useScrollDirection(): ScrollDirection {
  const scrollDirection = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Reset state on mount to handle navigation
  useEffect(() => {
    resetIfAtTop();
  }, []);

  return scrollDirection;
}
