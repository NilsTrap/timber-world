import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProject } from "@/features/projects/actions/getProject";
import { getEligibleProjectRfqCandidates } from "@/features/projects/actions/projectRfqActions";
import { ProjectDetailView } from "@/features/projects/components/ProjectDetailView";

export const metadata: Metadata = {
  title: "Project | Nilitto",
};

export const dynamic = "force-dynamic";

/**
 * Project detail.
 *
 * A project id the viewer may not access, an id that does not exist and a
 * malformed id all end on the SAME `notFound()` — pasting a colleague's URL
 * tells you nothing.
 */
export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ createLeg?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const openCreateLeg = (Array.isArray(query.createLeg) ? query.createLeg[0] : query.createLeg) === "1";
  const res = await getProject(id);
  if (!res.ok) {
    if (res.deny === "login") redirect("/login");
    notFound();
  }
  const canManageRfq = !!res.partyWorkspace.buyer && !res.partyWorkspace.seller
    && (res.viewer.isPlatformAdmin || (
      res.viewer.organisationId === res.partyWorkspace.buyer.id
      && res.viewer.personas.includes("trader")
    ));
  const candidates = canManageRfq
    ? await getEligibleProjectRfqCandidates(id)
    : null;
  return <ProjectDetailView project={res.project} viewer={res.viewer} partyWorkspace={res.partyWorkspace} canEditSpecification={res.canEditSpecification} canManageOfficialImages={res.canManageOfficialImages} isRfqCandidate={res.isRfqCandidate} initialRfqCandidates={candidates?.success ? candidates.data : []} canManageRfq={canManageRfq} openCreateLeg={openCreateLeg} stageConfiguration={res.stageConfiguration} stageUpdatedAt={res.stageUpdatedAt} />;
}
