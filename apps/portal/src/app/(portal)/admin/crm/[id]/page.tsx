import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, orgHasFeature } from "@/lib/auth";
import {
  getCompanyById,
  getKeywords,
  getCompanyKeywords,
  getIndustries,
  getCompanyIndustries,
  getCompanyTypes,
  getCompanyCompanyTypes,
  CompanyDetail,
} from "@/features/crm";

interface CompanyPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CompanyPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getCompanyById(id);

  if (!result.success) {
    return { title: "Company Not Found" };
  }

  return {
    title: `${result.data.name} - CRM`,
  };
}

/**
 * Company Detail Page (Admin Only)
 *
 * View and edit company details and contacts.
 */
export default async function CompanyPage({ params }: CompanyPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const hasFeature = await orgHasFeature(orgId, "crm.view");
    if (!hasFeature) {
      notFound();
    }
  }

  const { id } = await params;
  const [companyResult, keywordsResult, companyKeywordsResult, industriesResult, companyIndustriesResult, companyTypesResult, companyCompanyTypesResult] = await Promise.all([
    getCompanyById(id),
    getKeywords(),
    getCompanyKeywords(id),
    getIndustries(),
    getCompanyIndustries(id),
    getCompanyTypes(),
    getCompanyCompanyTypes(id),
  ]);

  if (!companyResult.success) {
    notFound();
  }

  const allKeywords = keywordsResult.success ? keywordsResult.data ?? [] : [];
  const companyKeywords = companyKeywordsResult.success ? companyKeywordsResult.data ?? [] : [];
  const allIndustries = industriesResult.success ? industriesResult.data ?? [] : [];
  const companyIndustries = companyIndustriesResult.success ? companyIndustriesResult.data ?? [] : [];
  const allCompanyTypes = companyTypesResult.success ? companyTypesResult.data ?? [] : [];
  const companyCompanyTypes = companyCompanyTypesResult.success ? companyCompanyTypesResult.data ?? [] : [];

  return (
    <CompanyDetail
      company={companyResult.data}
      companyKeywords={companyKeywords}
      allKeywords={allKeywords}
      companyIndustries={companyIndustries}
      allIndustries={allIndustries}
      companyTypes={companyCompanyTypes}
      allCompanyTypes={allCompanyTypes}
    />
  );
}
