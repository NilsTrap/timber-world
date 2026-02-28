import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import {
  getCompanyById,
  getKeywords,
  getCompanyKeywords,
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
    redirect("/dashboard?access_denied=true");
  }

  const { id } = await params;
  const [companyResult, keywordsResult, companyKeywordsResult] = await Promise.all([
    getCompanyById(id),
    getKeywords(),
    getCompanyKeywords(id),
  ]);

  if (!companyResult.success) {
    notFound();
  }

  const allKeywords = keywordsResult.success ? keywordsResult.data ?? [] : [];
  const companyKeywords = companyKeywordsResult.success ? companyKeywordsResult.data ?? [] : [];

  return (
    <CompanyDetail
      company={companyResult.data}
      companyKeywords={companyKeywords}
      allKeywords={allKeywords}
    />
  );
}
