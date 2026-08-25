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
import type { ProjectDetail, ProjectsViewer } from "../types";
import { PersonaBadges } from "./PersonaBadges";
import { ProjectStageBadge } from "./ProjectStageBadge";
import { ProjectFileWorkspace } from "./ProjectFileWorkspace";

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
}: {
  project: ProjectDetail;
  viewer: ProjectsViewer;
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
        <div className="grid gap-3 sm:grid-cols-2">
          {project.counterparty ? (
            <PartyCard
              role={project.direction === "sell" ? "Customer" : "Supplier"}
              name={project.counterparty.name}
              code={project.counterparty.code}
              personas={project.counterparty.personas}
            />
          ) : null}
          {project.otherParties.map((party) => (
            <PartyCard
              key={party.id}
              role={partyRoleLabel(party.role)}
              name={party.name}
              code={party.code}
              personas={party.personas}
            />
          ))}
          {!project.counterparty && project.otherParties.length === 0 ? (
            <EmptyState message="No parties are visible to you on this project." />
          ) : null}
        </div>
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

      <div className="space-y-3">
        <SectionHeader
          title="Files"
          subtitle={`${project.fileCounts.total} file(s) on this project`}
        />
        <ProjectFileWorkspace
          projectId={project.id}
          initialFiles={project.files}
          initialFolders={project.folders}
          canWrite={viewer.canWriteFiles}
        />
      </div>

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

const PARTY_ROLE_LABEL: Record<string, string> = {
  customer: "Customer",
  seller: "Seller",
  producer: "Producer",
  buyer: "Buyer",
};

function partyRoleLabel(role: string | undefined): string {
  return (role && PARTY_ROLE_LABEL[role]) || "Party";
}

function PartyCard({
  role,
  name,
  code,
  personas,
}: {
  role: string;
  name: string | null;
  code: string | null;
  personas: ProjectDetail["otherParties"][number]["personas"];
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{role}</p>
      <p className="text-base font-semibold truncate">{name ?? "—"}</p>
      <div className="mt-2 flex items-center gap-2">
        {code ? <span className="text-xs text-muted-foreground">{code}</span> : null}
        <PersonaBadges personas={personas} />
      </div>
    </div>
  );
}

function formatCents(cents: number | null | undefined, currency: string): string {
  if (cents == null) return "—";
  const amount = (cents / 100).toFixed(2);
  return currency ? `${amount} ${currency}` : amount;
}
