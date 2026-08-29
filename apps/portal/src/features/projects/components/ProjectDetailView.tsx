import { PageHeader, SectionHeader } from "@timber/ui";
import type { ProjectDetail, ProjectPartyWorkspace, ProjectsViewer } from "../types";
import { ProjectFileWorkspace } from "./ProjectFileWorkspace";
import { ProjectPartiesBlock } from "./ProjectPartiesBlock";
import { ProjectTermsCard } from "./ProjectTermsCard";
import { ProjectSpecificationEditor } from "./ProjectSpecificationEditor";
import { ProjectRfqCard } from "./ProjectRfqCard";
import { ProjectLegSelector } from "./ProjectLegSelector";
import { ProjectNextLegControl } from "./ProjectNextLegControl";
import { ProjectOfficialImages } from "./ProjectOfficialImages";
import { ProjectStatusSelect } from "./ProjectStatusSelect";
import type { ProjectStageConfiguration } from "../../project-stages/stages";
import { ProjectCommercialRollup } from "./ProjectCommercialRollup";

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
  canEditSpecification,
  canViewOfficialImages,
  canManageOfficialImages,
  canRemoveOfficialImages,
  isRfqCandidate,
  initialRfqCandidates,
  canManageRfq,
  openCreateLeg,
  stageConfiguration,
  stageUpdatedAt,
}: {
  project: ProjectDetail;
  viewer: ProjectsViewer;
  partyWorkspace: ProjectPartyWorkspace;
  canEditSpecification: boolean;
  canViewOfficialImages: boolean;
  canManageOfficialImages: boolean;
  canRemoveOfficialImages: boolean;
  isRfqCandidate: boolean;
  initialRfqCandidates: Array<{ id: string; name: string }>;
  canManageRfq: boolean;
  openCreateLeg: boolean;
  stageConfiguration: ProjectStageConfiguration;
  stageUpdatedAt: string | null;
}) {
  const currency = project.currency ?? "";
  const viewerIsSeller = viewer.organisationId != null && viewer.organisationId === partyWorkspace.seller?.id;
  const sellerIsTrader = Boolean(partyWorkspace.seller?.personas.includes("trader"));
  const supplierSeller = viewerIsSeller && !sellerIsTrader;
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
        actions={<><ProjectStatusSelect projectId={project.id} current={stageConfiguration.current} selectable={stageConfiguration.selectable} expectedUpdatedAt={stageUpdatedAt} fallbackLabel={project.stageLabel} />{partyWorkspace.canCreateSpineLeg ? <ProjectNextLegControl projectId={project.id} workspace={partyWorkspace} initialOpen={openCreateLeg} /> : null}</>}
      />

      {!isRfqCandidate ? <div className="space-y-3">
        {partyWorkspace.legOptions ? <ProjectLegSelector currentProjectId={project.id} options={partyWorkspace.legOptions} /> : null}
        <SectionHeader title="Parties" />
        <ProjectPartiesBlock projectId={project.id} workspace={partyWorkspace} />
      </div> : null}

      {canViewOfficialImages ? <ProjectOfficialImages projectId={project.id} initialFiles={project.officialImages} canManage={canManageOfficialImages} canRemove={canRemoveOfficialImages} /> : null}

      {!isRfqCandidate && project.terms ? (
        <ProjectTermsCard projectId={project.id} terms={project.terms} deliveryDeadline={project.deliveryDeadline} canEdit={viewer.canEditTerms} />
      ) : null}

      <ProjectSpecificationEditor
        projectId={project.id}
        lines={project.lines}
        currency={currency}
        canEdit={canEditSpecification}
      />

      <ProjectRfqCard projectId={project.id} currency={currency || "EUR"} canManage={canManageRfq} canEnterCandidateQuotation={viewer.isPlatformAdmin} initialOptions={initialRfqCandidates} lines={project.lines} />
      {!isRfqCandidate ? <ProjectCommercialRollup projectId={project.id} currency={currency || "EUR"} /> : null}

      <ProjectFileWorkspace
        projectId={project.id}
        initialFiles={project.files}
        initialFolders={project.folders}
        canWrite={viewer.canWriteFiles && !supplierSeller}
        canUpload={viewer.canWriteFiles || supplierSeller}
        canManageCleanup={viewer.isPlatformAdmin || (viewerIsSeller && sellerIsTrader)}
        canManageOfficialImages={canManageOfficialImages}
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
