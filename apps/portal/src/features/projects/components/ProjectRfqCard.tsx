"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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
  correctProjectQuotation, initializeDirectProjectQuotation, requestProjectQuotations, submitProjectQuotation,
  type ProjectRfqCandidate, type ProjectRfqState,
} from "../actions/projectRfqActions";
import { pricesFromQuotation, quotationEntries, quotationEntryAmountCents, quotationPricingRows, quotationTotalCents } from "../services/projectQuotationRows";
import type { ProjectLine } from "../types";
import { ProjectSectionBody, ProjectSectionCard, ProjectSectionHeader } from "./ProjectSectionCard";
import { useProjectQuotationEditing } from "./ProjectQuotationEditingContext";

export function ProjectRfqCard({ projectId, currency, canManage, canEnterCandidateQuotation, canInitializeOwnQuotation, sellerOrganisationId, sellerOrganisationName, initialOptions, lines }: {
  projectId: string; currency: string; canManage: boolean; canEnterCandidateQuotation:boolean; canInitializeOwnQuotation:boolean; sellerOrganisationId:string|null; sellerOrganisationName:string|null; initialOptions: Array<{ id: string; name: string }>; lines:ProjectLine[];
}) {
  const router = useRouter();
  const sharedQuotation = useProjectQuotationEditing();
  const [pending, startTransition] = useTransition();
  const [rfq, setRfq] = useState<ProjectRfqState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>(initialOptions);
  const [selected, setSelected] = useState<string[]>([]);
  const [deadline, setDeadline] = useState(earliestDeadlineValue());
  const [notes, setNotes] = useState("");
  const [awardTarget, setAwardTarget] = useState<ProjectRfqCandidate | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [adminCandidateId,setAdminCandidateId]=useState<string|null>(null);
  const [viewCandidateId,setViewCandidateId]=useState<string|null>(null);
  const prices = sharedQuotation.prices;
  const pricingMode = sharedQuotation.mode;
  const setPrices = sharedQuotation.setPrices;
  const setPricingMode = sharedQuotation.setMode;
  const projectTotal = sharedQuotation.projectTotal;
  const setProjectTotal = sharedQuotation.setProjectTotal;
  const busy = pending || sharedQuotation.inlinePending;

  const loadOptions = useCallback(async () => {
    const choices = await getEligibleProjectRfqCandidates(projectId);
    if (choices.success) setOptions(choices.data);
    else toast.error(choices.error);
  }, [projectId]);

  const load = useCallback(async () => {
    const result = await getProjectRfqState(projectId);
    if (!result.success) { toast.error(result.error); setLoadFailed(true); setLoaded(true); return; }
    setLoadFailed(false);
    setRfq(result.data);
    setAdminCandidateId((current)=>current&&result.data?.candidates.some((candidate)=>candidate.id===current)?current:null);
    setViewCandidateId((current)=>current&&result.data?.candidates.some((candidate)=>candidate.id===current)?current:null);
    const ownCandidate = result.data?.candidates.find((candidate) => candidate.id === result.data?.ownCandidateId);
    if (ownCandidate) {setNotes(ownCandidate.quoteNotes??"");setPrices(pricesFromQuotation(ownCandidate.quoteEntries,ownCandidate.pricingMode));setPricingMode(ownCandidate.pricingMode==="total"?"total":"itemized_total");setProjectTotal(ownCandidate.pricingMode==="total"&&ownCandidate.quoteTotalCents!=null?(ownCandidate.quoteTotalCents/100).toFixed(2):"");}
    setLoaded(true);
    if (!result.data && canManage) {
      await loadOptions();
    }
  }, [canManage, loadOptions, projectId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const refresh = (event: Event) => { if ((event as CustomEvent<{projectId?:string}>).detail?.projectId === projectId) void load(); }; window.addEventListener("project-quotation-updated", refresh); return () => window.removeEventListener("project-quotation-updated", refresh); }, [load, projectId]);
  useEffect(() => {
    const candidateId = rfq?.canManage ? adminCandidateId : rfq?.ownCandidateId ?? null;
    const activeCandidate = candidateId ? rfq?.candidates.find((candidate) => candidate.id === candidateId) ?? null : null;
    sharedQuotation.setControlState({ candidateId, activeCandidate, pending, canManage: rfq?.canManage === true });
  }, [adminCandidateId, pending, rfq?.canManage, rfq?.candidates, rfq?.ownCandidateId, sharedQuotation.setControlState]);

  function requestQuotations() {
    startTransition(async () => {
      const result = await requestProjectQuotations({ projectId, candidateIds: selected, deadline: new Date(deadline).toISOString() });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Quotation requests created");
      router.refresh();
      await load();
    });
  }

  function createOwnQuotation() {
    startTransition(async () => {
      const result = await initializeDirectProjectQuotation({ projectId });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Quotation created");
      router.refresh();
      await load();
    });
  }

  function submitQuotation() {
    const candidateId=rfq?.canManage?adminCandidateId:rfq?.ownCandidateId;if(!candidateId)return;
    if(!pricingMode)return;
    const entries=pricingMode!=="total"?quotationEntries(lines,prices):[];
    const totalCents=pricingMode==="total"?quotationTotalCents(projectTotal):null;
    startTransition(async () => {
      const payload={candidateId,pricingMode:pricingMode==="total"?"total" as const:"itemized_total" as const,entries,totalCents,notes};
      const result = rfq?.canManage ? await correctProjectQuotation(payload) : await submitProjectQuotation(payload);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Quotation submitted");setAdminCandidateId(null);setPrices({});setPricingMode(null);setProjectTotal("");
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
    setPricingMode(null);setProjectTotal("");
    setNotes("");
    setSelected([]);
    setDeadline(earliestDeadlineValue());
    void loadOptions();
  }

  if (!loaded) return <ProjectSectionCard><ProjectSectionHeader title="Supplier quotations" subtitle="Loading quotation requests…" /></ProjectSectionCard>;
  if (loadFailed) return <ProjectSectionCard><ProjectSectionHeader title="Supplier quotations" subtitle="Quotation details could not be loaded" /></ProjectSectionCard>;
  if (!rfq && !canManage && !canInitializeOwnQuotation) return null;
  const deadlinePassed = Boolean(rfq && new Date(rfq.deadline).getTime() <= Date.now());

  const viewedCandidate=viewCandidateId?rfq?.candidates.find((candidate)=>candidate.id===viewCandidateId)??null:null;
  const ownReadOnlyCandidate=rfq?.ownCandidateId?rfq.candidates.find((candidate)=>candidate.id===rfq.ownCandidateId)??null:null;
  return <ProjectSectionCard>
    <ProjectSectionHeader title="Supplier quotations" subtitle={rfq
      ? `${rfq.status === "open" && deadlinePassed ? "closed" : rfq.status} · deadline ${new Date(rfq.deadline).toLocaleString()}`
      : canInitializeOwnQuotation && !canManage
        ? "Create and submit your quotation for this project"
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

    {!rfq && !canManage && canInitializeOwnQuotation ? <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">Create your supplier quotation and choose how its processes are priced.</p>
      <Button disabled={pending} onClick={createOwnQuotation}>{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create quotation</Button>
    </div> : null}

    {rfq?.canManage ? <div className="space-y-2">{rfq.candidates.map((candidate) =>
      <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
        <div><p className="font-medium">{candidate.organisationName}</p>
          <p className="text-sm capitalize text-muted-foreground">{candidate.status.replace("_", " ")}{candidate.quoteTotalCents != null ? ` · ${formatCents(candidate.quoteTotalCents, currency)}` : ""}</p>
          {candidate.quoteNotes ? <p className="text-sm">{candidate.quoteNotes}</p> : null}
          {candidate.submitterName ? <p className="text-xs text-muted-foreground">Submitted by {candidate.submitterName}</p> : null}
        </div>
        <div className="flex gap-2">{candidate.pricingMode||candidate.quoteTotalCents!=null||candidate.quoteEntries.length?<Button disabled={busy} variant="outline" size="sm" onClick={()=>setViewCandidateId(candidate.id)}>View quotation</Button>:null}{canEnterCandidateQuotation?<Button disabled={busy} variant="outline" size="sm" onClick={()=>{setAdminCandidateId(candidate.id);setViewCandidateId(null);setPrices(pricesFromQuotation(candidate.quoteEntries,candidate.pricingMode));setPricingMode(candidate.pricingMode==="total"?"total":"itemized_total");setProjectTotal(candidate.pricingMode==="total"&&candidate.quoteTotalCents!=null?(candidate.quoteTotalCents/100).toFixed(2):"");setNotes(candidate.quoteNotes??"")}}>{candidate.pricingMode||candidate.quoteTotalCents!=null||candidate.quoteEntries.length?"Edit quotation":"Enter quotation"}</Button>:null}{rfq.status === "open" && candidate.status === "submitted" ? <Button disabled={busy} size="sm" onClick={() => setAwardTarget(candidate)}>Award</Button> : null}</div>
      </div>)}
      <div className="flex justify-end gap-2">
        {rfq.status === "open" ? <Button variant="outline" size="sm" onClick={() => setConfirmCancel(true)}>Close request</Button> : null}
        {rfq.status !== "open" ? <Button variant="outline" size="sm" onClick={startNewRound}>Start new round</Button> : null}
      </div>
    </div> : null}

    {canManage && sellerOrganisationId && !rfq?.candidates.some((candidate) => candidate.organisationId === sellerOrganisationId) ? <div className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"><p className="text-sm text-muted-foreground">No quotation exists yet for {sellerOrganisationName ?? "the assigned seller"}.</p><Button size="sm" disabled={busy} onClick={createOwnQuotation}>Create supplier quotation</Button></div> : null}

    {viewedCandidate?<QuotationDetail candidate={viewedCandidate} currency={currency} onClose={()=>setViewCandidateId(null)}/>:null}
    {!rfq?.canManage&&rfq?.ownCandidateId&&rfq.status!=="open"&&ownReadOnlyCandidate?<QuotationDetail candidate={ownReadOnlyCandidate} currency={currency}/>:null}
    {(rfq?.ownCandidateId&&!rfq.canManage&&rfq.status==="open"||rfq?.canManage&&adminCandidateId) ? !rfq.canManage&&deadlinePassed
      ? <p className="text-sm text-muted-foreground">The quotation deadline has passed.</p>
      : <QuotationEntryForm lines={lines} currency={currency} projectTotal={projectTotal} prices={prices} notes={notes} setNotes={setNotes} pending={busy} inlineStatus={sharedQuotation.inlinePending?"saving":sharedQuotation.inlineStatus} onSubmit={submitQuotation} onCancel={rfq.canManage?()=>setAdminCandidateId(null):undefined}/>
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
function QuotationDetail({candidate,currency,onClose}:{candidate:ProjectRfqCandidate;currency:string;onClose?:()=>void}) {
  const showEntries=candidate.pricingMode!=="total"&&(candidate.pricingMode!==null||candidate.quoteEntries.length>0);
  const totalsMode=candidate.pricingMode==="itemized_total";
  const modeLabel=candidate.pricingMode==="total"?"One total for all processes":totalsMode?"Total for each process":candidate.pricingMode==="itemized"?"Unit price for each process":"Legacy quotation — pricing mode not recorded";
  return <div className="space-y-3 rounded-md border p-3"><div className="flex items-start justify-between"><div><p className="font-medium">{candidate.organisationName} quotation</p><p className="text-xs text-muted-foreground">{modeLabel}{candidate.submittedAt?` · Submitted ${new Date(candidate.submittedAt).toLocaleString()}`:" · Not submitted"}{candidate.updatedAt?` · updated ${new Date(candidate.updatedAt).toLocaleString()}`:""}{candidate.quoteEnteredAsAdmin?" · corrected by admin":""}</p></div>{onClose?<Button size="sm" variant="ghost" onClick={onClose}>Close</Button>:null}</div>{showEntries?<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Requirement</th><th className="p-2 text-right">Quantity</th><th className="p-2">Unit</th><th className="p-2 text-right">{totalsMode?"Process total":"Unit price"}</th><th className="p-2 text-right">Total</th></tr></thead><tbody>{candidate.quoteEntries.map((entry)=><tr key={`${entry.targetType}:${entry.targetId}`} className="border-b last:border-0"><td className="p-2">{entry.label}</td><td className="p-2 text-right">{entry.quantity}</td><td className="p-2">{entry.unit}</td><td className="p-2 text-right">{formatCents(entry.unitPriceCents,currency)}</td><td className="p-2 text-right">{formatCents(quotationEntryAmountCents(candidate.pricingMode??"itemized",entry.quantity,entry.unitPriceCents),currency)}</td></tr>)}</tbody></table></div>:candidate.pricingMode==="total"?<p className="rounded-md bg-muted p-3 text-sm">Total price for the complete process list</p>:null}<p className="text-right font-semibold">Total: {formatCents(candidate.quoteTotalCents??0,currency)}</p>{candidate.quoteNotes?<p className="text-sm">{candidate.quoteNotes}</p>:null}{candidate.status==="awarded"?<p className="text-xs text-muted-foreground">Awarded quotation is locked for the supplier.</p>:null}</div>;
}

function QuotationEntryForm({lines,currency,projectTotal,prices,notes,setNotes,pending,inlineStatus,onSubmit,onCancel}:{lines:ProjectLine[];currency:string;projectTotal:string;prices:Record<string,string>;notes:string;setNotes:(value:string)=>void;pending:boolean;inlineStatus:"idle"|"saving"|"saved"|"error";onSubmit:()=>void;onCancel?:()=>void}) {
  const rows=quotationPricingRows(lines);const entries=quotationEntries(lines,prices);const totalCents=entries.reduce((sum,entry)=>sum+quotationEntryAmountCents("itemized_total",entry.quantity,entry.unitPriceCents),0);const totalValue=quotationTotalCents(projectTotal);const hasProjectTotal=projectTotal.trim()!=="";
  return <div className="space-y-3 rounded-md border p-3">
    {hasProjectTotal?<p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">Detailed price fields are disabled while a whole-quotation total is entered. Clear the total to edit them.</p>:null}
    <p aria-live="polite" className={`text-xs ${inlineStatus==="error"?"text-destructive":"text-muted-foreground"}`}>{inlineStatus==="saving"?"Saving detailed quotation…":inlineStatus==="saved"?"Detailed quotation saved":inlineStatus==="error"?"Detailed quotation save failed":""}</p>
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"><Field label="Notes and exceptions"><Input disabled={pending} value={notes} onChange={(event)=>setNotes(event.target.value)}/></Field><p className="pb-2 font-semibold">Total: {hasProjectTotal?(totalValue==null?"—":(totalValue/100).toFixed(2)):(totalCents/100).toFixed(2)} {currency}</p><div className="flex gap-2">{onCancel?<Button disabled={pending} variant="outline" onClick={onCancel}>Cancel</Button>:null}<Button disabled={pending||(hasProjectTotal?totalValue===null:rows.length===0||entries.length===0)} onClick={onSubmit}>{pending?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}Submit quotation</Button></div></div>
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>; }
