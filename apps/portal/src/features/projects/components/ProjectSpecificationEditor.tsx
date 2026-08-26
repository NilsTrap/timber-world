"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  const [deleteTarget, setDeleteTarget] = useState<ProjectLine | null>(null);

  function openCatalog() {
    startTransition(async () => {
      const result = await getProjectCatalogOptions();
      if (!result.success) { toast.error(result.error); return; }
      if (result.data.length === 0) { toast.info("No active catalogue variants are available"); return; }
      const first = result.data[0]!;
      setCatalog(result.data);
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
        <Button variant="outline" size="sm" onClick={openCatalog} disabled={pending}>Add from catalogue</Button>
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
            <TableCell>{line.notes ?? "—"}</TableCell><TableCell className="text-right">{line.volumeM3 ?? line.pieces ?? "—"}</TableCell><TableCell>{line.unit}</TableCell>
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
          {catalog.length ? <Field label="Catalogue variant"><select className="h-9 rounded-md border bg-background px-3" value={draft.catalogVariantId} onChange={(event) => {
            const option = catalog.find((item) => item.id === event.target.value);
            if (option) setDraft({ ...draft, catalogVariantId: option.id, productName: option.label, unit: option.unit });
          }}>{catalog.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
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
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>; }
