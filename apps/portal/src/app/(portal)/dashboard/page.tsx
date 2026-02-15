import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, isAdmin, isSuperAdmin } from "@/lib/auth";
import { AccessDeniedHandler } from "@/components/AccessDeniedHandler";
import { getProducerMetrics, getAdminMetrics } from "@/features/dashboard/actions";
import { ProducerDashboardMetrics } from "@/features/dashboard/components/ProducerDashboardMetrics";
import { AdminDashboardContent } from "@/features/dashboard/components/AdminDashboardContent";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Admin Dashboard Loader (Server Component)
 *
 * Fetches admin metrics server-side and passes to client component.
 * @param orgIds - Optional org IDs for Super Admin to filter by specific organisations (multi-select)
 */
async function AdminDashboardLoader({ orgIds }: { orgIds?: string[] }) {
  try {
    const metricsResult = await getAdminMetrics(undefined, orgIds);

    const hasError = !metricsResult.success;
    if (hasError) {
      console.error("[AdminDashboard] Failed to load metrics:", metricsResult.error);
    }

    const metrics = metricsResult.success ? metricsResult.data : null;

    return (
      <AdminDashboardContent
        initialMetrics={metrics}
        hasError={hasError}
      />
    );
  } catch (err) {
    console.error("[AdminDashboard] Unexpected error fetching data:", err);
    return (
      <AdminDashboardContent
        initialMetrics={null}
        hasError={true}
      />
    );
  }
}

/**
 * Producer Dashboard Content
 *
 * Fetches real metrics.
 * Shows metric cards only - process breakdown moved to Production > Consolidated tab.
 * TODO [i18n]: Replace hardcoded text with useTranslations()
 */
async function ProducerDashboardContent() {
  const metricsResult = await getProducerMetrics();

  // Handle errors - show user-friendly message instead of silently failing
  if (!metricsResult.success) {
    console.error("[Dashboard] Failed to load metrics:", metricsResult.error);
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 shadow-sm text-center">
        <p className="text-destructive font-medium">
          Failed to load dashboard metrics. Please try refreshing the page.
        </p>
      </div>
    );
  }

  return <ProducerDashboardMetrics metrics={metricsResult.data} />;
}

/**
 * Dashboard Page
 *
 * Server Component that renders role-specific dashboard content.
 * - Admin sees: "Admin Overview" with inventory/product/efficiency metrics
 * - Producer sees: "Production Dashboard" with production-focused metrics
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: orgParam } = await searchParams;
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const userIsAdmin = isAdmin(session);
  // Parse comma-separated org IDs for multi-select filter (Super Admin only)
  const orgIds = isSuperAdmin(session) && orgParam
    ? orgParam.split(",").filter(Boolean)
    : undefined;

  return (
    <div className="space-y-6">
      {/* Client component to handle access_denied query param */}
      <Suspense fallback={null}>
        <AccessDeniedHandler />
      </Suspense>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {userIsAdmin ? "Admin Overview" : "Production Dashboard"}
        </h1>
        <p className="text-muted-foreground">
          {userIsAdmin
            ? "Manage inventory, products, and view producer efficiency"
            : "Welcome to the Timber World Production Portal"}
        </p>
      </div>

      {userIsAdmin ? <AdminDashboardLoader orgIds={orgIds} /> : <ProducerDashboardContent />}
    </div>
  );
}
