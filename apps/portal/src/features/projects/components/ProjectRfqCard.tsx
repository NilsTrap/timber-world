"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button, Input, Label,
} from "@timber/ui";
import {
  awardProjectQuotation, cancelProjectQuotationRequest, getEligibleProjectRfqCandidates, getProjectRfqState,
  correctProjectQuotation, requestProjectQuotations, saveProjectAwardedMargin, submitProjectQuotation,
  type ProjectCommercialPricing, type ProjectRfqCandidate, type ProjectRfqState,
} from "../actions/projectRfqActions";
import { calculateProjectMargin, type ProjectMarginMode } from "../services/projectRfq";
import type { ProjectLine } from "../types";
import { ProjectSectionBody, ProjectSectionCard, ProjectSectionHeader } from "./ProjectSectionCard";

export function ProjectRfqCard({ projectId, currency, canManage, canEnterCandidateQuotation, initialOptions, lines }: {
  projectId: string; currency: string; canManage: boolean; canEnterCandidateQuotation:boolean; initialOptions: Array<{ id: string; name: string }>; lines:ProjectLine[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rfq, setRfq] = useState<ProjectRfqState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>(initialOptions);
  const [selected, setSelected] = useState<string[]>([]);
  const [deadline, setDeadline] = useState(earliestDeadlineValue());
  const [prices,setPrices]=useState<Record<string,string>>({});
  const [notes, setNotes] = useState("");
  const [awardTarget, setAwardTarget] = useState<ProjectRfqCandidate | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [adminCandidateId,setAdminCandidateId]=useState<string|null>(null);
  const [viewCandidateId,setViewCandidateId]=useState<string|null>(null);

  const loadOptions = useCallback(async () => {
    const choices = await getEligibleProjectRfqCandidates(projectId);
    if (choices.success) setOptions(choices.data);
    else toast.error(choices.error);
  }, [projectId]);

  const load = useCallback(async () => {
    const result = await getProjectRfqState(projectId);
    if (!result.success) { toast.error(result.error); setLoaded(true); return; }
    setRfq(result.data);
    setAdminCandidateId((current)=>current&&result.data?.candidates.some((candidate)=>candidate.id===current)?current:null);
    setViewCandidateId((current)=>current&&result.data?.candidates.some((candidate)=>candidate.id===current)?current:null);
    const ownCandidate = result.data?.candidates.find((candidate) => candidate.id === result.data?.ownCandidateId);
    if (ownCandidate) {setNotes(ownCandidate.quoteNotes??"");setPrices(pricesFromEntries(ownCandidate.quoteEntries));}
    setLoaded(true);
    if (!result.data && canManage) {
      await loadOptions();
    }
  }, [canManage, loadOptions, projectId]);

  useEffect(() => { void load(); }, [load]);

  function requestQuotations() {
    startTransition(async () => {
      const result = await requestProjectQuotations({ projectId, candidateIds: selected, deadline: new Date(deadline).toISOString() });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Quotation requests created");
      router.refresh();
      await load();
    });
  }

  function submitQuotation() {
    const candidateId=rfq?.canManage?adminCandidateId:rfq?.ownCandidateId;if(!candidateId)return;
    const entries=pricingRows(lines).flatMap((row)=>{const unitPrice=Number(prices[row.key]);return Number.isFinite(unitPrice)&&unitPrice>=0?[{targetType:row.targetType,targetId:row.targetId,label:row.label,quantity:row.quantity,unit:row.unit,unitPriceCents:Math.round(unitPrice*100)}]:[]});
    startTransition(async () => {
      const result = rfq?.canManage ? await correctProjectQuotation({candidateId,entries,notes}) : await submitProjectQuotation({ candidateId, entries, notes });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Quotation submitted");setAdminCandidateId(null);setPrices({});
      await load();
    });
  }

  function confirmAward() {
    if (!rfq || !awardTarget) return;
    startTransition(async () => {
      const result = await awardProjectQuotation({ projectId, rfqId: rfq.id, candidateId: awardTarget.id });
      if (!result.success) { toast.error(result.error); return; }
      setAwardTarget(null);
      toast.success("Quotation awarded and seller assigned");
      router.refresh();
      await load();
    });
  }

  function cancelRequest() {
    if (!rfq) return;
    startTransition(async () => {
      const result = await cancelProjectQuotationRequest({ projectId, rfqId: rfq.id });
      if (!result.success) { toast.error(result.error); return; }
      setConfirmCancel(false);
      toast.success("Quotation request closed");
      await load();
    });
  }

  function startNewRound() {
    setRfq(null);
    setAdminCandidateId(null);
    setViewCandidateId(null);
    setPrices({});
    setNotes("");
    setSelected([]);
    setDeadline(earliestDeadlineValue());
    void loadOptions();
  }

  if (!loaded) return <ProjectSectionCard><ProjectSectionHeader title="Supplier quotations" subtitle="Loading quotation requests…" /></ProjectSectionCard>;
  if (!rfq && !canManage) return null;
  const deadlinePassed = Boolean(rfq && new Date(rfq.deadline).getTime() <= Date.now());

  const viewedCandidate=viewCandidateId?rfq?.candidates.find((candidate)=>candidate.id===viewCandidateId)??null:null;
  const ownReadOnlyCandidate=rfq?.ownCandidateId?rfq.candidates.find((candidate)=>candidate.id===rfq.ownCandidateId)??null:null;
  return <ProjectSectionCard>
    <ProjectSectionHeader title="Supplier quotations" subtitle={rfq
      ? `${rfq.status === "open" && deadlinePassed ? "closed" : rfq.status} · deadline ${new Date(rfq.deadline).toLocaleString()}`
      : "Invite several candidates without committing them to the seller chain"} />
    <ProjectSectionBody className="space-y-3">

    {!rfq && canManage ? <div className="space-y-3">
      {options.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{options.map((option) =>
        <label key={option.id} className="flex items-center gap-2 rounded border p-2 text-sm">
          <input type="checkbox" checked={selected.includes(option.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id))} />
          {option.name}
        </label>)}</div> : <p className="text-sm text-muted-foreground">No eligible suppliers or downstream traders are available.</p>}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Quotation deadline"><Input type="datetime-local" min={earliestDeadlineValue()} value={deadline} onChange={(event) => setDeadline(event.target.value)} /></Field>
        <Button disabled={pending || selected.length < 2 || !deadline} onClick={requestQuotations}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Request quotations ({selected.length})
        </Button>
      </div>
    </div> : null}

    {rfq?.canManage ? <div className="space-y-2">{rfq.candidates.map((candidate) =>
      <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
        <div><p className="font-medium">{candidate.organisationName}</p>
          <p className="text-sm capitalize text-muted-foreground">{candidate.status.replace("_", " ")}{candidate.quoteTotalCents != null ? ` · ${formatCents(candidate.quoteTotalCents, currency)}` : ""}</p>
          {candidate.quoteNotes ? <p className="text-sm">{candidate.quoteNotes}</p> : null}
          {candidate.submitterName ? <p className="text-xs text-muted-foreground">Submitted by {candidate.submitterName}</p> : null}
        </div>
        <div className="flex gap-2">{candidate.quoteEntries.length?<Button variant="outline" size="sm" onClick={()=>setViewCandidateId(candidate.id)}>View quotation</Button>:null}{canEnterCandidateQuotation?<Button variant="outline" size="sm" onClick={()=>{setAdminCandidateId(candidate.id);setViewCandidateId(null);setPrices(pricesFromEntries(candidate.quoteEntries));setNotes(candidate.quoteNotes??"")}}>{candidate.quoteEntries.length?"Edit quotation":"Enter quotation"}</Button>:null}{rfq.status === "open" && candidate.status === "submitted" ? <Button size="sm" onClick={() => setAwardTarget(candidate)}>Award</Button> : null}</div>
      </div>)}
      <div className="flex justify-end gap-2">
        {rfq.status === "open" ? <Button variant="outline" size="sm" onClick={() => setConfirmCancel(true)}>Close request</Button> : null}
        {rfq.status !== "open" ? <Button variant="outline" size="sm" onClick={startNewRound}>Start new round</Button> : null}
      </div>
    </div> : null}

    {rfq?.canManage && rfq.status === "awarded" && rfq.commercialPricing ? <TraderMarginCard
      projectId={projectId}
      currency={currency}
      pricing={rfq.commercialPricing}
      onSaved={(commercialPricing) => setRfq((current) => current ? { ...current, commercialPricing } : current)}
    /> : null}

    {viewedCandidate?<QuotationDetail candidate={viewedCandidate} currency={currency} onClose={()=>setViewCandidateId(null)}/>:null}
    {!rfq?.canManage&&rfq?.ownCandidateId&&rfq.status!=="open"&&ownReadOnlyCandidate?<QuotationDetail candidate={ownReadOnlyCandidate} currency={currency}/>:null}
    {(rfq?.ownCandidateId&&!rfq.canManage&&rfq.status==="open"||rfq?.canManage&&adminCandidateId) ? !rfq.canManage&&deadlinePassed
      ? <p className="text-sm text-muted-foreground">The quotation deadline has passed.</p>
      : <QuotationEntryForm lines={lines} currency={currency} prices={prices} setPrices={setPrices} notes={notes} setNotes={setNotes} pending={pending} onSubmit={submitQuotation} onCancel={rfq.canManage?()=>setAdminCandidateId(null):undefined}/>
      : null}

    <AlertDialog open={awardTarget !== null} onOpenChange={(open) => !open && !pending && setAwardTarget(null)}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Award quotation to {awardTarget?.organisationName}?</AlertDialogTitle>
        <AlertDialogDescription>This assigns the winner to this same leg. Other candidates remain in sourcing history as not awarded.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction disabled={pending} onClick={confirmAward}>Award and assign seller</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={confirmCancel} onOpenChange={(open) => !open && !pending && setConfirmCancel(false)}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Close this quotation request?</AlertDialogTitle>
        <AlertDialogDescription>Candidates will lose access and no further quotations can be submitted. You can start a new round afterward.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Keep open</AlertDialogCancel>
        <AlertDialogAction disabled={pending} onClick={cancelRequest}>Close request</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    </ProjectSectionBody>
  </ProjectSectionCard>;
}

function earliestDeadlineValue(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function formatCents(cents: number, currency: string): string { return `${(cents / 100).toFixed(2)} ${currency}`; }
function TraderMarginCard({projectId,currency,pricing,onSaved}:{projectId:string;currency:string;pricing:ProjectCommercialPricing;onSaved:(pricing:ProjectCommercialPricing)=>void}){
  const [mode,setMode]=useState<ProjectMarginMode>(pricing.marginAmountCents==null?"percentage":"amount");
  const marginModeName=useId();
  const [value,setValue]=useState(pricing.marginAmountCents==null?(pricing.marginPercent==null?"":String(pricing.marginPercent)):(pricing.marginAmountCents/100).toFixed(2));
  const [saving,startSaving]=useTransition();
  useEffect(()=>{setValue(mode==="percentage"?(pricing.marginPercent==null?"":String(pricing.marginPercent)):(pricing.marginAmountCents==null?"":(pricing.marginAmountCents/100).toFixed(2)))},[mode,pricing.marginAmountCents,pricing.marginPercent]);
  const numericValue=Number(value);
  let calculation:ReturnType<typeof calculateProjectMargin>|null=null;
  try{if(value!=="")calculation=calculateProjectMargin(pricing.purchaseCostCents,mode,mode==="amount"?Math.round(numericValue*100):numericValue)}catch{calculation=null}
  const save=()=>{if(!calculation)return;startSaving(async()=>{const result=await saveProjectAwardedMargin({projectId,mode,value:numericValue});if(!result.success){toast.error(result.error);return}onSaved(result.data);toast.success("Trader margin saved")})};
  return <div className="space-y-3 rounded-md border bg-muted/20 p-3">
    <div><p className="font-medium">Trader margin</p><p className="text-sm text-muted-foreground">Purchase cost: {formatCents(pricing.purchaseCostCents,currency)}</p></div>
    <fieldset className="flex flex-wrap gap-2"><legend className="sr-only">Trader margin entry mode</legend><label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted"><input className="h-4 w-4 accent-primary" type="radio" name={marginModeName} value="percentage" checked={mode==="percentage"} onChange={()=>setMode("percentage")}/>Percentage</label><label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted"><input className="h-4 w-4 accent-primary" type="radio" name={marginModeName} value="amount" checked={mode==="amount"} onChange={()=>setMode("amount")}/>Amount</label></fieldset>
    <div className="grid gap-3 sm:grid-cols-[minmax(180px,1fr)_auto_auto_auto] sm:items-end">
      <Field label={mode==="percentage"?"Gross margin (%)":`Margin amount (${currency})`}><Input aria-label={mode==="percentage"?"Gross margin percentage":"Margin amount"} type="number" min="0" max={mode==="percentage"?"99.99":undefined} step={mode==="percentage"?"0.01":"0.01"} value={value} onChange={(event)=>setValue(event.target.value)}/></Field>
      <p className="pb-2 text-sm"><span className="text-muted-foreground">Margin</span><br/><strong>{calculation?formatCents(calculation.marginAmountCents,currency):"—"}</strong>{calculation?` (${calculation.marginPercent.toFixed(2)}%)`:""}</p>
      <p className="pb-2 text-sm"><span className="text-muted-foreground">Sales amount</span><br/><strong>{calculation?formatCents(calculation.salesAmountCents,currency):"—"}</strong></p>
      <Button type="button" disabled={saving||!calculation} onClick={save}>{saving?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}Save margin</Button>
    </div>
  </div>
}
type PricingRow={key:string;targetType:"line"|"process";targetId:string;label:string;quantity:number;unit:string};
function pricesFromEntries(entries:ProjectRfqCandidate["quoteEntries"]):Record<string,string>{return Object.fromEntries(entries.map((entry)=>[`${entry.targetType}:${entry.targetId}`,(entry.unitPriceCents/100).toFixed(2)]))}
function pricingRows(lines:ProjectLine[]):PricingRow[]{return lines.flatMap((line)=>{if(!line.id)return[];const quantity=Number(line.volumeM3??line.pieces??0);const material=quantity>0?[{key:`line:${line.id}`,targetType:"line" as const,targetId:line.id,label:line.productName??`Line ${line.lineNo}`,quantity,unit:line.unit}]:[];const processes=(line.processRequirements??[]).flatMap((process)=>{const processQuantity=Number(process.value);return process.active&&processQuantity>0?[{key:`process:${process.id}`,targetType:"process" as const,targetId:process.id,label:`${line.productName??`Line ${line.lineNo}`} · ${process.name}`,quantity:processQuantity,unit:process.unit??"unit"}]:[]});return[...material,...processes]})}
function QuotationDetail({candidate,currency,onClose}:{candidate:ProjectRfqCandidate;currency:string;onClose?:()=>void}){return <div className="space-y-3 rounded-md border p-3"><div className="flex items-start justify-between"><div><p className="font-medium">{candidate.organisationName} quotation</p><p className="text-xs text-muted-foreground">{candidate.submittedAt?`Submitted ${new Date(candidate.submittedAt).toLocaleString()}`:"Not submitted"}{candidate.updatedAt?` · updated ${new Date(candidate.updatedAt).toLocaleString()}`:""}{candidate.quoteEnteredAsAdmin?" · corrected by admin":""}</p></div>{onClose?<Button size="sm" variant="ghost" onClick={onClose}>Close</Button>:null}</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Requirement</th><th className="p-2 text-right">Quantity</th><th className="p-2">Unit</th><th className="p-2 text-right">Unit price</th><th className="p-2 text-right">Subtotal</th></tr></thead><tbody>{candidate.quoteEntries.map((entry)=><tr key={`${entry.targetType}:${entry.targetId}`} className="border-b last:border-0"><td className="p-2">{entry.label}</td><td className="p-2 text-right">{entry.quantity}</td><td className="p-2">{entry.unit}</td><td className="p-2 text-right">{formatCents(entry.unitPriceCents,currency)}</td><td className="p-2 text-right">{formatCents(Math.round(entry.quantity*entry.unitPriceCents),currency)}</td></tr>)}</tbody></table></div><p className="text-right font-semibold">Total: {formatCents(candidate.quoteTotalCents??0,currency)}</p>{candidate.quoteNotes?<p className="text-sm">{candidate.quoteNotes}</p>:null}{candidate.status==="awarded"?<p className="text-xs text-muted-foreground">Awarded quotation is locked for the supplier.</p>:null}</div>}
function QuotationEntryForm({lines,currency,prices,setPrices,notes,setNotes,pending,onSubmit,onCancel}:{lines:ProjectLine[];currency:string;prices:Record<string,string>;setPrices:React.Dispatch<React.SetStateAction<Record<string,string>>>;notes:string;setNotes:(value:string)=>void;pending:boolean;onSubmit:()=>void;onCancel?:()=>void}){const rows=pricingRows(lines);const rowCents=(row:PricingRow)=>Math.round(Number(prices[row.key]||0)*100*row.quantity);const totalCents=rows.reduce((sum,row)=>sum+rowCents(row),0);return <div className="space-y-3 rounded-md border p-3"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Requirement</th><th className="p-2 text-right">Quantity</th><th className="p-2">Unit</th><th className="p-2 text-right">Unit price ({currency})</th><th className="p-2 text-right">Total</th></tr></thead><tbody>{rows.map((row)=><tr key={row.key} className="border-b last:border-0"><td className="p-2">{row.label}</td><td className="p-2 text-right">{row.quantity}</td><td className="p-2">{row.unit}</td><td className="p-2"><Input aria-label={`Unit price for ${row.label}`} className="ml-auto w-32 text-right" type="number" min="0" step="0.01" value={prices[row.key]??""} onChange={(event)=>setPrices((current)=>({...current,[row.key]:event.target.value}))}/></td><td className="p-2 text-right">{(rowCents(row)/100).toFixed(2)}</td></tr>)}</tbody></table></div><div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"><Field label="Notes and exceptions"><Input value={notes} onChange={(event)=>setNotes(event.target.value)}/></Field><p className="pb-2 font-semibold">Total: {(totalCents/100).toFixed(2)} {currency}</p><div className="flex gap-2">{onCancel?<Button variant="outline" onClick={onCancel}>Cancel</Button>:null}<Button disabled={pending||rows.length===0||Object.keys(prices).length===0} onClick={onSubmit}>{pending?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}Submit quotation</Button></div></div></div>}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>; }
