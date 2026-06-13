import { notFound, redirect } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { TrackingSetDetailPage } from "@/features/production/components/TrackingSetDetailPage";

export const dynamic = "force-dynamic";

export default async function TrackingDetailRoute() {
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
  return <TrackingSetDetailPage />;
}
