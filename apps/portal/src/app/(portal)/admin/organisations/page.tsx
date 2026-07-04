import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, isSuperAdmin, getUserEnabledModules } from "@/lib/auth";
import { UsersPageTabs } from "@/features/organisations/components/UsersPageTabs";

export const metadata: Metadata = {
  title: "Orgs & People",
};

/**
 * Orgs & People Management Page (Admin Only)
 *
 * Allows admins to manage organisations and people (portal logins).
 */
export default async function UsersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("organizations.view")) {
      notFound();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orgs &amp; People</h1>
        <p className="text-muted-foreground">
          Manage organisations and people
        </p>
      </div>

      {/* People directory is cross-org → admin-only. Org-scoped viewers with the
          organizations.view module still see the Organisations tab only. */}
      <UsersPageTabs canManagePeople={isSuperAdmin(session)} />
    </div>
  );
}
