"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button, Input, Label, SectionHeader,
} from "@timber/ui";
import {
  awardProjectQuotation, cancelProjectQuotationRequest, getEligibleProjectRfqCandidates, getProjectRfqState,
  requestProjectQuotations, submitProjectQuotation,
  type ProjectRfqCandidate, type ProjectRfqState,
} from "../actions/projectRfqActions";

export function ProjectRfqCard({ projectId, currency, canManage, initialOptions }: {
  projectId: string; currency: string; canManage: boolean; initialOptions: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rfq, setRfq] = useState<ProjectRfqState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>(initialOptions);
  const [selected, setSelected] = useState<string[]>([]);
  const [deadline, setDeadline] = useState(earliestDeadlineValue());
  const [total, setTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [awardTarget, setAwardTarget] = useState<ProjectRfqCandidate | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const loadOptions = useCallback(async () => {
    const choices = await getEligibleProjectRfqCandidates(projectId);
    if (choices.success) setOptions(choices.data);
    else toast.error(choices.error);
  }, [projectId]);

  const load = useCallback(async () => {
    const result = await getProjectRfqState(projectId);
    if (!result.success) { toast.error(result.error); setLoaded(true); return; }
    setRfq(result.data);
    const ownCandidate = result.data?.candidates.find((candidate) => candidate.id === result.data?.ownCandidateId);
    if (ownCandidate?.quoteTotalCents != null) setTotal((ownCandidate.quoteTotalCents / 100).toFixed(2));
    if (ownCandidate?.quoteNotes) setNotes(ownCandidate.quoteNotes);
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
      await load();
    });
  }

  function submitQuotation() {
    if (!rfq?.ownCandidateId) return;
    startTransition(async () => {
      const result = await submitProjectQuotation({ candidateId: rfq.ownCandidateId, total, notes });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Quotation submitted");
      await load();
    });
  }

  function confirmAward() {
    if (!rfq || !awardTarget) return;
    startTransition(async () => {
      const result = await awardProjectQuotation({ projectId, rfqId: rfq.id, candidateId: awardTarget.id });
      if (!result.success) { toast.error(result.error); return; }
      setAwardTarget(null);
      toast.success("Quotation awarded and seller leg created");
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
    setSelected([]);
    setDeadline(earliestDeadlineValue());
    void loadOptions();
  }

  if (!loaded) return <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading quotation requests…</div>;
  const deadlinePassed = Boolean(rfq && new Date(rfq.deadline).getTime() <= Date.now());

  return <div className="space-y-3 rounded-lg border bg-card p-4">
    <SectionHeader title="Supplier quotations" subtitle={rfq
      ? `${rfq.status === "open" && deadlinePassed ? "closed" : rfq.status} · deadline ${new Date(rfq.deadline).toLocaleString()}`
      : "Invite several candidates without committing them to the seller chain"} />

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
        </div>
        {rfq.status === "open" && candidate.status === "submitted" ? <Button size="sm" onClick={() => setAwardTarget(candidate)}>Award</Button> : null}
      </div>)}
      <div className="flex justify-end gap-2">
        {rfq.status === "open" ? <Button variant="outline" size="sm" onClick={() => setConfirmCancel(true)}>Close request</Button> : null}
        {rfq.status !== "open" ? <Button variant="outline" size="sm" onClick={startNewRound}>Start new round</Button> : null}
      </div>
    </div> : null}

    {rfq?.ownCandidateId && !rfq.canManage && rfq.status === "open" ? deadlinePassed
      ? <p className="text-sm text-muted-foreground">The quotation deadline has passed.</p>
      : <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <Field label={`Total quotation (${currency})`}><Input type="number" min="0" step="0.01" value={total} onChange={(event) => setTotal(event.target.value)} /></Field>
          <Field label="Notes and exceptions"><Input value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
          <Button disabled={pending || total.trim() === ""} onClick={submitQuotation}>{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Submit quotation</Button>
        </div>
      : null}

    <AlertDialog open={awardTarget !== null} onOpenChange={(open) => !open && !pending && setAwardTarget(null)}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Award quotation to {awardTarget?.organisationName}?</AlertDialogTitle>
        <AlertDialogDescription>This creates the committed seller leg. Other candidates remain in sourcing history as not awarded.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction disabled={pending} onClick={confirmAward}>Award and create seller leg</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={confirmCancel} onOpenChange={(open) => !open && !pending && setConfirmCancel(false)}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Close this quotation request?</AlertDialogTitle>
        <AlertDialogDescription>Candidates will lose access and no further quotations can be submitted. You can start a new round afterward.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Keep open</AlertDialogCancel>
        <AlertDialogAction disabled={pending} onClick={cancelRequest}>Close request</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}

function earliestDeadlineValue(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function formatCents(cents: number, currency: string): string { return `${(cents / 100).toFixed(2)} ${currency}`; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>; }
