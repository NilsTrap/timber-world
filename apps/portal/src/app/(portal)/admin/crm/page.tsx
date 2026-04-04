import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import {
  getCompanies,
  getAllContacts,
  getKeywords,
  getIndustries,
  getCompanyTypes,
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
    const orgId = session.currentOrganizationId || session.organisationId;
    const hasModule = await orgHasModule(orgId, "crm.view");
    if (!hasModule) {
      notFound();
    }
  }

  const [companiesResult, contactsResult, keywordsResult, industriesResult, companyTypesResult] = await Promise.all([
    getCompanies(),
    getAllContacts(),
    getKeywords(),
    getIndustries(),
    getCompanyTypes(),
  ]);

  const companies = companiesResult.success ? companiesResult.data ?? [] : [];
  const contacts = contactsResult.success ? contactsResult.data ?? [] : [];
  const keywords = keywordsResult.success ? keywordsResult.data ?? [] : [];
  const industries = industriesResult.success ? industriesResult.data ?? [] : [];
  const companyTypes = companyTypesResult.success ? companyTypesResult.data ?? [] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">CRM</h1>
        <p className="text-muted-foreground">
          Discover and manage company leads and contacts
        </p>
      </div>

      <CrmPageContent companies={companies} contacts={contacts} keywords={keywords} industries={industries} companyTypes={companyTypes} />
    </div>
  );
}
