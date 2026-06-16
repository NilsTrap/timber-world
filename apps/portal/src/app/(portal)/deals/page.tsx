import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getDeals } from "@/features/deals/actions";
import { DealsPageClient } from "@/features/deals/components";

export const metadata = {
  title: "Deals | Timber World",
};

export default async function DealsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId || null;
    const hasModule = (await getUserEnabledModules(session.portalUserId ?? "", orgId)).has("deals.view");
    if (!hasModule) notFound();
  }

  const result = await getDeals({ limit: 200 });
  const deals = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Deals</h1>
        <p className="text-muted-foreground">
          Universal trade records — create a deal, add line items, generate documents.
        </p>
      </div>
      {!result.success && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {result.error}
        </div>
      )}
      <DealsPageClient initialDeals={deals} isAdmin={isAdmin(session)} />
    </div>
  );
}
