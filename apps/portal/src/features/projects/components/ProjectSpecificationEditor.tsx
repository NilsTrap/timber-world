"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  EmptyState, Input, Label, SectionHeader, Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@timber/ui";
import type { ProjectLine, ProjectLineComponent } from "../types";
import {
  createProjectLineComponent, createProjectSpecificationLine,
  deleteProjectLineComponent, deleteProjectSpecificationLine,
  updateProjectLineComponent, updateProjectSpecificationLine,
} from "../actions/projectSpecificationActions";

const LINE_UNITS = ["piece", "m3", "m2", "linear_m", "package", "crate", "loose_m3"] as const;
const COMPONENT_TYPES = ["material", "process", "service"] as const;

type LineDraft = { id?: string; productName: string; quantity: string; unit: string; unitPrice: string; notes: string };
type CostDraft = { id?: string; lineId: string; type: "material" | "process" | "service"; name: string; quantity: string; unit: string; unitCost: string };
type DeleteTarget = { kind: "line"; lineId: string; name: string } | { kind: "cost"; lineId: string; componentId: string; name: string };

const blankLine = (): LineDraft => ({ productName: "", quantity: "1", unit: "piece", unitPrice: "0", notes: "" });
const blankCost = (lineId: string): CostDraft => ({ lineId, type: "material", name: "", quantity: "1", unit: "pcs", unitCost: "0" });

export function ProjectSpecificationEditor({ projectId, lines, currency, canEdit }: {
  projectId: string;
  lines: ProjectLine[];
  currency: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lineDraft, setLineDraft] = useState<LineDraft | null>(null);
  const [costDraft, setCostDraft] = useState<CostDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  function saveLine() {
    if (!lineDraft) return;
    startTransition(async () => {
      const payload = { projectId, lineId: lineDraft.id, productName: lineDraft.productName, quantity: lineDraft.quantity, unit: lineDraft.unit, unitPrice: lineDraft.unitPrice, notes: lineDraft.notes };
      const result = lineDraft.id ? await updateProjectSpecificationLine(payload) : await createProjectSpecificationLine(payload);
      if (!result.success) { toast.error(result.error); return; }
      toast.success(lineDraft.id ? "Specification line updated" : "Specification line added");
      setLineDraft(null);
      router.refresh();
    });
  }

  function saveCost() {
    if (!costDraft) return;
    startTransition(async () => {
      const payload = { projectId, lineId: costDraft.lineId, componentId: costDraft.id, type: costDraft.type, name: costDraft.name, quantity: costDraft.quantity, unit: costDraft.unit, unitCost: costDraft.unitCost };
      const result = costDraft.id ? await updateProjectLineComponent(payload) : await createProjectLineComponent(payload);
      if (!result.success) { toast.error(result.error); return; }
      toast.success(costDraft.id ? "Cost updated" : "Cost added");
      setCostDraft(null);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = deleteTarget.kind === "line"
        ? await deleteProjectSpecificationLine({ projectId, lineId: deleteTarget.lineId })
        : await deleteProjectLineComponent({ projectId, lineId: deleteTarget.lineId, componentId: deleteTarget.componentId });
      if (!result.success) { toast.error(result.error); return; }
      toast.success(deleteTarget.kind === "line" ? "Specification line deleted" : "Cost deleted");
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader title="Specification" subtitle={`${lines.length} line(s)`} />
        {canEdit ? <Button size="sm" onClick={() => setLineDraft(blankLine())}><Plus className="mr-1 h-4 w-4" />Add line</Button> : null}
      </div>
      {lines.length === 0 ? <EmptyState message={canEdit ? "No lines yet. Add the first deliverable." : "No specification lines on this project yet."} /> : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table dense>
            <TableHeader><TableRow>
              <TableHead>#</TableHead><TableHead>Deliverable</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead>
              <TableHead className="text-right">Unit price</TableHead><TableHead className="text-right">Total</TableHead>
              {canEdit ? <TableHead className="w-24 text-right">Actions</TableHead> : null}
            </TableRow></TableHeader>
            <TableBody>{lines.map((line) => <SpecificationRows key={line.id ?? line.lineNo} line={line} currency={currency} canEdit={canEdit}
              onEditLine={() => setLineDraft(lineToDraft(line))}
              onDeleteLine={() => line.id && setDeleteTarget({ kind: "line", lineId: line.id, name: line.productName ?? "this line" })}
              onAddCost={() => line.id && setCostDraft(blankCost(line.id))}
              onEditCost={(component) => line.id && setCostDraft(costToDraft(line.id, component))}
              onDeleteCost={(component) => line.id && setDeleteTarget({ kind: "cost", lineId: line.id, componentId: component.id, name: component.name })}
            />)}</TableBody>
          </Table>
        </div>
      )}

      <Dialog open={lineDraft !== null} onOpenChange={(open) => !open && !pending && setLineDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{lineDraft?.id ? "Edit specification line" : "Add specification line"}</DialogTitle></DialogHeader>
          {lineDraft ? <div className="grid gap-4 py-2">
            <Field label="Deliverable"><Input value={lineDraft.productName} onChange={(e) => setLineDraft({ ...lineDraft, productName: e.target.value })} placeholder="e.g. Welded frame" autoFocus /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Quantity"><Input type="number" min="0.0001" step="any" value={lineDraft.quantity} onChange={(e) => setLineDraft({ ...lineDraft, quantity: e.target.value })} /></Field>
              <Field label="Unit"><NativeSelect value={lineDraft.unit} onChange={(unit) => setLineDraft({ ...lineDraft, unit })} options={LINE_UNITS} /></Field>
              <Field label={`Unit price${currency ? ` (${currency})` : ""}`}><Input type="number" min="0" step="0.01" value={lineDraft.unitPrice} onChange={(e) => setLineDraft({ ...lineDraft, unitPrice: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><Input value={lineDraft.notes} onChange={(e) => setLineDraft({ ...lineDraft, notes: e.target.value })} placeholder="Optional" /></Field>
          </div> : null}
          <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setLineDraft(null)}>Cancel</Button><Button disabled={pending || !lineDraft?.productName.trim()} onClick={saveLine}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={costDraft !== null} onOpenChange={(open) => !open && !pending && setCostDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{costDraft?.id ? "Edit cost component" : "Add cost component"}</DialogTitle></DialogHeader>
          {costDraft ? <div className="grid gap-4 py-2">
            <Field label="Type"><NativeSelect value={costDraft.type} onChange={(type) => setCostDraft({ ...costDraft, type: type as CostDraft["type"] })} options={COMPONENT_TYPES} /></Field>
            <Field label="Name"><Input value={costDraft.name} onChange={(e) => setCostDraft({ ...costDraft, name: e.target.value })} placeholder="e.g. Welding" autoFocus /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Quantity"><Input type="number" min="0.0001" step="any" value={costDraft.quantity} onChange={(e) => setCostDraft({ ...costDraft, quantity: e.target.value })} /></Field>
              <Field label="Unit"><Input value={costDraft.unit} onChange={(e) => setCostDraft({ ...costDraft, unit: e.target.value })} /></Field>
              <Field label={`Unit cost${currency ? ` (${currency})` : ""}`}><Input type="number" min="0" step="0.01" value={costDraft.unitCost} onChange={(e) => setCostDraft({ ...costDraft, unitCost: e.target.value })} /></Field>
            </div>
          </div> : null}
          <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setCostDraft(null)}>Cancel</Button><Button disabled={pending || !costDraft?.name.trim()} onClick={saveCost}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && !pending && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {deleteTarget?.kind === "line" ? "specification line" : "cost component"}?</AlertDialogTitle>
          <AlertDialogDescription>{deleteTarget?.kind === "line" ? `“${deleteTarget.name}” and its cost build-up will be removed.` : `“${deleteTarget?.name}” will be removed.`}</AlertDialogDescription>
        </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={confirmDelete}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SpecificationRows({ line, currency, canEdit, onEditLine, onDeleteLine, onAddCost, onEditCost, onDeleteCost }: {
  line: ProjectLine; currency: string; canEdit: boolean; onEditLine: () => void; onDeleteLine: () => void; onAddCost: () => void;
  onEditCost: (cost: ProjectLineComponent) => void; onDeleteCost: (cost: ProjectLineComponent) => void;
}) {
  const componentCost = line.components?.reduce((sum, component) => sum + component.totalCostCents, 0) ?? 0;
  const margin = line.lineTotalCents == null ? null : line.lineTotalCents - componentCost;
  return <>
    <TableRow><TableCell>{line.lineNo}</TableCell><TableCell className="font-medium">{line.productName ?? "—"}</TableCell>
      <TableCell className="text-right">{line.volumeM3 ?? line.pieces ?? "—"}</TableCell><TableCell>{line.unit}</TableCell>
      <TableCell className="text-right">{formatCents(line.unitPriceCents, currency)}</TableCell><TableCell className="text-right">{formatCents(line.lineTotalCents, currency)}</TableCell>
      {canEdit ? <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${line.productName ?? "line"}`} onClick={onEditLine}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${line.productName ?? "line"}`} onClick={onDeleteLine}><Trash2 className="h-4 w-4" /></Button></div></TableCell> : null}
    </TableRow>
    {line.notes || canEdit || (line.components?.length ?? 0) > 0 ? <TableRow className="bg-muted/20 hover:bg-muted/20"><TableCell /><TableCell colSpan={canEdit ? 6 : 5} className="py-3">
      {line.notes ? <p className="mb-3 text-xs text-muted-foreground">{line.notes}</p> : null}
      <div className="max-w-4xl space-y-2"><div className="flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cost build-up</p>{canEdit ? <Button variant="outline" size="sm" onClick={onAddCost}><Plus className="mr-1 h-3.5 w-3.5" />Add cost</Button> : null}</div>
        {(line.components?.length ?? 0) > 0 ? <div className="overflow-hidden rounded-md border bg-background">{line.components?.map((cost) => <div key={cost.id} className="grid grid-cols-[minmax(8rem,1fr)_5rem_6rem_7rem_auto] items-center gap-3 border-b px-3 py-2 text-xs last:border-b-0"><div><span className="font-medium">{cost.name}</span><span className="ml-2 capitalize text-muted-foreground">· {cost.type}</span></div><span className="text-right tabular-nums">{formatNumber(cost.quantity)} {cost.unit}</span><span className="text-right tabular-nums">× {formatNumber(cost.unitCost)}</span><span className="text-right font-medium tabular-nums">{formatCents(cost.totalCostCents, currency)}</span>{canEdit ? <div className="flex"><Button variant="ghost" size="icon" aria-label={`Edit ${cost.name}`} onClick={() => onEditCost(cost)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${cost.name}`} onClick={() => onDeleteCost(cost)}><Trash2 className="h-3.5 w-3.5" /></Button></div> : <span />}</div>)}</div> : <p className="text-xs text-muted-foreground">No internal costs added.</p>}
        {(line.components?.length ?? 0) > 0 ? <div className="flex flex-wrap justify-end gap-x-6 text-xs"><span>Internal cost <strong>{formatCents(componentCost, currency)}</strong></span>{margin != null ? <span>Margin <strong>{formatCents(margin, currency)}</strong></span> : null}</div> : null}
      </div>
    </TableCell></TableRow> : null}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function NativeSelect({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (value: string) => void }) { return <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select>; }
function lineToDraft(line: ProjectLine): LineDraft { return { id: line.id ?? undefined, productName: line.productName ?? "", quantity: String(line.volumeM3 ?? line.pieces ?? 1), unit: line.unit, unitPrice: String((line.unitPriceCents ?? 0) / 100), notes: line.notes ?? "" }; }
function costToDraft(lineId: string, cost: ProjectLineComponent): CostDraft { return { id: cost.id, lineId, type: cost.type, name: cost.name, quantity: String(cost.quantity), unit: cost.unit, unitCost: String(cost.unitCost) }; }
function formatNumber(value: number): string { return new Intl.NumberFormat("en", { maximumFractionDigits: 4 }).format(value); }
function formatCents(cents: number | null | undefined, currency: string): string { if (cents == null) return "—"; const amount = (cents / 100).toFixed(2); return currency ? `${amount} ${currency}` : amount; }
