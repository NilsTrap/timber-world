import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@timber/ui";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import { getPersonById } from "@/features/organisations/actions/getPersonById";
import { PersonDetailTabs } from "@/features/organisations/components/PersonDetailTabs";

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
}: PersonDetailPageProps) {
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

  const personResult = await getPersonById(id);

  if (!personResult.success) {
    if (personResult.code === "NOT_FOUND") {
      notFound();
    }
    throw new Error(personResult.error);
  }

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

      <PersonDetailTabs person={personResult.data} />
    </div>
  );
}
