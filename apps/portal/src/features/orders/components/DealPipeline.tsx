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
import { StageBadge } from "./StageBadge";

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
 * Deal lifecycle STAGE RAIL (E3): the horizontal rail of the 5 milestones with the
 * current stage highlighted, plus the guarded Cancel action. Kept in the wide
 * (center) column because the rail needs the width; the Advance control lives
 * separately in the action column (see {@link DealAdvanceControl}).
 */
export function DealStageRail({
  orderId, lifecycleStage, onChanged,
}: {
  orderId: string;
  lifecycleStage: string;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancelled = lifecycleStage === CANCELLED_STAGE;
  const currentRank = LIFECYCLE_RANK[lifecycleStage] ?? -1;
  const canCancel = isCancellableStage(lifecycleStage);

  const onCancel = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await cancelDealAction(orderId);
    setBusy(false);
    setConfirmCancel(false);
    if (!res.success) { setError(res.error); return; }
    await onChanged();
  }, [orderId, onChanged]);

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
                <StageBadge stage={stage} className="ring-2 ring-foreground/40 ring-offset-1" />
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
            <StageBadge stage="cancelled" className="gap-1"><XCircle className="ml-1 h-3 w-3" /></StageBadge>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

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

/**
 * The "Advance to next milestone" control — surfaces the next stage, whether its
 * gate is satisfied, and the unmet blocks (with inline sign-off / acceptance).
 * Laid out VERTICALLY (label above the button) so it fits the narrow action
 * column. Renders nothing when there is nowhere to advance (cancelled / final).
 */
export function DealAdvanceControl({
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

  const nextStage = evaluation?.nextStage ?? null;
  const satisfied = evaluation?.satisfied ?? false;
  const unmet = evaluation?.unmet ?? [];
  const canAdvance = !cancelled && !!nextStage;

  if (!canAdvance) {
    // Nothing to advance to (final stage / cancelled) — surface any error only.
    return error ? <p className="text-sm text-destructive">{error}</p> : null;
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* Label above the button (vertical) */}
      <div className="space-y-2">
        <div className="text-sm">
          <div>
            <span className="text-muted-foreground">Next milestone: </span>
            <span className="font-medium">{stageLabel(nextStage)}</span>
          </div>
          {loadingEval ? (
            <span className="text-xs text-muted-foreground">checking gate…</span>
          ) : satisfied ? (
            <span className="text-xs text-green-600">gate satisfied</span>
          ) : (
            <span className="text-xs text-amber-600">{unmet.length} requirement{unmet.length === 1 ? "" : "s"} outstanding</span>
          )}
        </div>
        <Button className="w-full" size="sm" onClick={onAdvance} disabled={busy || loadingEval || !satisfied}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Advance to {stageLabel(nextStage)}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loadingEval && !satisfied && unmet.length > 0 && (
        <ul className="space-y-1.5">
          {unmet.map((block, idx) => {
            const target = confirmTargetOf(block);
            return (
              <li key={idx} className="space-y-1.5 rounded-md border bg-muted/30 px-3 py-2">
                <span className="block text-sm">
                  <span className="text-amber-600 mr-1.5">•</span>
                  {describeBlock(block)}
                </span>
                {target ? (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => onConfirm(target.blockType, target.blockKey)} disabled={busy}>
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
  );
}
