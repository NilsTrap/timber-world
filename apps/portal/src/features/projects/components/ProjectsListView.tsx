"use client";

import Link from "next/link";
import Image from "next/image";
import { GripVertical, ImageIcon, MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  EmptyState,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import type { ProjectListItem, ProjectsViewer } from "../types";
import type { ProjectListFilters as ProjectListFilterState } from "../types";
import { ProjectStageBadge } from "./ProjectStageBadge";
import { ProjectsListFilters } from "./ProjectsListFilters";
import { reorderProjectLegs } from "../actions/reorderProjectLegs";

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
  const [displayItems, setDisplayItems] = useState(items);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  useEffect(() => setDisplayItems(items), [items]);
  async function dropLeg(target: ProjectListItem) {
    if (!draggedId || target.rowKind !== "leg") return;
    const source = displayItems.find((item) => item.rowKind === "leg" && item.id === draggedId);
    if (!source || source.groupKey !== target.groupKey || source.id === target.id) return setDraggedId(null);
    const groupLegs = displayItems.filter((item) => item.groupKey === target.groupKey && item.rowKind === "leg");
    const moved = groupLegs.filter((item) => item.id !== source.id);
    moved.splice(moved.findIndex((item) => item.id === target.id), 0, source);
    const next = displayItems.map((item) => item.groupKey === target.groupKey && item.rowKind === "leg" ? moved.shift()! : item);
    setDisplayItems(next); setDraggedId(null); setReordering(true);
    const spineId = target.groupKey.startsWith("spine:") ? target.groupKey.slice(6) : null;
    if (!spineId) return;
    const result = await reorderProjectLegs({ spineId, orderIds: next.filter((item) => item.groupKey === target.groupKey && item.rowKind === "leg").map((item) => item.id) });
    setReordering(false);
    if (!result.success) { setDisplayItems(items); toast.error(result.error); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Every deal you can see, as a project workspace.
          </p>
        </div>
        {viewer.canCreateProject ? (
          <Button asChild size="sm"><Link href="/projects/new"><Plus className="mr-1.5 h-4 w-4" /> New project</Link></Button>
        ) : null}
      </div>

      <ProjectsListFilters filters={filters} options={filterOptions} />

      {items.length === 0 ? (
        <EmptyState message={allItems.length > 0 ? "No projects match these filters." : viewer.canCreateProject ? "No projects yet. Create the first project." : "No projects yet. Projects appear here as soon as you are a party to a deal."} />
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table dense className="min-w-[1100px]">
            <TableHeader className="bg-muted/70 [&_th]:font-semibold [&_th]:text-foreground">
              <TableRow>
                <TableHead className="w-24">Image</TableHead>
                <TableHead>Spine ID</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="hidden md:table-cell">Delivery</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Files</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="w-12 text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.map((item, index) => {
                const firstInGroup = index === 0 || displayItems[index - 1]?.groupKey !== item.groupKey;
                const groupRows = displayItems.filter((candidate) => candidate.groupKey === item.groupKey);
                const thumbnail = groupRows.find((candidate) => candidate.rowKind === "spine")?.thumbnailUrl ?? groupRows.find((candidate) => candidate.thumbnailUrl)?.thumbnailUrl;
                return (
                <TableRow key={`${item.rowKind}:${item.id}`} draggable={!reordering && viewer.isPlatformAdmin && item.rowKind === "leg" && item.depth > 0} onDragStart={()=>setDraggedId(item.id)} onDragEnd={()=>setDraggedId(null)} onDragOver={(event)=>{if(item.rowKind==="leg")event.preventDefault();}} onDrop={()=>void dropLeg(item)} className={item.rowKind === "spine" ? "border-t-2 border-border bg-muted/50 font-medium hover:bg-muted/65" : `bg-background text-muted-foreground hover:bg-muted/25 ${draggedId===item.id?"opacity-50":""}`}>
                  {firstInGroup ? <TableCell rowSpan={groupRows.length} className="w-24 border-r align-middle"><div className="relative mx-auto h-24 w-20 overflow-hidden rounded-md border bg-muted">{thumbnail ? <Image src={thumbnail} alt="Project thumbnail" fill unoptimized className="object-cover" /> : <ImageIcon className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground/50" />}</div></TableCell> : null}
                  <TableCell className={item.depth > 0 ? "whitespace-nowrap pl-12" : "whitespace-nowrap"}>
                    {viewer.isPlatformAdmin && item.rowKind === "leg" && item.depth > 0 ? <GripVertical className="mr-1 inline h-4 w-4 cursor-grab text-muted-foreground/50" aria-label={`Drag ${item.reference}`} /> : null}
                    <Link
                      href={`/projects/${item.id}`}
                      className={item.depth > 0 ? "font-normal text-primary/75 hover:text-primary hover:underline" : "font-semibold text-primary hover:underline"}
                    >
                      {item.rowKind === "spine" ? item.spineCode : item.depth > 0 ? `↳ ${item.reference}` : item.reference}
                    </Link>
                  </TableCell>
                  <TableCell colSpan={item.rowKind === "spine" ? 3 : 1} className={item.rowKind === "spine" ? "font-medium" : "max-w-[18rem] truncate"}>{item.rowKind === "spine" || item.depth === 0 ? item.name ?? "—" : ""}</TableCell>
                  {item.rowKind !== "spine" ? <>
                    <TableCell className="whitespace-nowrap">{item.buyer?.name ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{item.seller?.name ?? "—"}</TableCell>
                  </> : null}
                  <TableCell>
                    {item.depth === 0 && item.stage ? (
                    <ProjectStageBadge stage={item.stage} label={item.stageLabel} color={item.stageColor} />
                    ) : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {item.deliveryDeadline ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-right">{item.fileCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium">{formatMoney(item.valueCents, item.currency)}</TableCell>
                  <TableCell className="text-right">
                    {viewer.isPlatformAdmin && item.rowKind === "spine" ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions for ${item.spineCode}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-48 p-1">
                          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                            <Link href={`/projects/${item.id}?createLeg=1`}>
                              <Plus className="mr-2 h-4 w-4" /> Add leg
                            </Link>
                          </Button>
                        </PopoverContent>
                      </Popover>
                    ) : null}
                  </TableCell>
                </TableRow>);})}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
