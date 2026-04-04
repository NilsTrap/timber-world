import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@timber/ui";
import { getSession, isAdmin, orgHasFeature } from "@/lib/auth";
import { getPersonById } from "@/features/organisations/actions/getPersonById";
import { PersonDetailTabs } from "@/features/organisations/components/PersonDetailTabs";
import { getRoles, getFeaturesByCategory } from "@/features/roles/actions";

interface PersonDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({
  params,
}: PersonDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getPersonById(id);

  if (!result.success) {
    return { title: "Person Not Found" };
  }

  return {
    title: `${result.data.name} - Person`,
  };
}

export default async function PersonDetailPage({
  params,
  searchParams,
}: PersonDetailPageProps) {
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

  const { id } = await params;
  const { tab } = await searchParams;

  const [personResult, rolesResult, featuresResult] = await Promise.all([
    getPersonById(id),
    getRoles(),
    getFeaturesByCategory(),
  ]);

  if (!personResult.success) {
    if (personResult.code === "NOT_FOUND") {
      notFound();
    }
    throw new Error(personResult.error);
  }

  const roles = rolesResult.success ? rolesResult.data ?? [] : [];
  const featuresByCategory = featuresResult.success ? featuresResult.data ?? {} : {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/organisations">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Users</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {personResult.data.name}
          </h1>
          <p className="text-muted-foreground">{personResult.data.email}</p>
        </div>
      </div>

      <PersonDetailTabs
        person={personResult.data}
        roles={roles}
        featuresByCategory={featuresByCategory}
        defaultTab={tab}
      />
    </div>
  );
}
