"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { Button, DENSE_TABLE_CLASS, Input } from "@timber/ui";
import { toast } from "sonner";
import type { ProjectLine, ProjectSpecificationField } from "../types";
import { updateProjectSpecificationLine, updateProjectSpecificationStructuredValues, verifyProjectSpecificationLine, verifyProjectSpecificationStructuredValues } from "../actions/projectSpecificationActions";
import { correctProjectQuotation, getProjectRfqState, initializeDirectProjectQuotation, type ProjectQuoteEntry, type ProjectRfqCandidate } from "../actions/projectRfqActions";
import { pricesFromQuotation, quotationEntryAmountCents, quotationTotalCents, type ProjectQuotationPricingMode } from "../services/projectQuotationRows";

type SpecificationTablesProps = {
  projectId: string;
  lines: ProjectLine[];
  canEdit: boolean;
  canEnterQuotation: boolean;
  sellerOrganisationId: string | null;
  sellerOrganisationName: string | null;
  currency: string;
  onEdit: (line: ProjectLine) => void;
  onDelete: (line: ProjectLine) => void;
};

export function ProjectSpecificationTables({ projectId, lines, canEdit, canEnterQuotation, sellerOrganisationId, sellerOrganisationName, currency, onEdit, onDelete }: SpecificationTablesProps) {
  const groups = useMemo(() => groupLinesBySchema(lines), [lines]);
  const [quotePending, setQuotePending] = useState(false);
  const [quoteLoadError, setQuoteLoadError] = useState("");
  const [candidates, setCandidates] = useState<ProjectRfqCandidate[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [quotePrices, setQuotePrices] = useState<Record<string, string>>({});
  const [quoteMode,setQuoteMode]=useState<ProjectQuotationPricingMode|null>(null);
  const [quoteTotal,setQuoteTotal]=useState("");
  const [quoteStatus, setQuoteStatus] = useState<"idle" | "saved" | "error">("idle");
  const quotePricesRef = useRef<Record<string, string>>({});
  const candidatesRef = useRef<ProjectRfqCandidate[]>([]);
  const candidateIdRef = useRef("");
  const quoteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const quoteQueuedRef = useRef(0);
  const quoteErrorKeysRef = useRef(new Set<string>());
  const selectedCandidate = candidates.find((candidate) => candidate.id === candidateId) ?? null;
  const assignedSellerCandidate = candidates.find((candidate) => candidate.organisationId === sellerOrganisationId) ?? null;

  useEffect(() => {
    if (!canEnterQuotation) return;
    let cancelled = false;
    setCandidates([]); candidatesRef.current = []; setCandidateId(""); candidateIdRef.current = ""; setQuotePrices({}); quotePricesRef.current = {}; setQuoteLoadError("");
    void getProjectRfqState(projectId).then((result) => {
      if (cancelled) return;
      if (!result.success) { setQuoteLoadError(result.error); toast.error(result.error); return; }
      if (!result.data) return;
      setCandidates(result.data.candidates); candidatesRef.current = result.data.candidates;
    });
    return () => { cancelled = true; };
  }, [canEnterQuotation, projectId]);

  function selectCandidate(nextId: string) {
    setCandidateId(nextId); candidateIdRef.current = nextId; quoteErrorKeysRef.current.clear(); setQuoteStatus("idle");
    const candidate=candidates.find((item)=>item.id===nextId);const next = pricesFromQuotation(candidate?.quoteEntries ?? []);
    setQuoteMode(candidate?.pricingMode??null);setQuoteTotal(candidate?.pricingMode==="total"&&candidate.quoteTotalCents!=null?(candidate.quoteTotalCents/100).toFixed(2):"");
    quotePricesRef.current = next; setQuotePrices(next);
  }

  function restorePersistedQuotation(candidate: ProjectRfqCandidate) {
    const prices = pricesFromQuotation(candidate.quoteEntries);
    setQuoteMode(candidate.pricingMode); setQuoteTotal(candidate.pricingMode === "total" && candidate.quoteTotalCents != null ? (candidate.quoteTotalCents / 100).toFixed(2) : "");
    quotePricesRef.current = prices; setQuotePrices(prices);
  }

  async function createDirectQuotation() {
    setQuotePending(true); setQuoteLoadError("");
    try {
      const result = await initializeDirectProjectQuotation({ projectId });
      if (!result.success) { setQuoteLoadError(result.error); toast.error(result.error); return; }
      const refreshed = await getProjectRfqState(projectId);
      if (!refreshed.success || !refreshed.data) { const message = refreshed.success ? "Could not load supplier quotation" : refreshed.error; setQuoteLoadError(message); toast.error(message); return; }
      setCandidates(refreshed.data.candidates); candidatesRef.current = refreshed.data.candidates;
      const candidate = refreshed.data.candidates.find((item) => item.id === result.data.candidateId);
      if (candidate) { setCandidateId(candidate.id); candidateIdRef.current = candidate.id; const prices = pricesFromQuotation(candidate.quoteEntries); setQuotePrices(prices); quotePricesRef.current = prices;setQuoteMode(candidate.pricingMode);setQuoteTotal(candidate.pricingMode==="total"&&candidate.quoteTotalCents!=null?(candidate.quoteTotalCents/100).toFixed(2):""); }
    } catch {
      const message = "Could not create supplier quotation";
      setQuoteLoadError(message); toast.error(message);
    } finally {
      setQuotePending(false);
    }
  }

  function setQuotePrice(key: string, value: string) {
    const next = { ...quotePricesRef.current, [key]: value };
    quotePricesRef.current = next; setQuotePrices(next); setQuoteStatus("idle");
  }

  function saveQuotationEntry(entry: Omit<ProjectQuoteEntry, "unitPriceCents">, value: string, candidateOverride?: string) {
    const numericPrice = Number(value);
    const entryKey = `${entry.targetType}:${entry.targetId}`;
    if (!value.trim() || !Number.isFinite(numericPrice) || numericPrice < 0) {
      const existing = candidatesRef.current.find((item) => item.id === candidateIdRef.current)?.quoteEntries.find((item) => `${item.targetType}:${item.targetId}` === entryKey);
      const restored = existing ? (existing.unitPriceCents / 100).toFixed(2) : "";
      quotePricesRef.current = { ...quotePricesRef.current, [entryKey]: restored }; setQuotePrices(quotePricesRef.current);
      setQuoteStatus("error"); toast.error("Enter a valid quotation price"); return;
    }
    queueQuotationChange(entryKey, (candidate) => {
      const nextEntry: ProjectQuoteEntry = { ...entry, unitPriceCents: Math.round(numericPrice * 100) };
      return [...candidate.quoteEntries.filter((item) => `${item.targetType}:${item.targetId}` !== entryKey), nextEntry];
    }, candidateOverride);
  }

  function removeQuotationEntry(entryKey: string, candidateOverride?: string) {
    queueQuotationChange(entryKey, (candidate) => candidate.quoteEntries.filter((item) => `${item.targetType}:${item.targetId}` !== entryKey), candidateOverride);
  }

  function queueQuotationChange(entryKey: string, buildEntries: (candidate: ProjectRfqCandidate) => ProjectQuoteEntry[], candidateOverride?: string) {
    const savingCandidateId = candidateOverride ?? candidateIdRef.current;
    quoteQueuedRef.current += 1; setQuotePending(true); setQuoteStatus("idle");
    quoteQueueRef.current = quoteQueueRef.current.catch(() => undefined).then(async () => {
      const candidate = candidatesRef.current.find((item) => item.id === savingCandidateId);
      if (!candidate) { setQuoteStatus("error"); toast.error("Select an RFQ candidate"); return; }
      const entries = buildEntries(candidate);
      let result;
      const savingMode: "itemized" | "itemized_total"=quoteMode==="itemized_total"?"itemized_total":"itemized";
      try { result = await correctProjectQuotation({ candidateId: candidate.id, pricingMode:savingMode, entries, totalCents:null, notes: candidate.quoteNotes ?? "" }); }
      catch { restorePersistedQuotation(candidate); quoteErrorKeysRef.current.add(entryKey); setQuoteStatus("error"); toast.error("Could not save quotation"); return; }
      if (!result.success) { restorePersistedQuotation(candidate); quoteErrorKeysRef.current.add(entryKey); setQuoteStatus("error"); toast.error(result.error); return; }
      quoteErrorKeysRef.current.delete(entryKey);
      const quoteTotalCents = entries.reduce((sum, item) => sum + quotationEntryAmountCents(savingMode,item.quantity,item.unitPriceCents), 0);
      const nextCandidates = candidatesRef.current.map((item) => item.id === candidate.id ? { ...item, pricingMode:savingMode, quoteEntries: entries, quoteTotalCents } : item);
      candidatesRef.current = nextCandidates; setCandidates(nextCandidates); setQuoteStatus(quoteErrorKeysRef.current.size ? "error" : "saved");
      window.dispatchEvent(new CustomEvent("project-quotation-updated", { detail: { projectId } }));
    }).finally(() => { quoteQueuedRef.current -= 1; if (quoteQueuedRef.current === 0) setQuotePending(false); });
  }

  async function saveTotalQuotation(){
    const candidate=candidatesRef.current.find((item)=>item.id===candidateIdRef.current);const totalCents=quotationTotalCents(quoteTotal);
    if(!candidate||totalCents===null){toast.error("Enter a valid total project price");return}
    setQuotePending(true);setQuoteStatus("idle");
    try{
      const result=await correctProjectQuotation({candidateId:candidate.id,pricingMode:"total",entries:[],totalCents,notes:candidate.quoteNotes??""});
      if(!result.success){restorePersistedQuotation(candidate);setQuoteStatus("error");toast.error(result.error);return}
      const next=candidatesRef.current.map((item)=>item.id===candidate.id?{...item,pricingMode:"total" as const,quoteEntries:[],quoteTotalCents:totalCents}:item);candidatesRef.current=next;setCandidates(next);setQuoteStatus("saved");window.dispatchEvent(new CustomEvent("project-quotation-updated",{detail:{projectId}}));
    }catch{restorePersistedQuotation(candidate);setQuoteStatus("error");toast.error("Could not save quotation");}
    finally{setQuotePending(false)}
  }

  return <div className="space-y-3 p-3">
    {canEnterQuotation ? <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[#ded8d0] bg-[#f8faf9] p-3 dark:border-border dark:bg-muted/30">
      <label className="grid min-w-64 gap-1 text-sm"><span className="font-medium">Supplier quotation</span><select disabled={quotePending} className="h-9 rounded-md border bg-background px-3" value={candidateId} onChange={(event) => selectCandidate(event.target.value)}><option value="">Select existing RFQ candidate</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.organisationName}{candidate.status === "awarded" ? " · awarded" : ""}</option>)}</select></label>
      <p className={`pb-2 text-xs ${quoteLoadError ? "text-destructive" : "text-muted-foreground"}`}>{quoteLoadError || (candidates.length ? selectedCandidate ? `Editing the authoritative ${selectedCandidate.organisationName} quotation.` : "Select whose quotation was received." : sellerOrganisationId ? `No quotation exists yet for ${sellerOrganisationName ?? "the assigned seller"}.` : "Assign a seller before entering a quotation.")}</p>
      {!assignedSellerCandidate && sellerOrganisationId ? <Button size="sm" disabled={quotePending} onClick={() => void createDirectQuotation()}>Create supplier quotation</Button> : null}
      {candidateId ? <span className={`ml-auto pb-2 text-xs ${quoteStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}>{quotePending ? "Saving quotation…" : quoteStatus === "saved" ? "Quotation saved" : quoteStatus === "error" ? "Save failed" : "Saves when focus leaves a price"}</span> : null}
      {candidateId?<fieldset className="flex w-full flex-wrap items-center gap-4 border-t pt-3"><legend className="sr-only">Quotation pricing mode</legend><label className="flex items-center gap-2 text-sm"><input disabled={quotePending} type="radio" name={`quotation-pricing-mode-${candidateId}`} checked={quoteMode==="itemized"} onChange={()=>setQuoteMode("itemized")}/>Unit price for each process</label><label className="flex items-center gap-2 text-sm"><input disabled={quotePending} type="radio" name={`quotation-pricing-mode-${candidateId}`} checked={quoteMode==="itemized_total"} onChange={()=>setQuoteMode("itemized_total")}/>Total for each process</label><label className="flex items-center gap-2 text-sm"><input disabled={quotePending} type="radio" name={`quotation-pricing-mode-${candidateId}`} checked={quoteMode==="total"} onChange={()=>setQuoteMode("total")}/>One total for all processes</label>{quoteMode==="total"?<><Input className="w-44" aria-label="Total for all processes" type="number" min="0" step="0.01" value={quoteTotal} onChange={(event)=>setQuoteTotal(event.target.value)}/><Button size="sm" disabled={quotePending||quotationTotalCents(quoteTotal)===null} onClick={()=>void saveTotalQuotation()}>Save total</Button></>:null}</fieldset>:null}
    </div> : null}
    {groups.map((group, groupIndex) => <section key={group.key} className="overflow-hidden rounded-lg border border-[#ded8d0] bg-white dark:border-border dark:bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ded8d0] bg-white px-3 py-2 dark:border-border dark:bg-card">
        <div><h3 className="font-semibold">{groupTitle(group.lines, groupIndex)}</h3><p className="text-xs text-muted-foreground">{group.lines.length} line(s) sharing the same properties</p></div>
      </div>
      <div>
        <table className={`w-full border-collapse text-sm ${DENSE_TABLE_CLASS} ${selectedCandidate&&quoteMode==="total"?"[&_input[aria-label^='Quotation_price']]:hidden":""}`}>
          <thead className="sr-only"><tr><th scope="col">Specification line</th></tr></thead>
          <tbody>{group.lines.map((line) => <SpecificationProductRows key={line.id ?? line.lineNo} projectId={projectId} line={line} fields={group.fields} canEdit={canEdit} currency={currency} quotation={selectedCandidate&&quoteMode!=="total"&&quoteMode ? { candidateId: selectedCandidate.id, candidateName: selectedCandidate.organisationName, mode:quoteMode, prices: quotePrices, setPrice: setQuotePrice, save: saveQuotationEntry, remove: removeQuotationEntry, pending: quotePending } : null} onEdit={onEdit} onDelete={onDelete} />)}</tbody>
        </table>
      </div>
    </section>)}
  </div>;
}

function SpecificationProductRows({ projectId, line, fields, canEdit, currency, quotation, onEdit, onDelete }: {
  projectId: string; line: ProjectLine; fields: ProjectSpecificationField[]; canEdit: boolean;
  currency: string; quotation: { candidateId: string; candidateName: string; mode:"itemized"|"itemized_total"; prices: Record<string, string>; setPrice: (key: string, value: string) => void; save: (entry: Omit<ProjectQuoteEntry, "unitPriceCents">, value: string, candidateId?: string) => void; remove: (key: string, candidateId?: string) => void; pending: boolean } | null;
  onEdit: (line: ProjectLine) => void; onDelete: (line: ProjectLine) => void;
}) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [processesOpen, setProcessesOpen] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showInactiveProperties, setShowInactiveProperties] = useState(false);
  const [quantity, setQuantity] = useState(lineQuantity(line));
  const [notes, setNotes] = useState(line.notes ?? "");
  const [basicValues, setBasicValues] = useState<Record<string, string>>(() => valuesForBasics(line));
  const [activeProperties, setActiveProperties] = useState<Record<string, boolean>>(() => applicabilityForBasics(line));
  const [processValues, setProcessValues] = useState<Record<string, string>>(() => valuesForProcesses(line));
  const [activeProcesses, setActiveProcesses] = useState<Record<string, boolean>>(() => applicabilityForProcesses(line));
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const queuedCountRef = useRef(0);
  const queueHadErrorRef = useRef(false);
  const versionRef = useRef(line.structuredValuesVersion);
  const valuesRef = useRef({ quantity: lineQuantity(line), notes: line.notes ?? "", basic: valuesForBasics(line), basicActive: applicabilityForBasics(line), process: valuesForProcesses(line), active: applicabilityForProcesses(line) });
  const committedRef = useRef(structuredClone(valuesRef.current));
  const lastQueuedLineRef = useRef(lineSignature(valuesRef.current));
  const lastQueuedStructuredRef = useRef(structuredSignature(valuesRef.current));
  const processes = line.processRequirements ?? [];
  const editableSnapshot = canEdit && line.isCatalogSnapshot && Boolean(line.id);
  const structuredFields = line.basicProperties ?? [];
  const visibleFields = showInactiveProperties ? fields : fields.filter((field) => activeProperties[field.key] !== false);
  const visibleProcesses = showInactive ? processes : processes.filter((process) => activeProcesses[process.fieldKey] !== false);
  const activeCount = processes.filter((process) => activeProcesses[process.fieldKey] !== false).length;
  const hasMaterialProcess = processes.some((process) => process.fieldKey === "metal");
  const linePriceKey = line.id && !hasMaterialProcess ? `line:${line.id}` : "";
  const lineQuantityValue = Number(quantity || 0);
  const lineUnitPrice = quotation && linePriceKey ? quotation.prices[linePriceKey] ?? "" : "";
  const lineHeaderId = `specification-line-${line.id ?? line.lineNo}`;

  useEffect(() => {
    const next = { quantity: lineQuantity(line), notes: line.notes ?? "", basic: valuesForBasics(line), basicActive: applicabilityForBasics(line), process: valuesForProcesses(line), active: applicabilityForProcesses(line) };
    setQuantity(next.quantity); setNotes(next.notes); setBasicValues(next.basic); setActiveProperties(next.basicActive); setProcessValues(next.process); setActiveProcesses(next.active); setShowInactive(false); setShowInactiveProperties(false);
    valuesRef.current = next; committedRef.current = structuredClone(next); versionRef.current = line.structuredValuesVersion;
    lastQueuedLineRef.current = lineSignature(next); lastQueuedStructuredRef.current = structuredSignature(next); setSaveStatus("idle");
  // Server actions may re-render this client component with a new `line` object.
  // Reinitialize only when the actual row changes; otherwise that render can
  // replace an in-flight local edit with the preceding server snapshot.
  }, [line.id]);

  function enqueue(mutation: () => Promise<boolean>) {
    if (queuedCountRef.current === 0) queueHadErrorRef.current = false;
    queuedCountRef.current += 1;
    setSaveStatus("saving");
    queueRef.current = queueRef.current.then(async () => {
      let success = false;
      try { success = await mutation(); }
      catch { queueHadErrorRef.current = true; toast.error("Could not save specification"); }
      finally {
        if (!success) queueHadErrorRef.current = true;
        queuedCountRef.current -= 1;
        setSaveStatus(queuedCountRef.current > 0 ? "saving" : queueHadErrorRef.current ? "error" : "saved");
      }
    });
  }

  function saveStructuredFields(onSaved?: () => void, onFailed?: () => void) {
    if (!line.id || !editableSnapshot) return;
    const snapshot = structuredClone(valuesRef.current);
    const signature = structuredSignature(snapshot);
    if (signature === lastQueuedStructuredRef.current) return;
    lastQueuedStructuredRef.current = signature;
    enqueue(async () => {
      let structured;
      const payload = {
        projectId, lineId: line.id!, version: versionRef.current,
        basicValues: structuredFields.map((field) => ({ key: field.key, value: snapshot.basic[field.key] ?? "", active: snapshot.basicActive[field.key] !== false })),
        processValues: processes.map((process) => ({ key: process.fieldKey, value: snapshot.process[process.fieldKey] ?? "0", active: snapshot.active[process.fieldKey] !== false })),
      };
      try {
        structured = await updateProjectSpecificationStructuredValues({
          ...payload,
        });
      } catch (error) {
        try {
          const verification = await verifyProjectSpecificationStructuredValues(payload);
          if (verification.success && verification.data.matches) {
            versionRef.current = verification.data.version;
            committedRef.current = { ...committedRef.current, basic: snapshot.basic, basicActive: snapshot.basicActive, process: snapshot.process, active: snapshot.active };
            runPostSave(onSaved);
            return true;
          }
        } catch {
          // Preserve the original mutation error when verification is unavailable.
        }
        onFailed?.();
        if (lastQueuedStructuredRef.current === signature) lastQueuedStructuredRef.current = structuredSignature(committedRef.current);
        throw error;
      }
      if (!structured.success) {
        const verification = await verifyProjectSpecificationStructuredValues(payload);
        if (verification.success && verification.data.matches) {
          versionRef.current = verification.data.version;
          committedRef.current = { ...committedRef.current, basic: snapshot.basic, basicActive: snapshot.basicActive, process: snapshot.process, active: snapshot.active };
          runPostSave(onSaved);
          return true;
        }
        onFailed?.(); if (lastQueuedStructuredRef.current === signature) lastQueuedStructuredRef.current = structuredSignature(committedRef.current); toast.error(structured.error); return false;
      }
      versionRef.current = structured.data.version;
      committedRef.current = { ...committedRef.current, basic: snapshot.basic, basicActive: snapshot.basicActive, process: snapshot.process, active: snapshot.active };
      runPostSave(onSaved);
      return true;
    });
  }

  function saveLine(onSaved?: () => void) {
    if (!line.id || !canEdit) return;
    const snapshot = { quantity: valuesRef.current.quantity, notes: valuesRef.current.notes };
    const signature = lineSignature(snapshot);
    if (signature === lastQueuedLineRef.current) return;
    lastQueuedLineRef.current = signature;
    enqueue(async () => {
      const payload = { projectId, lineId: line.id!, productName: line.productName ?? "Specification line", quantity: snapshot.quantity, unit: line.unit, notes: snapshot.notes, version: versionRef.current };
      let product;
      try {
        product = await updateProjectSpecificationLine(payload);
      } catch (error) {
        try {
          const verification = await verifyProjectSpecificationLine(payload);
          if (verification.success && verification.data.matches) {
            versionRef.current = verification.data.version;
            committedRef.current = { ...committedRef.current, ...snapshot };
            runPostSave(onSaved);
            return true;
          }
        } catch {
          // Preserve the original mutation error when verification is unavailable.
        }
        if (lastQueuedLineRef.current === signature) lastQueuedLineRef.current = lineSignature(committedRef.current);
        throw error;
      }
      if (!product.success) {
        const verification = await verifyProjectSpecificationLine(payload);
        if (verification.success && verification.data.matches) {
          versionRef.current = verification.data.version;
          committedRef.current = { ...committedRef.current, ...snapshot };
          runPostSave(onSaved);
          return true;
        }
        if (lastQueuedLineRef.current === signature) lastQueuedLineRef.current = lineSignature(committedRef.current); toast.error(product.error); return false;
      }
      versionRef.current = product.data.version;
      committedRef.current = { ...committedRef.current, ...snapshot };
      runPostSave(onSaved);
      return true;
    });
  }

  function runPostSave(callback?: () => void) {
    if (!callback) return;
    try { callback(); }
    catch { toast.error("Specification saved, but the related quotation update could not be started"); }
  }

  return <Fragment>
    <tr className="border-b border-[#ded8d0] bg-[#f3f0ec] dark:border-border dark:bg-muted">
      <th id={lineHeaderId} scope="row" className="px-3 py-2 text-left font-normal"><div className="flex min-w-0 items-center gap-3"><span className="shrink-0 text-xs text-muted-foreground">#{line.lineNo}</span><span className="min-w-0 truncate font-semibold">{line.productName ?? "—"}</span><span className="shrink-0 text-xs text-muted-foreground">{line.unit}</span>{canEdit ? <div className="ml-auto flex shrink-0 items-center gap-1"><span className={`min-w-12 text-right text-xs ${saveStatus === "error" ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">{saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Error" : ""}</span>{!line.id ? <Button variant="ghost" size="icon" aria-label={`Edit ${line.productName ?? "line"}`} onClick={() => onEdit(line)}><Pencil className="h-4 w-4" /></Button> : null}<Button variant="ghost" size="icon" disabled={saveStatus === "saving"} aria-label={`Delete ${line.productName ?? "line"}`} onClick={() => onDelete(line)}><Trash2 className="h-4 w-4" /></Button></div> : null}</div></th>
    </tr>
    <tr className="border-b border-[#ebe6e0] bg-white align-top dark:border-border dark:bg-card">
      <td headers={lineHeaderId} className="p-3">{fields.some((field) => activeProperties[field.key] === false) ? <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={showInactiveProperties} onChange={(event) => setShowInactiveProperties(event.target.checked)} /> Show inactive properties</label> : null}<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleFields.map((field) => { const fieldEditable = editableSnapshot && structuredFields.some((candidate) => candidate.key === field.key); const active = activeProperties[field.key] !== false; return <label key={field.key} className={`min-w-0 overflow-hidden rounded-md border border-[#e5e0da] dark:border-border ${active ? "bg-[#fcfbfa] dark:bg-muted/20" : "bg-[#fafafa] opacity-70 dark:bg-muted/10"}`}><span className="flex items-center gap-1.5 border-b bg-[#f3f0ec] px-2 py-0.5 text-xs font-medium text-muted-foreground dark:bg-muted/40">{fieldEditable ? <input type="checkbox" className="h-3.5 w-3.5 shrink-0 accent-primary" aria-label={`Use ${field.label} for ${line.productName ?? "line"}`} checked={active} onChange={(event) => { const next = event.target.checked; setActiveProperties((current) => ({ ...current, [field.key]: next })); valuesRef.current.basicActive = { ...valuesRef.current.basicActive, [field.key]: next }; saveStructuredFields(undefined, () => { setActiveProperties((current) => ({ ...current, [field.key]: active })); valuesRef.current.basicActive = { ...valuesRef.current.basicActive, [field.key]: active }; }); }} /> : null}<span className="truncate">{fieldLabel(field)}</span></span>{fieldEditable ? <BasicFieldInput field={field} value={basicValues[field.key] ?? ""} disabled={!active} onChange={(value) => { setBasicValues((current) => ({ ...current, [field.key]: value })); valuesRef.current.basic = { ...valuesRef.current.basic, [field.key]: value }; }} onCommit={saveStructuredFields} /> : <span className="block min-h-8 px-2 py-1.5">{displayValue(field, basicValues[field.key])}</span>}</label>; })}
        <label className="overflow-hidden rounded-md border border-[#e5e0da] bg-[#fcfbfa] dark:border-border dark:bg-muted/20"><span className="block border-b bg-[#f3f0ec] px-2 py-1 text-xs font-medium text-muted-foreground dark:bg-muted/40">Quantity</span>{canEdit && line.id ? <CompactInput aria-label={`Quantity for ${line.productName ?? "line"}`} type="number" min="0" step="any" value={quantity} onChange={(event) => { setQuantity(event.target.value); valuesRef.current.quantity = event.target.value; }} onBlur={() => saveLine(() => { if (quotation && lineUnitPrice) quotation.save({ targetType: "line", targetId: line.id!, label: line.productName ?? `Line ${line.lineNo}`, quantity: Number(valuesRef.current.quantity), unit: line.unit }, lineUnitPrice, quotation.candidateId); })} /> : <span className="block min-h-10 px-3 py-2">{quantity}</span>}</label>
        <label className="overflow-hidden rounded-md border border-[#e5e0da] bg-[#fcfbfa] dark:border-border dark:bg-muted/20 sm:col-span-2"><span className="block border-b bg-[#f3f0ec] px-2 py-1 text-xs font-medium text-muted-foreground dark:bg-muted/40">Technical notes</span>{canEdit && line.id ? <CompactInput aria-label={`Technical notes for ${line.productName ?? "line"}`} value={notes} onChange={(event) => { setNotes(event.target.value); valuesRef.current.notes = event.target.value; }} onBlur={() => saveLine()} /> : <span className="block min-h-10 px-3 py-2">{notes || "—"}</span>}</label>
      </div>{quotation && linePriceKey && line.id ? <div className="mt-3 grid items-end gap-2 rounded-md border border-[#d9e2dd] bg-[#f4f8f5] p-2 sm:grid-cols-[1fr_9rem_8rem] dark:border-border dark:bg-primary/10"><div><p className="text-xs font-medium text-muted-foreground">{quotation.candidateName} quotation · {line.productName}</p><p className="text-sm">{quantity} {line.unit}</p></div><label className="text-xs font-medium">{quotation.mode==="itemized_total"?"Line total":"Unit price"} ({currency})<CompactInput className="!rounded-md !border !border-[#b8c8bf] !bg-white dark:!border-border dark:!bg-background" aria-label={`${quotation.mode==="itemized_total"?"Quotation total price":"Quotation unit price"} for ${line.productName ?? "line"}`} type="number" min="0" step="0.01" disabled={quotation.pending || saveStatus === "saving" || saveStatus === "error"} value={lineUnitPrice} onChange={(event) => quotation.setPrice(linePriceKey, event.target.value)} onBlur={() => quotation.save({ targetType: "line", targetId: line.id!, label: line.productName ?? `Line ${line.lineNo}`, quantity: lineQuantityValue, unit: line.unit }, lineUnitPrice)} /></label><p className="pb-2 text-right text-sm font-semibold">{moneyEntry(lineUnitPrice, lineQuantityValue, currency,quotation.mode)}</p></div> : null}</td>
    </tr>
    {processes.length ? <tr className="border-b last:border-b-0"><td headers={lineHeaderId} className="p-0">
      <div className="m-3 overflow-hidden rounded-md border border-[#d9e2dd] bg-white dark:border-border dark:bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#e9f0ec] px-3 py-2 dark:bg-primary/15">
          <div className="flex items-center gap-2 font-medium"><span aria-hidden>↳</span> Applicable processes <span className="text-xs font-normal text-muted-foreground">{activeCount} selected</span></div>
          <div className="flex items-center gap-3">
            {processes.some((process) => activeProcesses[process.fieldKey] === false) ? canEdit ? <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="h-4 w-4 accent-primary" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> Show inactive</label> : <Button type="button" variant="ghost" size="sm" onClick={() => setShowInactive((current) => !current)}>{showInactive ? "Hide inactive" : "Show inactive"}</Button> : null}
            <Button type="button" variant="outline" size="sm" aria-expanded={processesOpen} onClick={() => setProcessesOpen((open) => !open)}>{processesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{processesOpen ? "Hide processes" : "Show processes"}</Button>
          </div>
        </div>
        {processesOpen ? <div className="overflow-x-auto"><table className={`w-full min-w-[36rem] table-fixed border-collapse text-sm ${DENSE_TABLE_CLASS}`}><thead><tr className="border-b border-[#ded8d0] bg-[#f8faf9] text-left text-xs text-[#485358] dark:border-border dark:bg-muted/50 dark:text-muted-foreground"><th className="w-12 px-2 py-2 font-medium">Use</th><th className="px-2 py-2 font-medium">Process{quotation ? ` · ${quotation.candidateName}` : ""}</th><th className="w-24 px-2 py-2 font-medium">Quantity</th><th className="w-14 px-2 py-2 font-medium">Unit</th>{quotation ? <><th className="w-28 px-2 py-2 font-medium">{quotation.mode==="itemized_total"?"Process total":"Unit price"}</th><th className="w-28 px-2 py-2 text-right font-medium">Total</th></> : null}</tr></thead><tbody>
          {visibleProcesses.map((process) => { const active = activeProcesses[process.fieldKey] !== false; return <tr key={process.id} className={`border-b border-[#ebe6e0] last:border-b-0 dark:border-border ${active ? "bg-white dark:bg-card" : "bg-[#fafafa] text-[#657078] dark:bg-muted/30 dark:text-muted-foreground"}`}>
            <td className="px-2 py-1.5">{editableSnapshot ? <input type="checkbox" className="h-3.5 w-3.5 accent-primary" aria-label={`Use ${process.name} for ${line.productName ?? "line"}`} checked={active} onChange={(event) => { const next = event.target.checked; const quoteCandidateId = quotation?.candidateId; setActiveProcesses((current) => ({ ...current, [process.fieldKey]: next })); valuesRef.current.active = { ...valuesRef.current.active, [process.fieldKey]: next }; saveStructuredFields(() => { if (!next && quoteCandidateId) quotation?.remove(`process:${process.id}`, quoteCandidateId); }, () => { setActiveProcesses((current) => ({ ...current, [process.fieldKey]: active })); valuesRef.current.active = { ...valuesRef.current.active, [process.fieldKey]: active }; }); }} /> : active ? <span className="text-primary">✓</span> : <span>—</span>}</td>
            <td className="px-2 py-1.5 font-medium">{process.name}</td><td className="p-0">{editableSnapshot ? <CompactInput aria-label={`${process.name} quantity for ${line.productName ?? "line"}`} type="number" min="0" step="any" disabled={!active} value={processValues[process.fieldKey] ?? "0"} onChange={(event) => { setProcessValues((current) => ({ ...current, [process.fieldKey]: event.target.value })); valuesRef.current.process = { ...valuesRef.current.process, [process.fieldKey]: event.target.value }; }} onBlur={() => saveStructuredFields(() => { const price = quotation?.prices[`process:${process.id}`] ?? ""; if (quotation && price && active) quotation.save({ targetType: "process", targetId: process.id, label: `${line.productName ?? `Line ${line.lineNo}`} · ${process.name}`, quantity: Number(valuesRef.current.process[process.fieldKey] ?? 0), unit: process.unit ?? "unit" }, price, quotation.candidateId); })} /> : <span className="block px-2 py-1.5">{processValues[process.fieldKey] ?? "0"}</span>}</td><td className="px-2 py-1.5">{process.unit ?? "—"}</td>{quotation ? <><td className="p-0"><CompactInput className="!rounded-md !border !border-[#b8c8bf] !bg-white dark:!border-border dark:!bg-background" aria-label={`${quotation.mode==="itemized_total"?"Quotation total price":"Quotation unit price"} for ${process.name}`} type="number" min="0" step="0.01" disabled={!active || quotation.pending || saveStatus === "saving" || saveStatus === "error"} value={quotation.prices[`process:${process.id}`] ?? ""} onChange={(event) => quotation.setPrice(`process:${process.id}`, event.target.value)} onBlur={() => quotation.save({ targetType: "process", targetId: process.id, label: `${line.productName ?? `Line ${line.lineNo}`} · ${process.name}`, quantity: Number(processValues[process.fieldKey] ?? 0), unit: process.unit ?? "unit" }, quotation.prices[`process:${process.id}`] ?? "")} /></td><td className="px-2 py-1.5 text-right font-medium">{moneyEntry(quotation.prices[`process:${process.id}`] ?? "", Number(processValues[process.fieldKey] ?? 0), currency,quotation.mode)}</td></> : null}
          </tr>; })}
          {visibleProcesses.length === 0 ? <tr><td colSpan={quotation ? 6 : 4} className="px-3 py-6 text-center text-sm text-muted-foreground">No applicable processes. Show inactive processes to add one.</td></tr> : null}
        </tbody></table></div> : null}
      </div>
    </td></tr> : null}
  </Fragment>;
}

function CompactInput({ type, ...props }: React.ComponentProps<typeof Input>) { const numeric = type === "number"; return <Input {...props} type={numeric ? "text" : type} inputMode={numeric ? "decimal" : props.inputMode} className={`h-[34px] min-w-0 rounded-none border-0 bg-transparent px-2 shadow-none focus-visible:bg-[#f8fcfa] focus-visible:ring-2 focus-visible:ring-inset dark:focus-visible:bg-muted/30 ${props.className ?? ""}`} />; }
function lineSignature(value: { quantity: string; notes: string }) { return JSON.stringify([value.quantity, value.notes]); }
function structuredSignature(value: { basic: Record<string, string>; basicActive: Record<string, boolean>; process: Record<string, string>; active: Record<string, boolean> }) { return JSON.stringify([value.basic, value.basicActive, value.process, value.active]); }
function BasicFieldInput({ field, value, disabled, onChange, onCommit }: { field: ProjectSpecificationField; value: string; disabled?: boolean; onChange: (value: string) => void; onCommit: () => void }) {
  if (field.type === "file") return <span className="block px-3 py-2 text-muted-foreground" title="File fields are managed through catalogue assets">{value || "No file"}</span>;
  if (field.type === "select") return <select disabled={disabled} aria-label={field.label} className="h-[34px] w-full min-w-0 border-0 bg-transparent px-2 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary" value={value} onChange={(event) => { onChange(event.target.value); queueMicrotask(onCommit); }}><option value="">—</option>{field.allowedOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  if (field.type === "boolean") return <select disabled={disabled} aria-label={field.label} className="h-[34px] w-full min-w-0 border-0 bg-transparent px-2 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary" value={value} onChange={(event) => { onChange(event.target.value); queueMicrotask(onCommit); }}><option value="">—</option><option value="true">Yes</option><option value="false">No</option></select>;
  return <CompactInput disabled={disabled} aria-label={field.label} type={field.type === "number" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onCommit} />;
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
    required: false, allowedOptions: [], active: true,
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
function moneyEntry(price: string, quantity: number, currency: string, mode:"itemized"|"itemized_total") { const amount = mode==="itemized_total"?Number(price):Number(price)*quantity; return Number.isFinite(amount) && price !== "" ? `${amount.toFixed(2)} ${currency}` : "—"; }
function valuesForBasics(line: ProjectLine) { return Object.fromEntries([...legacyBasicValues(line).map(([key, , value]) => [`legacy.${key}`, value]), ...(line.basicProperties ?? []).map((field) => [field.key, field.value])]); }
function applicabilityForBasics(line: ProjectLine) { return Object.fromEntries((line.basicProperties ?? []).map((field) => [field.key, field.active !== false])); }
function valuesForProcesses(line: ProjectLine) { return Object.fromEntries((line.processRequirements ?? []).map((process) => [process.fieldKey, process.value])); }
function applicabilityForProcesses(line: ProjectLine) { return Object.fromEntries((line.processRequirements ?? []).map((process) => [process.fieldKey, process.active !== false])); }
function lineQuantity(line: ProjectLine) { return String(line.volumeM3 ?? line.pieces ?? 1); }
