import {
  EmptyState,
  PageHeader,
  SectionHeader,
  SummaryCard,
  SummaryGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import { PERSONA_LABEL } from "../personas";
import type { ProjectDetail, ProjectPartyWorkspace, ProjectsViewer } from "../types";
import { ProjectStageBadge } from "./ProjectStageBadge";
import { ProjectFileWorkspace } from "./ProjectFileWorkspace";
import { ProjectPartiesBlock } from "./ProjectPartiesBlock";

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
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/projects"
        backLabel="Back to projects"
        title={project.reference}
        subtitle={project.name ?? undefined}
        badge={<ProjectStageBadge stage={project.stage} label={project.stageLabel} />}
        actions={
          <span className="text-xs text-muted-foreground">
            {viewer.isPlatformAdmin
              ? "Platform admin"
              : viewer.personas.map((p) => PERSONA_LABEL[p]).join(" · ")}
          </span>
        }
      />

      <SummaryGrid columns={4}>
        <SummaryCard label="Your side" value={project.direction === "sell" ? "Selling" : "Buying"} />
        <SummaryCard label="Counterparty" value={project.counterparty?.name ?? "—"} />
        <SummaryCard label="Delivery" value={project.deliveryDeadline ?? "—"} />
        <SummaryCard label="Files" value={String(project.fileCounts.total)} />
      </SummaryGrid>

      <div className="space-y-3">
        <SectionHeader title="Parties" />
        <ProjectPartiesBlock projectId={project.id} workspace={partyWorkspace} />
      </div>

      {project.terms ? (
        <div className="space-y-3">
          <SectionHeader title="Terms" />
          <SummaryGrid columns={4}>
            <SummaryCard
              label="Incoterms"
              value={
                [project.terms.incoterms, project.terms.incotermsPlace]
                  .filter(Boolean)
                  .join(" ") || "—"
              }
            />
            <SummaryCard label="Payment" value={project.terms.paymentTerms ?? "—"} />
            <SummaryCard label="Delivery" value={project.terms.deliveryTerms ?? "—"} />
            <SummaryCard
              label="Advance"
              value={project.terms.advancePct != null ? `${project.terms.advancePct}%` : "—"}
            />
          </SummaryGrid>
        </div>
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
