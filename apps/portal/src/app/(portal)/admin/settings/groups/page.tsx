import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { GroupManager, AddressBooksCard } from "@/features/access/components";
import { Card, CardContent } from "@timber/ui";

export const metadata: Metadata = { title: "Access Groups" };
export const dynamic = "force-dynamic";

/**
 * Access Groups configuration (Admin only, E4) — manage the platform-wide
 * access groups (modules, deal visibility, field domains, per-field
 * overrides, actions) and per-book platform settings. Rights are edited
 * in-app, never in code: changes apply to members immediately.
 */
export default async function AccessGroupsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Access Groups</h1>
        <p className="text-muted-foreground">
          Manage the platform-wide access groups that grant modules, deal visibility, and field
          rights to users.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <GroupManager />
        </CardContent>
      </Card>

      <AddressBooksCard />
    </div>
  );
}
