import { PageHeader, SectionHeader } from "@timber/ui";
import type { ProjectDetail, ProjectPartyWorkspace, ProjectsViewer } from "../types";
import { ProjectStageBadge } from "./ProjectStageBadge";
import { ProjectFileWorkspace } from "./ProjectFileWorkspace";
import { ProjectPartiesBlock } from "./ProjectPartiesBlock";
import { ProjectTermsCard } from "./ProjectTermsCard";
import { ProjectSpecificationEditor } from "./ProjectSpecificationEditor";

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
}: {
  project: ProjectDetail;
  viewer: ProjectsViewer;
  partyWorkspace: ProjectPartyWorkspace;
}) {
  const currency = project.currency ?? "";
  const projectName = project.name?.trim();
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/projects"
        backLabel="Back to projects"
        title={projectName || project.reference}
        subtitle={projectName ? project.reference : undefined}
        badge={<ProjectStageBadge stage={project.stage} label={project.stageLabel} />}
      />

      <div className="space-y-3">
        <SectionHeader title="Parties" />
        <ProjectPartiesBlock projectId={project.id} workspace={partyWorkspace} />
      </div>

      {project.terms ? (
        <ProjectTermsCard projectId={project.id} terms={project.terms} deliveryDeadline={project.deliveryDeadline} canEdit={viewer.canEditTerms} />
      ) : null}

      <ProjectSpecificationEditor
        projectId={project.id}
        lines={project.lines}
        currency={currency}
        canEdit={viewer.canEditTerms && project.stage === "draft"}
      />

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
