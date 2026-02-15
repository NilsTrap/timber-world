"use client";

import { AdminDashboardMetrics } from "./AdminDashboardMetrics";
import type { AdminMetrics } from "../types";

interface AdminDashboardContentProps {
  initialMetrics: AdminMetrics | null;
  hasError: boolean;
}

/**
 * Admin Dashboard Content (Client Component)
 *
 * Shows admin metrics only.
 * Process breakdown moved to Production > Consolidated tab.
 *
 * TODO [i18n]: Replace hardcoded text with useTranslations()
 */
export function AdminDashboardContent({
  initialMetrics,
  hasError,
}: AdminDashboardContentProps) {
  // Error state
  if (hasError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 shadow-sm text-center">
        <p className="text-destructive font-medium">
          Failed to load dashboard metrics. Please try refreshing the page.
        </p>
      </div>
    );
  }

  return <AdminDashboardMetrics metrics={initialMetrics} />;
}
