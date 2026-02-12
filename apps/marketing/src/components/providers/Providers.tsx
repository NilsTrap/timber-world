"use client";

import { ReactNode, Suspense } from "react";
import { AnalyticsProvider } from "@/lib/analytics";
import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <Suspense fallback={null}>
      <AnalyticsProvider>
        {children}
        <CookieConsentBanner />
      </AnalyticsProvider>
    </Suspense>
  );
}
