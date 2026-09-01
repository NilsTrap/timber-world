"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { GripVertical, ImageIcon, Loader2, MoreHorizontal, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
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
import { restoreProject, restoreProjectLeg, softDeleteProject, softDeleteProjectLeg } from "../actions/projectDeletionActions";

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
  deletedOnly,
  recoveryPage,
  recoveryHasMore,
}: {
  items: ProjectListItem[];
  allItems: ProjectListItem[];
  viewer: ProjectsViewer;
  filters: ProjectListFilterState;
  filterOptions: Parameters<typeof ProjectsListFilters>[0]["options"];
  deletedOnly: boolean;
  recoveryPage: number;
  recoveryHasMore: boolean;
}) {
  const router = useRouter();
  const [displayItems, setDisplayItems] = useState(items);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [mutationTarget, setMutationTarget] = useState<ProjectListItem | null>(null);
  const [mutating, setMutating] = useState(false);
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
    if (!spineId) { setReordering(false); return; }
    try {
      const result = await reorderProjectLegs({ spineId, orderIds: next.filter((item) => item.groupKey === target.groupKey && item.rowKind === "leg").map((item) => item.id) });
      if (!result.success) { setDisplayItems(items); toast.error(result.error); }
    } catch { setDisplayItems(items); toast.error("Could not reorder project legs."); }
    finally { setReordering(false); }
  }
  async function confirmMutation() {
    if (!mutationTarget) return;
    if (!deletedOnly && mutationTarget.isOriginLeg) { setMutationTarget(null); return; }
    setMutating(true);
    try {
      const result = deletedOnly
        ? mutationTarget.rowKind === "spine" ? await restoreProject(mutationTarget.spineId) : await restoreProjectLeg(mutationTarget.id)
        : mutationTarget.rowKind === "spine" ? await softDeleteProject(mutationTarget.spineId) : await softDeleteProjectLeg(mutationTarget.id);
      if (!result.success) { toast.error(result.error); return; }
      setDisplayItems((current) => mutationTarget.rowKind === "spine" ? current.filter((row)=>row.groupKey!==mutationTarget.groupKey) : current.filter((row)=>row.id!==mutationTarget.id));
      setMutationTarget(null);
      toast.success(deletedOnly ? mutationTarget.rowKind === "spine" ? "Project restored." : "Leg restored." : mutationTarget.rowKind === "spine" ? "Project moved to deleted projects." : "Leg moved to deleted projects.");
      router.refresh();
    } catch { toast.error("The project could not be updated. No changes were made."); }
    finally { setMutating(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{deletedOnly ? "Deleted projects" : "Projects"}</h1>
          <p className="text-muted-foreground">
            {deletedOnly ? "Recover soft-deleted projects and their original legs." : "Every deal you can see, as a project workspace."}
          </p>
        </div>
        <div className="flex gap-2">
          {viewer.isPlatformAdmin ? <Button asChild variant="outline" size="sm"><Link href={deletedOnly ? "/projects" : "/projects?deleted=1"}>{deletedOnly ? "Active projects" : "Deleted projects"}</Link></Button> : null}
          {!deletedOnly && viewer.canCreateProject ? <Button asChild size="sm"><Link href="/projects/new"><Plus className="mr-1.5 h-4 w-4" /> New project</Link></Button> : null}
        </div>
      </div>

      {!deletedOnly ? <ProjectsListFilters filters={filters} options={filterOptions} /> : null}

      {displayItems.length === 0 ? (
        <EmptyState message={deletedOnly ? "No deleted projects." : allItems.length > 0 ? "No projects match these filters." : viewer.canCreateProject ? "No projects yet. Create the first project." : "No projects yet. Projects appear here as soon as you are a party to a deal."} />
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
                <TableRow key={`${item.rowKind}:${item.id}`} draggable={!deletedOnly && !reordering && viewer.isPlatformAdmin && item.rowKind === "leg" && item.depth > 0} onDragStart={()=>setDraggedId(item.id)} onDragEnd={()=>setDraggedId(null)} onDragOver={(event)=>{if(!deletedOnly&&item.rowKind==="leg")event.preventDefault();}} onDrop={()=>{if(!deletedOnly)void dropLeg(item)}} className={item.rowKind === "spine" ? "border-t-2 border-border bg-muted/50 font-medium hover:bg-muted/65" : `bg-background text-muted-foreground hover:bg-muted/25 ${draggedId===item.id?"opacity-50":""}`}>
                  {firstInGroup ? <TableCell rowSpan={groupRows.length} className="w-24 border-r align-middle"><div className="relative mx-auto h-24 w-20 overflow-hidden rounded-md border bg-muted">{thumbnail ? <Image src={thumbnail} alt="Project thumbnail" fill unoptimized className="object-cover" /> : <ImageIcon className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground/50" />}</div></TableCell> : null}
                  <TableCell className={item.depth > 0 ? "whitespace-nowrap pl-12" : "whitespace-nowrap"}>
                    {viewer.isPlatformAdmin && item.rowKind === "leg" && item.depth > 0 ? <GripVertical className="mr-1 inline h-4 w-4 cursor-grab text-muted-foreground/50" aria-label={`Drag ${item.reference}`} /> : null}
                    {deletedOnly ? <span className={item.depth > 0 ? "font-normal" : "font-semibold"}>{item.rowKind === "spine" ? item.spineCode : item.depth > 0 ? `↳ ${item.reference}` : item.reference}</span> : <Link
                      href={`/projects/${item.id}`}
                      className={item.depth > 0 ? "font-normal text-primary/75 hover:text-primary hover:underline" : "font-semibold text-primary hover:underline"}
                    >
                      {item.rowKind === "spine" ? item.spineCode : item.depth > 0 ? `↳ ${item.reference}` : item.reference}
                    </Link>}
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
                    {viewer.isPlatformAdmin && (item.rowKind === "spine" || (item.rowKind === "leg" && item.depth > 0)) ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions for ${item.spineCode}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-48 p-1">
                          {!deletedOnly && item.rowKind === "spine" ? <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                            <Link href={`/projects/${item.id}?createLeg=1`}>
                              <Plus className="mr-2 h-4 w-4" /> Add leg
                            </Link>
                          </Button> : null}
                          {item.rowKind === "spine" ? <Button type="button" variant="ghost" size="sm" className={deletedOnly ? "w-full justify-start" : "w-full justify-start text-destructive hover:text-destructive"} onClick={()=>setMutationTarget(item)}>
                            {deletedOnly ? <RotateCcw className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}{deletedOnly ? "Restore project" : "Delete project"}
                          </Button> : <Button type="button" variant="ghost" size="sm" className={deletedOnly || item.isOriginLeg ? "w-full justify-start" : "w-full justify-start text-destructive hover:text-destructive"} onClick={()=>setMutationTarget(item)}>{deletedOnly?<RotateCcw className="mr-2 h-4 w-4"/>:item.isOriginLeg?null:<Trash2 className="mr-2 h-4 w-4"/>}{deletedOnly?"Restore leg":item.isOriginLeg?"Delete project instead":"Delete leg"}</Button>}
                        </PopoverContent>
                      </Popover>
                    ) : null}
                  </TableCell>
                </TableRow>);})}
            </TableBody>
          </Table>
        </div>
      )}
      {deletedOnly && (recoveryPage > 0 || recoveryHasMore) ? <div className="flex items-center justify-end gap-2">{recoveryPage>0?<Button asChild variant="outline" size="sm"><Link href={`/projects?deleted=1&page=${recoveryPage}`}>Previous</Link></Button>:<Button variant="outline" size="sm" disabled>Previous</Button>}<span className="text-sm text-muted-foreground">Page {recoveryPage+1}</span>{recoveryHasMore?<Button asChild variant="outline" size="sm"><Link href={`/projects?deleted=1&page=${recoveryPage+2}`}>Next</Link></Button>:<Button variant="outline" size="sm" disabled>Next</Button>}</div> : null}
      <AlertDialog open={mutationTarget!==null} onOpenChange={(open)=>{if(!open&&!mutating)setMutationTarget(null)}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mutationTarget?.isOriginLeg&&!deletedOnly?"Delete the whole project":deletedOnly ? mutationTarget?.rowKind === "spine" ? "Restore project?" : "Restore leg?" : mutationTarget?.rowKind === "spine" ? "Delete project?" : "Delete leg?"}</AlertDialogTitle>
            <AlertDialogDescription>{mutationTarget?.isOriginLeg&&!deletedOnly?"The origin leg owns the shared specification and cannot be deleted separately. Use Delete project on the spine row instead.":deletedOnly ? mutationTarget?.rowKind === "spine" ? "This restores the project and every leg removed with it, preserving all original relationships and files." : "This restores the leg with its original relationships and files." : mutationTarget?.rowKind === "spine" ? "This removes the project and all its legs from active workflows. All records and files are preserved and a Super Admin can restore them." : "This removes only this leg from active workflows. Its records and files are preserved."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>{mutationTarget?.isOriginLeg&&!deletedOnly?null:<AlertDialogCancel disabled={mutating}>Cancel</AlertDialogCancel>}<AlertDialogAction disabled={mutating} onClick={(event)=>{event.preventDefault();void confirmMutation()}} className={!deletedOnly&&!mutationTarget?.isOriginLeg?"bg-destructive text-destructive-foreground hover:bg-destructive/90":""}>{mutating?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}{mutationTarget?.isOriginLeg&&!deletedOnly?"Close":deletedOnly?mutationTarget?.rowKind === "spine"?"Restore project":"Restore leg":"Delete"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
