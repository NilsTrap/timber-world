import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getPricingUnits } from "@/features/catalog/actions/pricingUnits";
import { PricingUnitsPage } from "@/features/catalog/components/PricingUnitsPage";

export const metadata: Metadata = { title: "Pricing Units" };
export const dynamic = "force-dynamic";

export default async function SettingsPricingUnitsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) redirect("/dashboard");
  }

  const result = await getPricingUnits();
  return <PricingUnitsPage units={result.success ? result.data : []} />;
}
