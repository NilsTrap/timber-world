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
import { Fragment } from "react";
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
                {project.lines.map((line) => {
                  // Persisted component cents are canonical so displayed rows,
                  // the cost summary, and margin always reconcile exactly.
                  const componentCost = line.components?.reduce(
                    (sum, component) => sum + component.totalCostCents,
                    0,
                  ) ?? 0;
                  const margin = line.lineTotalCents == null ? null : line.lineTotalCents - componentCost;
                  return (
                  <Fragment key={line.id ?? `${line.lineNo}`}>
                  <TableRow>
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
                  {line.notes || (line.components?.length ?? 0) > 0 ? (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell />
                      <TableCell colSpan={project.terms ? 7 : 5} className="py-3">
                        {line.notes ? <p className="mb-3 text-xs text-muted-foreground">{line.notes}</p> : null}
                        {(line.components?.length ?? 0) > 0 ? (
                          <div className="max-w-3xl space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cost build-up</p>
                            <div className="overflow-hidden rounded-md border bg-background">
                              {line.components?.map((component) => (
                                <div key={component.id} className="grid grid-cols-[minmax(8rem,1fr)_5rem_6rem_7rem] gap-3 border-b px-3 py-2 text-xs last:border-b-0">
                                  <div className="min-w-0">
                                    <span className="font-medium">{component.name}</span>
                                    <span className="ml-2 text-muted-foreground capitalize">· {component.type}</span>
                                  </div>
                                  <span className="text-right tabular-nums">{formatNumber(component.quantity)} {component.unit}</span>
                                  <span className="text-right tabular-nums">× {formatNumber(component.unitCost)}</span>
                                  <span className="text-right font-medium tabular-nums">{formatCents(component.totalCostCents, currency)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-xs">
                              <span>Internal cost <strong>{formatCents(componentCost, currency)}</strong></span>
                              {margin != null ? <span>Margin <strong>{formatCents(margin, currency)}</strong></span> : null}
                            </div>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  </Fragment>
                  );
                })}
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 4 }).format(value);
}

function formatCents(cents: number | null | undefined, currency: string): string {
  if (cents == null) return "—";
  const amount = (cents / 100).toFixed(2);
  return currency ? `${amount} ${currency}` : amount;
}
