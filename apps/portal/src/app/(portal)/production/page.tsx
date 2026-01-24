import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
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
export default async function ProductionPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [processesResult, draftsResult, historyResult] = await Promise.all([
    getProcesses(),
    getDraftProductions(),
    getValidatedProductions(),
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
      />
    </div>
  );
}
