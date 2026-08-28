"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  EmptyState, Input, Label, SectionHeader, Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@timber/ui";
import type { ProjectLine } from "../types";
import {
  createProjectSpecificationLine, deleteProjectSpecificationLine,
  getProjectCatalogOptions, updateProjectSpecificationLine,
  type ProjectCatalogOption,
} from "../actions/projectSpecificationActions";

const LINE_UNITS = ["piece", "m3", "m2", "linear_m", "package", "crate", "loose_m3"] as const;
type Draft = { id?: string; productName: string; quantity: string; unit: string; notes: string; catalogVariantId?: string };
const blank = (): Draft => ({ productName: "", quantity: "1", unit: "piece", notes: "" });

export function ProjectSpecificationEditor({ projectId, lines, canEdit }: {
  projectId: string; lines: ProjectLine[]; currency?: string; canEdit: boolean;
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SectionHeader title="Technical specification" subtitle={`${lines.length} line(s) · prices are added only after award`} />
      {canEdit ? <div className="flex gap-2">
        <Button size="sm" onClick={openCatalog} disabled={pending}>Add from catalogue</Button>
        <Button size="sm" onClick={() => { setCatalog([]); setDraft(blank()); }}><Plus className="mr-1 h-4 w-4" />Custom line</Button>
      </div> : null}
    </div>

    {lines.length === 0 ? <EmptyState message="No specification lines yet." /> : (
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table dense><TableHeader><TableRow>
          <TableHead>#</TableHead><TableHead>Deliverable</TableHead><TableHead>Technical notes</TableHead>
          <TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead>{canEdit ? <TableHead /> : null}
        </TableRow></TableHeader><TableBody>{lines.map((line) => (
          <TableRow key={line.id ?? line.lineNo}>
            <TableCell>{line.lineNo}</TableCell><TableCell className="font-medium">{line.productName ?? "—"}</TableCell>
            <TableCell><div>{line.notes ?? "—"}</div>{line.processRequirements.length > 0 ? <div className="mt-1 text-xs text-muted-foreground"><span className="font-medium">Processes: </span>{line.processRequirements.map((requirement) => `${requirement.name}: ${requirement.value}${requirement.unit ? ` ${requirement.unit}` : ""}`).join(" · ")}</div> : null}</TableCell><TableCell className="text-right">{line.volumeM3 ?? line.pieces ?? "—"}</TableCell><TableCell>{line.unit}</TableCell>
            {canEdit ? <TableCell><div className="flex justify-end">
              <Button variant="ghost" size="icon" aria-label={`Edit ${line.productName ?? "line"}`} onClick={() => { setCatalog([]); setDraft(lineToDraft(line)); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${line.productName ?? "line"}`} onClick={() => setDeleteTarget(line)}><Trash2 className="h-4 w-4" /></Button>
            </div></TableCell> : null}
          </TableRow>
        ))}</TableBody></Table>
      </div>
    )}

    <Dialog open={draft !== null} onOpenChange={(open) => !open && !pending && setDraft(null)}>
      <DialogContent><DialogHeader><DialogTitle>{draft?.catalogVariantId ? "Add catalogue snapshot" : draft?.id ? "Edit custom line" : "Add custom line"}</DialogTitle>
        <DialogDescription>{draft?.catalogVariantId ? "Copy the selected catalogue values into this project specification." : "Define the deliverable and its technical requirements without pricing."}</DialogDescription>
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
          : <Field label="Deliverable"><Input value={draft.productName} onChange={(event) => setDraft({ ...draft, productName: event.target.value })} autoFocus /></Field>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity"><Input type="number" min="0.0001" step="any" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /></Field>
            <Field label="Unit"><select disabled={Boolean(draft.catalogVariantId)} className="h-9 rounded-md border bg-background px-3" value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })}>{LINE_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></Field>
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
  return { id: line.id ?? undefined, productName: line.productName ?? "", quantity: String(line.volumeM3 ?? line.pieces ?? 1), unit: line.unit, notes: line.notes ?? "" };
}
function filterCatalog(options: ProjectCatalogOption[], query: string): ProjectCatalogOption[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return options.slice(0, 100);
  return options.filter((option) => option.label.toLocaleLowerCase().includes(normalized)).slice(0, 100);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>; }
