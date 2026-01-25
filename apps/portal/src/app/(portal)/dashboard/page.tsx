import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession, isAdmin, isSuperAdmin } from "@/lib/auth";
import { AccessDeniedHandler } from "@/components/AccessDeniedHandler";
import {
  getProducerMetrics,
  getProcessBreakdown,
  getAdminMetrics,
  getAdminProcessBreakdown,
} from "@/features/dashboard/actions";
import { ProducerDashboardMetrics } from "@/features/dashboard/components/ProducerDashboardMetrics";
import { ProcessBreakdownTable } from "@/features/dashboard/components/ProcessBreakdownTable";
import { AdminDashboardContent } from "@/features/dashboard/components/AdminDashboardContent";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Admin Dashboard Loader (Server Component)
 *
 * Fetches admin metrics server-side and passes to client component.
 * @param orgId - Optional org ID for Super Admin to filter by specific organisation
 */
async function AdminDashboardLoader({ orgId }: { orgId?: string }) {
  try {
    const [metricsResult, breakdownResult] = await Promise.all([
      getAdminMetrics(undefined, orgId),
      getAdminProcessBreakdown(undefined, orgId),
    ]);

    const hasError = !metricsResult.success || !breakdownResult.success;
    if (hasError) {
      console.error("[AdminDashboard] Failed to load metrics:", {
        metricsError: !metricsResult.success ? metricsResult.error : null,
        breakdownError: !breakdownResult.success ? breakdownResult.error : null,
      });
    }

    const metrics = metricsResult.success ? metricsResult.data : null;
    const breakdown = breakdownResult.success ? breakdownResult.data : [];

    return (
      <AdminDashboardContent
        initialMetrics={metrics}
        initialBreakdown={breakdown}
        hasError={hasError}
      />
    );
  } catch (err) {
    console.error("[AdminDashboard] Unexpected error fetching data:", err);
    return (
      <AdminDashboardContent
        initialMetrics={null}
        initialBreakdown={[]}
        hasError={true}
      />
    );
  }
}

/**
 * Producer Dashboard Content
 *
 * Fetches real metrics and process breakdown data.
 * Shows metric cards, per-process table, and quick action links.
 * TODO [i18n]: Replace hardcoded text with useTranslations()
 */
async function ProducerDashboardContent() {
  const [metricsResult, breakdownResult] = await Promise.all([
    getProducerMetrics(),
    getProcessBreakdown(),
  ]);

  // Handle errors - show user-friendly message instead of silently failing
  const hasError = !metricsResult.success || !breakdownResult.success;
  if (hasError) {
    console.error("[Dashboard] Failed to load metrics:", {
      metricsError: !metricsResult.success ? metricsResult.error : null,
      breakdownError: !breakdownResult.success ? breakdownResult.error : null,
    });
  }

  const metrics = metricsResult.success ? metricsResult.data : null;
  const breakdown = breakdownResult.success ? breakdownResult.data : [];
  const hasProduction = metrics && metrics.totalProductionVolumeM3 > 0;

  // Show error state if data failed to load
  if (hasError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 shadow-sm text-center">
        <p className="text-destructive font-medium">
          Failed to load dashboard metrics. Please try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <>
      <ProducerDashboardMetrics metrics={metrics} />

      {hasProduction ? (
        <ProcessBreakdownTable breakdown={breakdown} />
      ) : (
        <div className="rounded-lg border bg-card p-6 shadow-sm text-center">
          <p className="text-muted-foreground">
            Start tracking production to see metrics
          </p>
        </div>
      )}

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/production"
            className="rounded-md border p-4 text-center hover:bg-accent/50 transition-colors"
          >
            New Production
          </Link>
          <Link
            href="/inventory"
            className="rounded-md border p-4 text-center hover:bg-accent/50 transition-colors"
          >
            View Inventory
          </Link>
          <Link
            href="/production?tab=history"
            className="rounded-md border p-4 text-center hover:bg-accent/50 transition-colors"
          >
            Production History
          </Link>
        </div>
      </div>
    </>
  );
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
  const { org: selectedOrgId } = await searchParams;
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const userIsAdmin = isAdmin(session);
  // Pass org filter to admin dashboard for Super Admin
  const orgFilter = isSuperAdmin(session) ? selectedOrgId : undefined;

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

      {userIsAdmin ? <AdminDashboardLoader orgId={orgFilter} /> : <ProducerDashboardContent />}
    </div>
  );
}
