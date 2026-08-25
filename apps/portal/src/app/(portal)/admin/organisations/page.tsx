import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, isPlatformAdmin, getUserEnabledModules } from "@/lib/auth";
import { UsersPageTabs } from "@/features/organisations/components/UsersPageTabs";

export const metadata: Metadata = {
  title: "Companies",
};

/**
 * Orgs & People Management Page (Admin Only)
 *
 * Allows admins to manage organisations and people (portal logins).
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
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
        <h1 className="text-3xl font-semibold tracking-tight">Companies</h1>
        <p className="text-muted-foreground">
          Manage company records, roles, people and access
        </p>
      </div>

      {/* People directory is cross-company and therefore platform-admin only. */}
      <UsersPageTabs
        canManagePeople={isPlatformAdmin(session)}
        defaultTab={(await searchParams).tab === "people" ? "people" : "companies"}
      />
    </div>
  );
}
