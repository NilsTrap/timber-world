import { PageHeader, SectionHeader } from "@timber/ui";
import type { ProjectDetail, ProjectPartyWorkspace, ProjectsViewer } from "../types";
import { ProjectStageBadge } from "./ProjectStageBadge";
import { ProjectFileWorkspace } from "./ProjectFileWorkspace";
import { ProjectPartiesBlock } from "./ProjectPartiesBlock";
import { ProjectTermsCard } from "./ProjectTermsCard";
import { ProjectSpecificationEditor } from "./ProjectSpecificationEditor";
import { ProjectRfqCard } from "./ProjectRfqCard";
import { ProjectLegSelector } from "./ProjectLegSelector";
import { ProjectNextLegControl } from "./ProjectNextLegControl";

/**
 * Project detail (server component).
 *
 * Every optional block below is driven by the PRESENCE OF A KEY in the payload,
 * never by a permission check re-done in the UI: `terms` is absent for a viewer
 * without `deal_terms`, `otherParties` has no entry for a party the field wall
 * hid, and line prices are simply not there. Rendering is therefore incapable
 * of leaking — there is nothing to leak.
 */
export function ProjectDetailView({
  project,
  viewer,
  partyWorkspace,
  isRfqCandidate,
  initialRfqCandidates,
  canManageRfq,
}: {
  project: ProjectDetail;
  viewer: ProjectsViewer;
  partyWorkspace: ProjectPartyWorkspace;
  isRfqCandidate: boolean;
  initialRfqCandidates: Array<{ id: string; name: string }>;
  canManageRfq: boolean;
}) {
  const currency = project.currency ?? "";
  const projectName = project.name?.trim();
  const subtitleParts = [
    project.displaySpineCode ? `Spine ID: ${project.displaySpineCode}` : null,
    projectName ? `Leg: ${project.reference}` : null,
  ].filter(Boolean);
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/projects"
        backLabel="Back to projects"
        title={projectName || project.reference}
        subtitle={subtitleParts.length > 0 ? subtitleParts.join(" · ") : undefined}
        badge={<ProjectStageBadge stage={project.stage} label={project.stageLabel} />}
      />

      {!isRfqCandidate ? <div className="space-y-3">
        {partyWorkspace.legOptions ? <ProjectLegSelector currentProjectId={project.id} options={partyWorkspace.legOptions} /> : null}
        <SectionHeader title="Parties" />
        <ProjectPartiesBlock projectId={project.id} workspace={partyWorkspace} />
        {partyWorkspace.canAppendNextSeller ? <ProjectNextLegControl projectId={project.id} options={partyWorkspace.nextSellerOptions} /> : null}
      </div> : null}

      {!isRfqCandidate && project.terms ? (
        <ProjectTermsCard projectId={project.id} terms={project.terms} deliveryDeadline={project.deliveryDeadline} canEdit={viewer.canEditTerms} />
      ) : null}

      <ProjectSpecificationEditor
        projectId={project.id}
        lines={project.lines}
        currency={currency}
        canEdit={viewer.canEditTerms && project.stage === "draft"}
      />

      {(canManageRfq || isRfqCandidate) ? (
        <ProjectRfqCard projectId={project.id} currency={currency || "EUR"} canManage={canManageRfq} initialOptions={initialRfqCandidates} />
      ) : null}

      <ProjectFileWorkspace
        projectId={project.id}
        initialFiles={project.files}
        initialFolders={project.folders}
        canWrite={viewer.canWriteFiles}
        canManageCleanup={viewer.isPlatformAdmin || project.direction === "sell"}
      />

      {project.notes ? (
        <div className="space-y-3">
          <SectionHeader title="Notes" />
          <div className="rounded-lg border bg-card p-4 text-sm whitespace-pre-wrap">
            {project.notes}
          </div>
        </div>
      ) : null}
    </div>
  );
}
