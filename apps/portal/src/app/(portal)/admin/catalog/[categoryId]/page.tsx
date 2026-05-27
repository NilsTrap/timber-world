import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { getCategory } from "@/features/catalog/actions/categories";
import { getCategoryFields } from "@/features/catalog/actions/fields";
import { getProducts } from "@/features/catalog/actions/products";
import { CategoryDetailTabs } from "@/features/catalog/components/CategoryDetailTabs";

export const metadata: Metadata = { title: "Category Detail" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ categoryId: string }>;
}

export default async function CategoryDetailPage({ params }: Props) {
  const { categoryId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) redirect("/dashboard");

  const [catResult, fieldsResult, productsResult] = await Promise.all([
    getCategory(categoryId),
    getCategoryFields(categoryId),
    getProducts(categoryId),
  ]);

  if (!catResult.success) notFound();

  return (
    <CategoryDetailTabs
      category={catResult.data}
      fields={fieldsResult.success ? fieldsResult.data : []}
      products={productsResult.success ? productsResult.data : []}
    />
  );
}
