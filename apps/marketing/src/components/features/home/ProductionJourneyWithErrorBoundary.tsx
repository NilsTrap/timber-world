"use client";

import { ErrorBoundary } from "@timber/ui";
import { ProductionJourney } from "./ProductionJourney";

/**
 * ProductionJourney wrapped in an error boundary.
 * Prevents journey component errors from crashing the entire homepage.
 */
export function ProductionJourneyWithErrorBoundary() {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex h-screen items-center justify-center bg-timber-900">
          <div className="text-center">
            <p className="text-lg font-medium text-white">
              Unable to load the production journey
            </p>
            <p className="mt-1 text-sm text-white/60">
              Please refresh the page to try again
            </p>
          </div>
        </div>
      }
    >
      <ProductionJourney />
    </ErrorBoundary>
  );
}
