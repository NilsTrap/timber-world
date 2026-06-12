import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getCurrencies } from "@/features/catalog/actions/currencies";
import { CurrenciesPage } from "@/features/catalog/components/CurrenciesPage";

export const metadata: Metadata = { title: "Currencies" };
export const dynamic = "force-dynamic";

export default async function CurrenciesRoute() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) redirect("/dashboard");
  }

  const result = await getCurrencies();
  return <CurrenciesPage currencies={result.success ? result.data : []} />;
}
