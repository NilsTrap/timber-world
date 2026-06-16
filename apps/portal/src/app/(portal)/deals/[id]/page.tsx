import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getDeal } from "@/features/deals/actions";
import { DealDetailClient } from "@/features/deals/components";

export const metadata = {
  title: "Deal | Timber World",
};

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId || null;
    const hasModule = (await getUserEnabledModules(session.portalUserId ?? "", orgId)).has("deals.view");
    if (!hasModule) notFound();
  }

  const result = await getDeal(id);
  if (!result.success) notFound();

  return <DealDetailClient deal={result.data} />;
}
