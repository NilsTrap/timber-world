"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Loader2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, DENSE_TABLE_CLASS, Input } from "@timber/ui";
import { toast } from "sonner";
import type { ProjectLine, ProjectSpecificationField } from "../types";
import { updateProjectSpecificationLine, updateProjectSpecificationStructuredValues } from "../actions/projectSpecificationActions";

type SpecificationTablesProps = {
  projectId: string;
  lines: ProjectLine[];
  canEdit: boolean;
  onEdit: (line: ProjectLine) => void;
  onDelete: (line: ProjectLine) => void;
};

export function ProjectSpecificationTables({ projectId, lines, canEdit, onEdit, onDelete }: SpecificationTablesProps) {
  const groups = useMemo(() => groupLinesBySchema(lines), [lines]);
  return <div className="space-y-3 p-3">
    {groups.map((group, groupIndex) => <section key={group.key} className="overflow-hidden rounded-lg border border-[#ded8d0] bg-white dark:border-border dark:bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ded8d0] bg-white px-3 py-2 dark:border-border dark:bg-card">
        <div><h3 className="font-semibold">{groupTitle(group.lines, groupIndex)}</h3><p className="text-xs text-muted-foreground">{group.lines.length} line(s) sharing the same properties</p></div>
      </div>
      <div className="overflow-x-auto">
        <table className={`w-max min-w-full table-auto border-collapse text-sm ${DENSE_TABLE_CLASS}`}>
          <thead><tr className="border-b border-[#ded8d0] bg-[#f3f0ec] text-left text-xs text-[#485358] dark:border-border dark:bg-muted dark:text-muted-foreground">
            <th className="w-10 px-3 py-2 font-medium">#</th>
            <th className="w-px whitespace-nowrap px-3 py-2 font-medium">Line item</th>
            {group.fields.map((field) => <th key={field.key} className="w-px whitespace-nowrap border-l px-3 py-2 font-medium">{fieldLabel(field)}</th>)}
            <th className="w-px whitespace-nowrap border-l px-3 py-2 font-medium">Quantity</th><th className="w-px whitespace-nowrap border-l px-3 py-2 font-medium">Unit</th>
            <th className="min-w-40 border-l px-3 py-2 font-medium">Technical notes</th>{canEdit ? <th className="whitespace-nowrap px-3 py-2"><span className="sr-only">Actions</span></th> : null}
          </tr></thead>
          <tbody>{group.lines.map((line) => <SpecificationProductRows key={line.id ?? line.lineNo} projectId={projectId} line={line} fields={group.fields} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />)}</tbody>
        </table>
      </div>
    </section>)}
  </div>;
}

function SpecificationProductRows({ projectId, line, fields, canEdit, onEdit, onDelete }: {
  projectId: string; line: ProjectLine; fields: ProjectSpecificationField[]; canEdit: boolean;
  onEdit: (line: ProjectLine) => void; onDelete: (line: ProjectLine) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [processesOpen, setProcessesOpen] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [quantity, setQuantity] = useState(lineQuantity(line));
  const [notes, setNotes] = useState(line.notes ?? "");
  const [basicValues, setBasicValues] = useState<Record<string, string>>(() => valuesForBasics(line));
  const [processValues, setProcessValues] = useState<Record<string, string>>(() => valuesForProcesses(line));
  const [activeProcesses, setActiveProcesses] = useState<Record<string, boolean>>(() => applicabilityForProcesses(line));
  const processes = line.processRequirements ?? [];
  const editableSnapshot = canEdit && line.isCatalogSnapshot && Boolean(line.id);
  const structuredFields = line.basicProperties ?? [];
  const visibleProcesses = showInactive ? processes : processes.filter((process) => activeProcesses[process.fieldKey] !== false);
  const activeCount = processes.filter((process) => activeProcesses[process.fieldKey] !== false).length;
  const columnCount = fields.length + (canEdit ? 6 : 5);

  useEffect(() => {
    setQuantity(lineQuantity(line)); setNotes(line.notes ?? "");
    setBasicValues(valuesForBasics(line)); setProcessValues(valuesForProcesses(line)); setActiveProcesses(applicabilityForProcesses(line)); setShowInactive(false);
  }, [line]);

  function saveStructuredFields() {
    if (!line.id || !editableSnapshot) return;
    startTransition(async () => {
      const structured = await updateProjectSpecificationStructuredValues({
        projectId, lineId: line.id!, version: line.structuredValuesVersion,
        basicValues: structuredFields.map((field) => ({ key: field.key, value: basicValues[field.key] ?? "" })),
        processValues: processes.map((process) => ({ key: process.fieldKey, value: processValues[process.fieldKey] ?? "0", active: activeProcesses[process.fieldKey] !== false })),
      });
      if (!structured.success) { toast.error(structured.error); return; }
      toast.success("Specification fields saved"); router.refresh();
    });
  }

  function saveLine() {
    if (!line.id || !canEdit) return;
    startTransition(async () => {
      const product = await updateProjectSpecificationLine({ projectId, lineId: line.id!, productName: line.productName ?? "Specification line", quantity, unit: line.unit, notes });
      if (!product.success) { toast.error(product.error); return; }
      toast.success("Specification line saved"); router.refresh();
    });
  }

  return <Fragment>
    <tr className="border-b border-[#ebe6e0] bg-white align-middle dark:border-border dark:bg-card">
      <td className="px-3 py-2 text-muted-foreground">{line.lineNo}</td><td className="px-3 py-2 font-semibold">{line.productName ?? "—"}</td>
      {fields.map((field) => { const fieldEditable = editableSnapshot && structuredFields.some((candidate) => candidate.key === field.key); return <td key={field.key} className="w-px border-l p-0">{fieldEditable ? <BasicFieldInput field={field} value={basicValues[field.key] ?? ""} onChange={(value) => setBasicValues((current) => ({ ...current, [field.key]: value }))} /> : <span className="block px-3 py-2">{displayValue(field, basicValues[field.key])}</span>}</td>; })}
      <td className="w-px border-l p-0">{canEdit && line.id ? <CompactInput aria-label={`Quantity for ${line.productName ?? "line"}`} type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} /> : <span className="block px-3 py-2">{quantity}</span>}</td>
      <td className="border-l px-3 py-2">{line.unit}</td>
      <td className="border-l p-0">{canEdit && line.id ? <CompactInput aria-label={`Technical notes for ${line.productName ?? "line"}`} value={notes} onChange={(event) => setNotes(event.target.value)} /> : <span className="block px-3 py-2">{notes || "—"}</span>}</td>
      {canEdit ? <td className="px-2 py-1"><div className="flex justify-end gap-1">{line.id ? <><Button size="sm" disabled={pending} onClick={saveLine}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save line</Button>{editableSnapshot ? <Button type="button" variant="outline" size="sm" disabled={pending} onClick={saveStructuredFields}>Save fields</Button> : null}</> : <Button variant="ghost" size="icon" aria-label={`Edit ${line.productName ?? "line"}`} onClick={() => onEdit(line)}><Pencil className="h-4 w-4" /></Button>}<Button variant="ghost" size="icon" aria-label={`Delete ${line.productName ?? "line"}`} onClick={() => onDelete(line)}><Trash2 className="h-4 w-4" /></Button></div></td> : null}
    </tr>
    {processes.length ? <tr className="border-b last:border-b-0"><td colSpan={columnCount} className="p-0">
      <div className="sticky left-0 m-3 w-[calc(100vw-2rem)] max-w-5xl overflow-hidden rounded-md border border-[#d9e2dd] bg-white sm:w-[calc(100vw-20rem)] dark:border-border dark:bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#e9f0ec] px-3 py-2 dark:bg-primary/15">
          <div className="flex items-center gap-2 font-medium"><span aria-hidden>↳</span> Applicable processes <span className="text-xs font-normal text-muted-foreground">{activeCount} selected</span></div>
          <div className="flex items-center gap-3">
            {processes.some((process) => activeProcesses[process.fieldKey] === false) ? canEdit ? <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="h-4 w-4 accent-primary" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> Show inactive</label> : <Button type="button" variant="ghost" size="sm" onClick={() => setShowInactive((current) => !current)}>{showInactive ? "Hide inactive" : "Show inactive"}</Button> : null}
            <Button type="button" variant="outline" size="sm" aria-expanded={processesOpen} onClick={() => setProcessesOpen((open) => !open)}>{processesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{processesOpen ? "Hide processes" : "Show processes"}</Button>
          </div>
        </div>
        {processesOpen ? <div className="overflow-x-auto"><table className={`w-full table-fixed border-collapse text-sm ${DENSE_TABLE_CLASS}`}><thead><tr className="border-b border-[#ded8d0] bg-[#f8faf9] text-left text-xs text-[#485358] dark:border-border dark:bg-muted/50 dark:text-muted-foreground"><th className="w-12 px-2 py-2 font-medium">Use</th><th className="px-2 py-2 font-medium">Process</th><th className="w-28 px-2 py-2 font-medium">Quantity</th><th className="w-16 px-2 py-2 font-medium">Unit</th></tr></thead><tbody>
          {visibleProcesses.map((process) => { const active = activeProcesses[process.fieldKey] !== false; return <tr key={process.id} className={`border-b border-[#ebe6e0] last:border-b-0 dark:border-border ${active ? "bg-white dark:bg-card" : "bg-[#fafafa] text-[#657078] dark:bg-muted/30 dark:text-muted-foreground"}`}>
            <td className="px-2 py-2">{editableSnapshot ? <input type="checkbox" className="h-4 w-4 accent-primary" aria-label={`Use ${process.name} for ${line.productName ?? "line"}`} checked={active} onChange={(event) => setActiveProcesses((current) => ({ ...current, [process.fieldKey]: event.target.checked }))} /> : active ? <span className="text-primary">✓</span> : <span>—</span>}</td>
            <td className="px-2 py-2 font-medium">{process.name}</td><td className="p-0">{editableSnapshot ? <CompactInput aria-label={`${process.name} quantity for ${line.productName ?? "line"}`} type="number" min="0" step="any" disabled={!active} value={processValues[process.fieldKey] ?? "0"} onChange={(event) => setProcessValues((current) => ({ ...current, [process.fieldKey]: event.target.value }))} /> : <span className="block px-2 py-2">{processValues[process.fieldKey] ?? "0"}</span>}</td><td className="px-2 py-2">{process.unit ?? "—"}</td>
          </tr>; })}
          {visibleProcesses.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">No applicable processes. Show inactive processes to add one.</td></tr> : null}
        </tbody></table></div> : null}
      </div>
    </td></tr> : null}
  </Fragment>;
}

function CompactInput(props: React.ComponentProps<typeof Input>) { return <Input {...props} className={`h-10 min-w-0 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:bg-[#f8fcfa] focus-visible:ring-2 focus-visible:ring-inset dark:focus-visible:bg-muted/30 ${props.className ?? ""}`} />; }
function BasicFieldInput({ field, value, onChange }: { field: ProjectSpecificationField; value: string; onChange: (value: string) => void }) {
  if (field.type === "file") return <span className="block px-3 py-2 text-muted-foreground" title="File fields are managed through catalogue assets">{value || "No file"}</span>;
  if (field.type === "select") return <select aria-label={field.label} className="h-10 w-full min-w-0 border-0 bg-transparent px-3 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary" value={value} onChange={(event) => onChange(event.target.value)}><option value="">—</option>{field.allowedOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  if (field.type === "boolean") return <select aria-label={field.label} className="h-10 w-full min-w-0 border-0 bg-transparent px-3 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary" value={value} onChange={(event) => onChange(event.target.value)}><option value="">—</option><option value="true">Yes</option><option value="false">No</option></select>;
  return <CompactInput aria-label={field.label} type={field.type === "number" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} />;
}
function groupLinesBySchema(lines: ProjectLine[]) {
  const groups = new Map<string, { key: string; fields: ProjectSpecificationField[]; lines: ProjectLine[] }>();
  for (const line of lines) {
    const fields = basicFieldsForLine(line);
    const key = JSON.stringify(fields.map((field) => [field.key, field.type, field.unit]));
    const group = groups.get(key); if (group) group.lines.push(line); else groups.set(key, { key, fields, lines: [line] });
  }
  return [...groups.values()];
}
function basicFieldsForLine(line: ProjectLine): ProjectSpecificationField[] {
  const snapshotFields = [...(line.basicProperties ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  if (snapshotFields.length) return snapshotFields;
  return legacyBasicValues(line).map(([key, label, value], index) => ({
    key: `legacy.${key}`, label, type: "text", unit: null, value, sortOrder: index,
    required: false, allowedOptions: [],
  }));
}
function legacyBasicValues(line: ProjectLine): Array<[string, string, string]> {
  return [
    ["species", "Species", line.woodSpecies], ["humidity", "Humidity", line.humidity],
    ["processing", "Processing", line.processing], ["quality", "Quality", line.quality],
    ["thickness", "Thickness", line.thickness], ["width", "Width", line.width], ["length", "Length", line.length],
  ].flatMap(([key, label, value]) => value ? [[key!, label!, value!] as [string, string, string]] : []);
}
function groupTitle(lines: ProjectLine[], index: number) { const names = [...new Set(lines.map((line) => line.productName).filter(Boolean))]; return names.length === 1 ? names[0]! : names.length ? `${names[0]} and compatible lines` : `Specification group ${index + 1}`; }
function fieldLabel(field: ProjectSpecificationField) { return `${field.label}${field.required ? " *" : ""}${field.unit ? ` (${field.unit})` : ""}`; }
function displayValue(field: ProjectSpecificationField, value?: string) { if (!value) return "—"; if (field.type === "boolean") return value === "true" ? "Yes" : "No"; return value; }
function valuesForBasics(line: ProjectLine) { return Object.fromEntries([...legacyBasicValues(line).map(([key, , value]) => [`legacy.${key}`, value]), ...(line.basicProperties ?? []).map((field) => [field.key, field.value])]); }
function valuesForProcesses(line: ProjectLine) { return Object.fromEntries((line.processRequirements ?? []).map((process) => [process.fieldKey, process.value])); }
function applicabilityForProcesses(line: ProjectLine) { return Object.fromEntries((line.processRequirements ?? []).map((process) => [process.fieldKey, process.active !== false])); }
function lineQuantity(line: ProjectLine) { return String(line.volumeM3 ?? line.pieces ?? 1); }
