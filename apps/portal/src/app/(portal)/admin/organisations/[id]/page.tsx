import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import { getOrganisationById } from "@/features/organisations/actions/getOrganisationById";
import { OrganisationDetailTabs } from "@/features/organisations/components/OrganisationDetailTabs";
import { OrganisationEntryMemory } from "@/features/organisations/components/OrganisationEntryMemory";
import { OrganisationBackLink } from "@/features/organisations/components/OrganisationBackLink";

interface OrganisationDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({
  params,
}: OrganisationDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getOrganisationById(id);

  if (!result.success) {
    return { title: "Organisation Not Found" };
  }

  return {
    title: `${result.data.name} - Organisation`,
  };
}

/**
 * Organisation Detail Page (Admin Only)
 *
 * Displays organisation details with tabs for Details and Users.
 */
export default async function OrganisationDetailPage({
  params,
  searchParams,
}: OrganisationDetailPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const hasModule = await orgHasModule(orgId, "organizations.view");
    if (!hasModule) {
      notFound();
    }
  }

  const { id } = await params;
  const { tab } = await searchParams;

  const result = await getOrganisationById(id);

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      notFound();
    }
    throw new Error(result.error);
  }

  const organisation = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <OrganisationBackLink />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {organisation.name}
          </h1>
          <p className="text-muted-foreground font-mono">{organisation.code}</p>
        </div>
      </div>

      <OrganisationDetailTabs organisation={organisation} defaultTab={tab} />
      <OrganisationEntryMemory />
    </div>
  );
}
