import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getCategories } from "@/features/catalog/actions/categories";
import { getPricingUnits } from "@/features/catalog/actions/pricingUnits";
import { CatalogPageContent } from "@/features/catalog/components/CatalogPageContent";

export const metadata: Metadata = { title: "Product Catalog" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) redirect("/dashboard");
  }

  const [result, unitsResult] = await Promise.all([getCategories(), getPricingUnits()]);
  const categories = result.success ? result.data : [];
  const pricingUnits = unitsResult.success ? unitsResult.data : [];

  return <CatalogPageContent categories={categories} pricingUnits={pricingUnits} />;
}
