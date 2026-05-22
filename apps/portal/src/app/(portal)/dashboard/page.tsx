import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, isSuperAdmin, orgHasModule } from "@/lib/auth";
import { AccessDeniedHandler } from "@/components/AccessDeniedHandler";
import { getOrgUserMetrics, getAdminMetrics } from "@/features/dashboard/actions";
import { OrgUserDashboardMetrics } from "@/features/dashboard/components/OrgUserDashboardMetrics";
import { AdminDashboardContent } from "@/features/dashboard/components/AdminDashboardContent";
import { perfLog } from "@/lib/debug/perfLog";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Disable caching to always show fresh dashboard data when navigating back
export const dynamic = "force-dynamic";

/**
 * Admin Dashboard Loader (Server Component)
 *
 * Fetches admin metrics server-side and passes to client component.
 * @param orgIds - Optional org IDs for Super Admin to filter by specific organisations (multi-select)
 */
async function AdminDashboardLoader({ orgIds }: { orgIds?: string[] }) {
  try {
    const metricsResult = await perfLog("dashboard.getAdminMetrics", () =>
      getAdminMetrics(undefined, orgIds),
    );

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
 * Org User Dashboard Content
 *
 * Fetches real metrics.
 * Shows metric cards only - process breakdown moved to Production > Consolidated tab.
 * TODO [i18n]: Replace hardcoded text with useTranslations()
 */
async function OrgUserDashboardContent() {
  const metricsResult = await perfLog("dashboard.getOrgUserMetrics", () =>
    getOrgUserMetrics(),
  );

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

  return <OrgUserDashboardMetrics metrics={metricsResult.data} />;
}

/**
 * Dashboard Page
 *
 * Server Component that renders role-specific dashboard content.
 * - Admin sees: "Admin Overview" with inventory/product/efficiency metrics
 * - Org user sees: "Production Dashboard" with production-focused metrics
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: orgParam } = await searchParams;
  const session = await perfLog("dashboard.getSession", () => getSession());

  if (!session) {
    redirect("/login");
  }

  const userIsAdmin = isAdmin(session);

  // Check org feature access for non-admin users
  if (!userIsAdmin) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const hasModule = await perfLog("dashboard.orgHasModule", () =>
      orgHasModule(orgId, "dashboard.view"),
    );
    if (!hasModule) {
      notFound();
    }
  }

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
            ? "Manage inventory, products, and view organisation efficiency"
            : "Welcome to the Timber World Production Portal"}
        </p>
      </div>

      {/* Stream metrics in via Suspense — the header above paints immediately
          while the data-fetching loader does its work in the background. */}
      <Suspense fallback={<DashboardSkeleton />}>
        {userIsAdmin ? <AdminDashboardLoader orgIds={orgIds} /> : <OrgUserDashboardContent />}
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-lg border bg-card p-6 shadow-sm h-28 animate-pulse"
        >
          <div className="h-3 w-24 bg-muted rounded mb-3" />
          <div className="h-7 w-16 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}
