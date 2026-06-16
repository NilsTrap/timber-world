import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getPackagingTypes } from "@/features/catalog/actions/packagingTypes";
import { PackagingTypesPage } from "@/features/catalog/components/PackagingTypesPage";

export const metadata: Metadata = { title: "Packaging" };
export const dynamic = "force-dynamic";

export default async function SettingsPackagingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("settings.view")) redirect("/dashboard");
  }

  const result = await getPackagingTypes();
  return <PackagingTypesPage types={result.success ? result.data : []} />;
}
