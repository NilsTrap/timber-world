"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, Check, XCircle, ArrowRight } from "lucide-react";
import {
  Button, StatusBadge, SectionHeader,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@timber/ui";
import {
  LIFECYCLE_STAGES, CANCELLED_STAGE, LIFECYCLE_RANK, describeBlock, isCancellableStage,
  type GateBlock, type AdvanceEvaluation,
} from "../services/lifecycle";
import { advanceDealAction, cancelDealAction, evaluateAdvanceAction, recordGateConfirmationAction } from "../actions/lifecycleActions";

const STAGE_LABELS: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  produced: "Produced",
  loaded: "Loaded",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function stageLabel(stage: string | null): string {
  if (!stage) return "—";
  return STAGE_LABELS[stage] ?? stage;
}

/** A confirmation-backed unmet block gets a one-click "Confirm" button. */
function confirmTargetOf(block: GateBlock): { blockType: "party_signoff" | "acceptance"; blockKey: string; label: string } | null {
  if (block.type === "party_signoff") return { blockType: "party_signoff", blockKey: block.party, label: `Record ${block.party} sign-off` };
  if (block.type === "acceptance") return { blockType: "acceptance", blockKey: "acceptance", label: "Record buyer acceptance" };
  return null; // condition blocks (payment / document) are satisfied elsewhere, not confirmed here
}

/**
 * Deal lifecycle pipeline (E3): a horizontal rail of the 5 milestones with the
 * current stage highlighted, an Advance control that surfaces unmet gate blocks
 * (and lets a party sign-off / acceptance be recorded inline), and a guarded
 * Cancel action.
 */
export function DealPipeline({
  orderId, lifecycleStage, onChanged,
}: {
  orderId: string;
  lifecycleStage: string;
  onChanged: () => Promise<void> | void;
}) {
  const [evaluation, setEvaluation] = useState<AdvanceEvaluation | null>(null);
  const [loadingEval, setLoadingEval] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancelled = lifecycleStage === CANCELLED_STAGE;

  const evaluate = useCallback(async () => {
    setLoadingEval(true);
    const res = await evaluateAdvanceAction(orderId);
    if (res.success) { setEvaluation(res.data); setError(null); }
    else setError(res.error);
    setLoadingEval(false);
  }, [orderId]);

  useEffect(() => { evaluate(); }, [evaluate, lifecycleStage]);

  const onAdvance = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await advanceDealAction(orderId);
    setBusy(false);
    if (!res.success) { setError(res.error); await evaluate(); return; }
    await onChanged();
  }, [orderId, onChanged, evaluate]);

  const onConfirm = useCallback(async (blockType: "party_signoff" | "acceptance", blockKey: string) => {
    if (!evaluation) return;
    setBusy(true);
    setError(null);
    const res = await recordGateConfirmationAction(orderId, evaluation.currentStage, blockType, blockKey);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    await evaluate();
  }, [orderId, evaluation, evaluate]);

  const onCancel = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await cancelDealAction(orderId);
    setBusy(false);
    setConfirmCancel(false);
    if (!res.success) { setError(res.error); return; }
    await onChanged();
  }, [orderId, onChanged]);

  const currentRank = LIFECYCLE_RANK[lifecycleStage] ?? -1;
  const nextStage = evaluation?.nextStage ?? null;
  const satisfied = evaluation?.satisfied ?? false;
  const unmet = evaluation?.unmet ?? [];
  const canAdvance = !cancelled && !!nextStage;
  const canCancel = isCancellableStage(lifecycleStage);

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Deal pipeline"
        subtitle={cancelled ? "This deal is cancelled." : `Current stage: ${stageLabel(lifecycleStage)}`}
        action={
          canCancel ? (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmCancel(true)} disabled={busy}>
              <XCircle className="h-3.5 w-3.5" /> Cancel deal
            </Button>
          ) : undefined
        }
      />

      {/* Stage rail */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card p-3">
        {LIFECYCLE_STAGES.map((stage, i) => {
          const rank = LIFECYCLE_RANK[stage] ?? 0;
          const isCurrent = !cancelled && stage === lifecycleStage;
          const isDone = !cancelled && currentRank > rank;
          return (
            <div key={stage} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
              {isDone ? (
                <StatusBadge variant="success"><span className="inline-flex items-center gap-1"><Check className="h-3 w-3" />{stageLabel(stage)}</span></StatusBadge>
              ) : isCurrent ? (
                <StatusBadge variant="info" className="ring-2 ring-blue-400 ring-offset-1">{stageLabel(stage)}</StatusBadge>
              ) : (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cancelled ? "bg-gray-100 text-gray-400 line-through" : "bg-gray-100 text-gray-500"}`}>
                  {stageLabel(stage)}
                </span>
              )}
            </div>
          );
        })}
        {cancelled && (
          <div className="flex items-center gap-1.5">
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            <StatusBadge variant="error"><span className="inline-flex items-center gap-1"><XCircle className="h-3 w-3" />Cancelled</span></StatusBadge>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Advance control + gate state */}
      {canAdvance && (
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Next milestone: </span>
              <span className="font-medium">{stageLabel(nextStage)}</span>
              {loadingEval ? (
                <span className="ml-2 text-xs text-muted-foreground">checking gate…</span>
              ) : satisfied ? (
                <span className="ml-2 text-xs text-green-600">gate satisfied</span>
              ) : (
                <span className="ml-2 text-xs text-amber-600">{unmet.length} requirement{unmet.length === 1 ? "" : "s"} outstanding</span>
              )}
            </div>
            <Button size="sm" onClick={onAdvance} disabled={busy || loadingEval || !satisfied}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Advance to {stageLabel(nextStage)}
            </Button>
          </div>

          {!loadingEval && !satisfied && unmet.length > 0 && (
            <ul className="space-y-1.5">
              {unmet.map((block, idx) => {
                const target = confirmTargetOf(block);
                return (
                  <li key={idx} className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-1.5">
                    <span className="text-sm">
                      <span className="text-amber-600 mr-1.5">•</span>
                      {describeBlock(block)}
                    </span>
                    {target ? (
                      <Button variant="outline" size="sm" onClick={() => onConfirm(target.blockType, target.blockKey)} disabled={busy}>
                        <Check className="h-3.5 w-3.5" /> {target.label}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">satisfied outside this panel</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Cancel confirm (no window.confirm — inline dialog) */}
      <AlertDialog open={confirmCancel} onOpenChange={(o) => { if (!o) setConfirmCancel(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this deal?</AlertDialogTitle>
            <AlertDialogDescription>
              The deal moves to <strong>Cancelled</strong>. If it is still active (up to Loaded), its spine and any
              downstream deals it was sourcing are flagged as chain-broken. This cannot be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep deal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); onCancel(); }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel deal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
