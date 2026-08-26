import {
  EmptyState,
  PageHeader,
  SectionHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import type { ProjectDetail, ProjectPartyWorkspace, ProjectsViewer } from "../types";
import { ProjectStageBadge } from "./ProjectStageBadge";
import { ProjectFileWorkspace } from "./ProjectFileWorkspace";
import { ProjectPartiesBlock } from "./ProjectPartiesBlock";
import { ProjectTermsCard } from "./ProjectTermsCard";

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

      <div className="space-y-3">
        <SectionHeader title="Specification" subtitle={`${project.lines.length} line(s)`} />
        {project.lines.length === 0 ? (
          <EmptyState message="No specification lines on this project yet." />
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table dense>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden md:table-cell">Species</TableHead>
                  <TableHead className="hidden lg:table-cell">Dimensions</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  {project.terms ? <TableHead className="text-right">Unit price</TableHead> : null}
                  {project.terms ? <TableHead className="text-right">Total</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.lines.map((line) => (
                  <TableRow key={line.id ?? `${line.lineNo}`}>
                    <TableCell>{line.lineNo}</TableCell>
                    <TableCell className="max-w-[16rem] truncate">
                      {line.productName ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{line.woodSpecies ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {[line.thickness, line.width, line.length].filter(Boolean).join(" × ") || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {line.volumeM3 != null ? line.volumeM3 : (line.pieces ?? "—")}
                    </TableCell>
                    <TableCell>{line.unit}</TableCell>
                    {project.terms ? (
                      <TableCell className="text-right">
                        {formatCents(line.unitPriceCents, currency)}
                      </TableCell>
                    ) : null}
                    {project.terms ? (
                      <TableCell className="text-right">
                        {formatCents(line.lineTotalCents, currency)}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

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

function formatCents(cents: number | null | undefined, currency: string): string {
  if (cents == null) return "—";
  const amount = (cents / 100).toFixed(2);
  return currency ? `${amount} ${currency}` : amount;
}
