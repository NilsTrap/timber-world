import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import {
  getCompanies,
  getAllContacts,
  getKeywords,
  CrmPageContent,
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

  const [companiesResult, contactsResult, keywordsResult] = await Promise.all([
    getCompanies(),
    getAllContacts(),
    getKeywords(),
  ]);

  const companies = companiesResult.success ? companiesResult.data ?? [] : [];
  const contacts = contactsResult.success ? contactsResult.data ?? [] : [];
  const keywords = keywordsResult.success ? keywordsResult.data ?? [] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">CRM</h1>
        <p className="text-muted-foreground">
          Discover and manage company leads and contacts
        </p>
      </div>

      <CrmPageContent companies={companies} contacts={contacts} keywords={keywords} />
    </div>
  );
}
