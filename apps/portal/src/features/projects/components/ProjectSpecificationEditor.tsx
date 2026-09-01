"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Library, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  EmptyState, Input, Label,
} from "@timber/ui";
import type { ProjectLine } from "../types";
import {
  createProjectSpecificationLine, deleteProjectSpecificationLine,
  getProjectCatalogOptions, updateProjectSpecificationLine,
  type ProjectCatalogOption,
} from "../actions/projectSpecificationActions";
import { ProjectSectionBody, ProjectSectionCard, ProjectSectionHeader } from "./ProjectSectionCard";
import { ProjectSpecificationTables } from "./ProjectSpecificationTables";

const LINE_UNITS = ["kg", "piece", "m3", "m2", "linear_m", "package", "crate", "loose_m3"] as const;
type Draft = { id?: string; productName: string; quantity: string; unit: string; notes: string; catalogVariantId?: string; isCatalogSnapshot?: boolean };
const blank = (): Draft => ({ productName: "", quantity: "1", unit: "piece", notes: "" });

export function ProjectSpecificationEditor({ projectId, lines, currency = "EUR", canEdit, canEnterQuotation = false }: {
  projectId: string; lines: ProjectLine[]; currency?: string; canEdit: boolean; canEnterQuotation?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [catalog, setCatalog] = useState<ProjectCatalogOption[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProjectLine | null>(null);

  function openCatalog() {
    startTransition(async () => {
      const result = await getProjectCatalogOptions();
      if (!result.success) { toast.error(result.error); return; }
      if (result.data.length === 0) { toast.info("No active catalogue variants are available"); return; }
      const first = result.data[0]!;
      setCatalog(result.data);
      setCatalogSearch("");
      setDraft({ ...blank(), productName: first.label, unit: first.unit, catalogVariantId: first.id });
    });
  }

  function save() {
    if (!draft) return;
    startTransition(async () => {
      const payload = {
        projectId, lineId: draft.id, productName: draft.productName,
        quantity: draft.quantity, unit: draft.unit, notes: draft.notes,
        catalogVariantId: draft.catalogVariantId,
      };
      const result = draft.id
        ? await updateProjectSpecificationLine(payload)
        : await createProjectSpecificationLine(payload);
      if (!result.success) { toast.error(result.error); return; }
      setDraft(null);
      toast.success("Specification saved");
      router.refresh();
    });
  }

  function remove() {
    if (!deleteTarget?.id) return;
    startTransition(async () => {
      const result = await deleteProjectSpecificationLine({ projectId, lineId: deleteTarget.id });
      if (!result.success) { toast.error(result.error); return; }
      setDeleteTarget(null);
      toast.success("Specification line deleted");
      router.refresh();
    });
  }

  return <div className="space-y-3">
    <ProjectSectionCard>
      <ProjectSectionHeader title="Technical specification" subtitle={`${lines.length} line(s) · prices are added only after award`} reserveDisclosureSpace actions={canEdit ? <>
        <Button size="sm" onClick={openCatalog} disabled={pending}><Library className="h-4 w-4" /> Add from catalogue</Button>
        <Button size="sm" onClick={() => { setCatalog([]); setDraft(blank()); }}><Plus className="h-4 w-4" /> Custom line</Button>
      </> : undefined} />
      <ProjectSectionBody className="p-0">

    {lines.length === 0 ? <EmptyState message="No specification lines yet." /> : <ProjectSpecificationTables
      projectId={projectId}
      lines={lines}
      canEdit={canEdit}
      canEnterQuotation={canEnterQuotation}
      currency={currency}
      onEdit={(line) => { setCatalog([]); setDraft(lineToDraft(line)); }}
      onDelete={setDeleteTarget}
    />}
      </ProjectSectionBody>
    </ProjectSectionCard>

    <Dialog open={draft !== null} onOpenChange={(open) => !open && !pending && setDraft(null)}>
      <DialogContent><DialogHeader><DialogTitle>{draft?.catalogVariantId ? "Add catalogue snapshot" : draft?.id ? "Edit specification line" : "Add custom line"}</DialogTitle>
        <DialogDescription>{draft?.isCatalogSnapshot ? "Update quantity and technical notes. Catalogue fields and unit stay unchanged." : draft?.catalogVariantId ? "Copy the selected catalogue values into this project specification." : "Define the deliverable and its technical requirements without pricing."}</DialogDescription>
      </DialogHeader>
        {draft ? <div className="grid gap-4 py-2">
          {catalog.length ? <Field label="Catalogue variant"><div className="overflow-hidden rounded-md border bg-background">
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input className="border-0 px-0 shadow-none focus-visible:ring-0" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Search products, SKU or dimensions…" autoFocus />
            </div>
            <div className="max-h-64 overflow-y-auto p-1" role="listbox" aria-label="Catalogue variants">
              {filterCatalog(catalog, catalogSearch).map((option) => {
                const selected = option.id === draft.catalogVariantId;
                return <button key={option.id} type="button" role="option" aria-selected={selected} className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => setDraft({ ...draft, catalogVariantId: option.id, productName: option.label, unit: option.unit })}>
                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "opacity-100" : "opacity-0"}`} />
                  <span className="min-w-0 break-words">{option.label}</span>
                </button>;
              })}
              {filterCatalog(catalog, catalogSearch).length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matching catalogue variants.</p> : null}
            </div>
          </div></Field>
          : <Field label="Deliverable"><Input disabled={Boolean(draft.isCatalogSnapshot)} value={draft.productName} onChange={(event) => setDraft({ ...draft, productName: event.target.value })} autoFocus /></Field>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity"><Input type="number" min={isDiscreteUnit(draft.unit) ? "1" : "0.0001"} step={isDiscreteUnit(draft.unit) ? "1" : "any"} value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /></Field>
            <Field label="Unit"><select disabled={Boolean(draft.catalogVariantId || draft.isCatalogSnapshot)} className="h-9 rounded-md border bg-background px-3" value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })}>{LINE_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></Field>
          </div>
          <Field label="Technical notes"><Input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
        </div> : null}
        <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setDraft(null)}>Cancel</Button>
          <Button disabled={pending || !draft?.productName.trim()} onClick={save}>{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && !pending && setDeleteTarget(null)}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete specification line?</AlertDialogTitle>
        <AlertDialogDescription>“{deleteTarget?.productName ?? "This line"}” will be removed from the technical specification.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction disabled={pending} onClick={remove}>Delete</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}

function lineToDraft(line: ProjectLine): Draft {
  return { id: line.id ?? undefined, productName: line.productName ?? "", quantity: String(line.volumeM3 ?? line.pieces ?? 1), unit: line.unit, notes: line.notes ?? "", isCatalogSnapshot: line.isCatalogSnapshot };
}
function filterCatalog(options: ProjectCatalogOption[], query: string): ProjectCatalogOption[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return options.slice(0, 100);
  return options.filter((option) => option.label.toLocaleLowerCase().includes(normalized)).slice(0, 100);
}
function isDiscreteUnit(unit: string): boolean { return unit === "piece" || unit === "package" || unit === "crate"; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>; }
