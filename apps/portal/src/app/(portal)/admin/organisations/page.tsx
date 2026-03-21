import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, orgHasFeature } from "@/lib/auth";
import { OrganisationsTable } from "@/features/organisations";
import { PeopleTable } from "@/features/organisations/components/PeopleTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@timber/ui";

export const metadata: Metadata = {
  title: "Contacts",
};

/**
 * Contacts Management Page (Admin Only)
 *
 * Allows admins to manage organisations and people.
 */
export default async function ContactsPage() {
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
        <h1 className="text-3xl font-semibold tracking-tight">Contacts</h1>
        <p className="text-muted-foreground">
          Manage organisations and people
        </p>
      </div>

      <Tabs defaultValue="organisations">
        <TabsList>
          <TabsTrigger value="organisations">Organisations</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>

        <TabsContent value="organisations" className="mt-4">
          <OrganisationsTable />
        </TabsContent>

        <TabsContent value="people" className="mt-4">
          <PeopleTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
