import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { getCategories } from "@/features/catalog/actions/categories";
import { CatalogPageContent } from "@/features/catalog/components/CatalogPageContent";

export const metadata: Metadata = { title: "Product Catalog" };

export default async function CatalogPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) redirect("/dashboard");

  const result = await getCategories();
  const categories = result.success ? result.data : [];

  return <CatalogPageContent categories={categories} />;
}
