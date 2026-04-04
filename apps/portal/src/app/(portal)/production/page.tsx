import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, isSuperAdmin, orgHasFeature } from "@/lib/auth";
import {
  getProcesses,
  getProcessesWithNotes,
  getDraftProductions,
  getValidatedProductions,
} from "@/features/production/actions";
import { getProcessBreakdown, getAdminProcessBreakdown } from "@/features/dashboard/actions";
import { getTrackingSets } from "@/features/production/actions/tracking";
import { ProductionPageTabs } from "@/features/production/components/ProductionPageTabs";

export const metadata: Metadata = {
  title: "Production",
};

// Disable caching to always show fresh drafts list when navigating back
export const dynamic = "force-dynamic";

/**
 * Production Page
 *
 * Producer page for creating and managing production entries.
 * Shows tabs: Active (new production form + drafts) and History (validated entries).
 *
 * TODO [i18n]: Replace hardcoded text with useTranslations()
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
    const hasFeature = await orgHasFeature(orgId, "production.view");
    if (!hasFeature) {
      notFound();
    }
  }

  // Parse comma-separated org IDs for multi-select filter (Super Admin only)
  const orgIds = isSuperAdmin(session) && orgParam
    ? orgParam.split(",").filter(Boolean)
    : undefined;

  // Determine which org to use for processes with notes (single org - use first selected or user's org)
  const processNotesOrgId = orgIds?.[0] || session.organisationId || undefined;

  const [processesResult, processesWithNotesResult, draftsResult, historyResult, breakdownResult, trackingResult] = await Promise.all([
    getProcesses(),
    getProcessesWithNotes(processNotesOrgId),
    getDraftProductions(orgIds),
    getValidatedProductions(orgIds),
    userIsAdmin ? getAdminProcessBreakdown(undefined, orgIds) : getProcessBreakdown(),
    getTrackingSets(),
  ]);

  const processes = processesResult.success ? processesResult.data : [];
  const processesWithNotes = processesWithNotesResult.success ? processesWithNotesResult.data : [];
  const drafts = draftsResult.success ? draftsResult.data : [];
  const history = historyResult.success ? historyResult.data : [];
  const breakdown = breakdownResult.success ? breakdownResult.data : [];
  const trackingSets = trackingResult.success ? trackingResult.data : [];

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
        processesWithNotes={processesWithNotes}
        drafts={drafts}
        history={history}
        breakdown={breakdown}
        trackingSets={trackingSets}
        defaultTab={tab}
        defaultProcess={process}
        showOrganisation={isSuperAdmin(session)}
        canDeleteHistory={isSuperAdmin(session)}
        organizationName={session.organisationName || undefined}
        organizationId={orgIds?.[0] || session.organisationId || undefined}
        isAdmin={userIsAdmin}
      />
    </div>
  );
}
