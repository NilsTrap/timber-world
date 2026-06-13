import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getProductionPlan } from "@/features/production/actions";
import { ProductionPlanDetailClient } from "@/features/production/components/ProductionPlanDetailClient";

export const metadata: Metadata = {
  title: "Production Plan",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductionPlanPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  // Two-layer module gate: admins bypass; everyone else needs production.view
  // (org-enabled AND user-enabled). Mirrors production/page.tsx deny behavior.
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("production.view")) {
      notFound();
    }
  }
  const result = await getProductionPlan(id);
  if (!result.success) {
    notFound();
  }
  return <ProductionPlanDetailClient plan={result.data} />;
}
