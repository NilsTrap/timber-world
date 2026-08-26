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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getProject(id);
  if (!res.ok) {
    if (res.deny === "login") redirect("/login");
    notFound();
  }
  const candidates = res.viewer.canCreateProject && res.project.stage === "draft"
    ? await getEligibleProjectRfqCandidates(id)
    : null;
  return <ProjectDetailView project={res.project} viewer={res.viewer} partyWorkspace={res.partyWorkspace} isRfqCandidate={res.isRfqCandidate} initialRfqCandidates={candidates?.success ? candidates.data : []} />;
}
