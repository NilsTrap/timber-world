import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, orgHasFeature } from "@/lib/auth";
import { UsersPageTabs } from "@/features/organisations/components/UsersPageTabs";

export const metadata: Metadata = {
  title: "Users",
};

/**
 * Users Management Page (Admin Only)
 *
 * Allows admins to manage organisations and people.
 */
export default async function UsersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const hasFeature = await orgHasFeature(orgId, "organizations.view");
    if (!hasFeature) {
      notFound();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage organisations and people
        </p>
      </div>

      <UsersPageTabs />
    </div>
  );
}
