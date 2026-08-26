import Link from "next/link";
import { Plus } from "lucide-react";
import {
  Button,
  EmptyState,
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
import type { ProjectListItem, ProjectsViewer } from "../types";
import { PersonaBadges } from "./PersonaBadges";
import { ProjectStageBadge } from "./ProjectStageBadge";

/**
 * Projects list (server component).
 *
 * Renders ONLY what the loader serialized. There is no "hidden" markup: a field
 * the viewer may not see never reaches this component, so there is nothing here
 * to reveal with dev tools or a stylesheet override.
 */
export function ProjectsListView({
  items,
  viewer,
}: {
  items: ProjectListItem[];
  viewer: ProjectsViewer;
}) {
  const sellCount = items.filter((i) => !i.rfqInvitation && i.direction === "sell").length;
  const buyCount = items.filter((i) => !i.rfqInvitation && i.direction === "buy").length;
  const fileCount = items.reduce((sum, i) => sum + i.fileCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Every deal you can see, as a project workspace.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <ViewerStrip viewer={viewer} />
          {viewer.canCreateProject ? (
            <Button asChild size="sm"><Link href="/projects/new"><Plus className="mr-1.5 h-4 w-4" /> New project</Link></Button>
          ) : null}
        </div>
      </div>

      <SummaryGrid columns={4}>
        <SummaryCard label="Projects" value={String(items.length)} />
        <SummaryCard label="Selling" value={String(sellCount)} />
        <SummaryCard label="Buying" value={String(buyCount)} />
        <SummaryCard label="Files" value={String(fileCount)} />
      </SummaryGrid>

      {items.length === 0 ? (
        <EmptyState message={viewer.canCreateProject ? "No projects yet. Create the first project." : "No projects yet. Projects appear here as soon as you are a party to a deal."} />
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table dense>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="hidden md:table-cell">Delivery</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Files</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      href={`/projects/${item.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[18rem] truncate">{item.name ?? "—"}</TableCell>
                  <TableCell className="capitalize">{item.rfqInvitation ? "RFQ" : item.direction}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1">
                      <span>{item.counterparty?.name ?? "—"}</span>
                      {item.counterparty ? (
                        <PersonaBadges personas={item.counterparty.personas} />
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ProjectStageBadge stage={item.stage} label={item.stageLabel} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {item.deliveryDeadline ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-right">{item.fileCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** Who you are looking as — organisation + its persona labels. */
function ViewerStrip({ viewer }: { viewer: ProjectsViewer }) {
  return (
    <div className="text-right">
      <p className="text-sm font-medium">
        {viewer.organisationName ?? "Timber World Platform"}
      </p>
      <p className="text-xs text-muted-foreground">
        {viewer.isPlatformAdmin
          ? "Platform admin"
          : viewer.personas.length > 0
            ? viewer.personas.map((p) => PERSONA_LABEL[p]).join(" · ")
            : "No role assigned"}
      </p>
    </div>
  );
}
