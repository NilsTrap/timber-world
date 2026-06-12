import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getAllProducts } from "@/features/catalog/actions/allProducts";
import { getCategories } from "@/features/catalog/actions/categories";
import { AllProductsPage } from "@/features/catalog/components/AllProductsPage";

export const metadata: Metadata = { title: "All Products" };
export const dynamic = "force-dynamic";

export default async function CatalogProductsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) redirect("/dashboard");
  }

  const [productsResult, categoriesResult] = await Promise.all([
    getAllProducts(),
    getCategories(),
  ]);

  return (
    <AllProductsPage
      products={productsResult.success ? productsResult.data : []}
      categories={categoriesResult.success ? categoriesResult.data : []}
    />
  );
}
