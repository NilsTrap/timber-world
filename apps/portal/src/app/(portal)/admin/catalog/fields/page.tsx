import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { getAllFields } from "@/features/catalog/actions/fields";
import { GlobalFieldsPage } from "@/features/catalog/components/GlobalFieldsPage";

export const metadata: Metadata = { title: "Catalog Fields" };
export const dynamic = "force-dynamic";

export default async function CatalogFieldsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) redirect("/dashboard");

  const result = await getAllFields();
  const fields = result.success ? result.data : [];

  return <GlobalFieldsPage fields={fields} />;
}
