import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getAllFields } from "@/features/catalog/actions/fields";
import { GlobalFieldsPage } from "@/features/catalog/components/GlobalFieldsPage";

export const metadata: Metadata = { title: "Fields" };
export const dynamic = "force-dynamic";

export default async function SettingsFieldsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) redirect("/dashboard");
  }

  const result = await getAllFields();
  const fields = result.success ? result.data : [];

  return <GlobalFieldsPage fields={fields} />;
}
