"use client";

import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAnalytics } from "./useAnalytics";
import { useConsent } from "./useConsent";

type AnalyticsContextType = ReturnType<typeof useAnalytics> & {
  hasConsent: boolean;
  isPendingConsent: boolean;
  acceptConsent: () => void;
  rejectConsent: () => void;
};

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

interface AnalyticsProviderProps {
  children: ReactNode;
  userId?: string;
}

export function AnalyticsProvider({ children, userId }: AnalyticsProviderProps) {
  const { hasConsented, isPending, isLoaded, acceptConsent, rejectConsent } = useConsent();
  const analytics = useAnalytics({ enabled: hasConsented, userId });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathRef = useRef<string | null>(null);
  const hasTrackedConsentRef = useRef(false);

  // Track page views on route changes (only if consent given)
  useEffect(() => {
    // Wait for consent state to load
    if (!isLoaded) return;

    // Don't track if no consent
    if (!hasConsented) return;

    const currentPath = `${pathname}?${searchParams.toString()}`;

    // Track when:
    // 1. Consent was just given (first track after consent)
    // 2. Path changed
    const shouldTrack = !hasTrackedConsentRef.current || currentPath !== lastPathRef.current;

    if (shouldTrack) {
      hasTrackedConsentRef.current = true;
      lastPathRef.current = currentPath;
      analytics.trackPageView();
    }
  }, [pathname, searchParams, analytics, hasConsented, isLoaded]);

  const contextValue: AnalyticsContextType = {
    ...analytics,
    hasConsent: hasConsented,
    isPendingConsent: isPending,
    acceptConsent,
    rejectConsent,
  };

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalyticsContext() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("useAnalyticsContext must be used within AnalyticsProvider");
  }
  return context;
}
