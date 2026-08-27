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
import type { ProjectListFilters as ProjectListFilterState } from "../types";
import { ProjectStageBadge } from "./ProjectStageBadge";
import { ProjectsListFilters } from "./ProjectsListFilters";

const MONEY_FORMATTERS = new Map<string, Intl.NumberFormat>();
function formatMoney(valueCents: number | null | undefined, currency: string | undefined): string {
  if (valueCents == null || !currency) return "—";
  try {
    const formatter = MONEY_FORMATTERS.get(currency) ?? new Intl.NumberFormat("en-GB", { style: "currency", currency });
    MONEY_FORMATTERS.set(currency, formatter);
    return formatter.format(valueCents / 100);
  } catch {
    return "—";
  }
}

/**
 * Projects list (server component).
 *
 * Renders ONLY what the loader serialized. There is no "hidden" markup: a field
 * the viewer may not see never reaches this component, so there is nothing here
 * to reveal with dev tools or a stylesheet override.
 */
export function ProjectsListView({
  items,
  allItems,
  viewer,
  filters,
  filterOptions,
}: {
  items: ProjectListItem[];
  allItems: ProjectListItem[];
  viewer: ProjectsViewer;
  filters: ProjectListFilterState;
  filterOptions: Parameters<typeof ProjectsListFilters>[0]["options"];
}) {
  const projectCount = new Set(items.map((item) => item.groupKey)).size;
  const partyCount = new Set(items.flatMap((item) => [item.buyer?.id, item.seller?.id]).filter(Boolean)).size;
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
        <SummaryCard label="Projects" value={String(projectCount)} />
        <SummaryCard label="Visible legs" value={String(items.length)} />
        <SummaryCard label="Counterparties" value={String(partyCount)} />
        <SummaryCard label="Files" value={String(fileCount)} />
      </SummaryGrid>

      <ProjectsListFilters filters={filters} options={filterOptions} />

      {items.length === 0 ? (
        <EmptyState message={allItems.length > 0 ? "No projects match these filters." : viewer.canCreateProject ? "No projects yet. Create the first project." : "No projects yet. Projects appear here as soon as you are a party to a deal."} />
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table dense className="min-w-[1100px]">
            <TableHeader className="bg-muted/70 [&_th]:font-semibold [&_th]:text-foreground">
              <TableRow>
                <TableHead>Spine ID</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="hidden md:table-cell">Delivery</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Files</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className={item.depth === 0 ? "border-t-2 border-border bg-muted/50 font-medium hover:bg-muted/65" : "bg-background text-muted-foreground hover:bg-muted/25"}>
                  <TableCell className={item.depth > 0 ? "whitespace-nowrap pl-12" : "whitespace-nowrap"}>
                    <Link
                      href={`/projects/${item.id}`}
                      className={item.depth > 0 ? "font-normal text-primary/75 hover:text-primary hover:underline" : "font-semibold text-primary hover:underline"}
                    >
                      {item.depth > 0 ? `↳ ${item.reference}` : item.spineCode}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[18rem] truncate">{item.name ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {item.buyer?.name ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {item.seller?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {item.depth === 0 && item.stage ? (
                    <ProjectStageBadge stage={item.stage} label={item.stageLabel} />
                    ) : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {item.deliveryDeadline ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-right">{item.fileCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium">{formatMoney(item.valueCents, item.currency)}</TableCell>
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
