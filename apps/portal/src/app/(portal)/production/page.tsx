import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, isSuperAdmin, orgHasModule } from "@/lib/auth";
import {
  getProcesses,
  getDraftProductions,
} from "@/features/production/actions";
import { ProductionPageTabs } from "@/features/production/components/ProductionPageTabs";

export const metadata: Metadata = {
  title: "Production",
};

// Disable caching to always show fresh drafts list when navigating back
export const dynamic = "force-dynamic";

/**
 * Production Page
 *
 * Only loads data for the default tab (Drafts) on the server.
 * Other tabs (History, Consolidated, Tracking, Processes) load client-side on demand.
 */
export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; process?: string; org?: string }>;
}) {
  const { tab, process, org: orgParam } = await searchParams;
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const userIsAdmin = isAdmin(session);

  // Check org feature access for non-admin users
  if (!userIsAdmin) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const hasModule = await orgHasModule(orgId, "production.view");
    if (!hasModule) {
      notFound();
    }
  }

  // Parse comma-separated org IDs for multi-select filter (Super Admin only)
  const orgIds = isSuperAdmin(session) && orgParam
    ? orgParam.split(",").filter(Boolean)
    : undefined;

  // Only load processes (for new production form) and drafts on the server
  // Other tab data is loaded client-side on demand
  const [processesResult, draftsResult] = await Promise.all([
    getProcesses(),
    getDraftProductions(orgIds),
  ]);

  const processes = processesResult.success ? processesResult.data : [];
  const drafts = draftsResult.success ? draftsResult.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Production</h1>
        <p className="text-muted-foreground">
          Log and track production transformations
        </p>
      </div>

      <ProductionPageTabs
        processes={processes}
        drafts={drafts}
        defaultTab={tab}
        defaultProcess={process}
        showOrganisation={isSuperAdmin(session)}
        canDeleteHistory={isSuperAdmin(session)}
        organizationName={session.organisationName || undefined}
        organizationId={orgIds?.[0] || session.organisationId || undefined}
        isAdmin={userIsAdmin}
        orgIds={orgIds}
      />
    </div>
  );
}
