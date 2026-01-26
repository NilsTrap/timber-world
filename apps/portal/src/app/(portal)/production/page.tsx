import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isSuperAdmin } from "@/lib/auth";
import {
  getProcesses,
  getDraftProductions,
  getValidatedProductions,
} from "@/features/production/actions";
import { ProductionPageTabs } from "@/features/production/components/ProductionPageTabs";

export const metadata: Metadata = {
  title: "Production",
};

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
  const { tab, process, org: selectedOrgId } = await searchParams;
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Pass org filter to queries for Super Admin
  const orgFilter = isSuperAdmin(session) ? selectedOrgId : undefined;

  const [processesResult, draftsResult, historyResult] = await Promise.all([
    getProcesses(),
    getDraftProductions(orgFilter),
    getValidatedProductions(orgFilter),
  ]);

  const processes = processesResult.success ? processesResult.data : [];
  const drafts = draftsResult.success ? draftsResult.data : [];
  const history = historyResult.success ? historyResult.data : [];

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
        history={history}
        defaultTab={tab}
        defaultProcess={process}
        showOrganisation={isSuperAdmin(session)}
        canDeleteHistory={isSuperAdmin(session)}
      />
    </div>
  );
}
