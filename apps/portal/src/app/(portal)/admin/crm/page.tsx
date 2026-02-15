import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@timber/ui";
import { getSession, isAdmin } from "@/lib/auth";
import {
  getCompanies,
  getAllContacts,
  CompaniesTable,
  AllContactsTable,
  DiscoverTab,
} from "@/features/crm";

export const metadata: Metadata = {
  title: "CRM - Companies & Contacts",
};

/**
 * CRM Page (Admin Only)
 *
 * Manage companies and contacts for lead generation.
 */
export default async function CrmPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin(session)) {
    redirect("/dashboard?access_denied=true");
  }

  const [companiesResult, contactsResult] = await Promise.all([
    getCompanies(),
    getAllContacts(),
  ]);

  const companies = companiesResult.success ? companiesResult.data : [];
  const contacts = contactsResult.success ? contactsResult.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">CRM</h1>
        <p className="text-muted-foreground">
          Discover and manage company leads and contacts
        </p>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">
            Companies ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="discover">
            Discover
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="mt-4">
          <CompaniesTable companies={companies} />
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <AllContactsTable contacts={contacts} />
        </TabsContent>

        <TabsContent value="discover" className="mt-4">
          <DiscoverTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
