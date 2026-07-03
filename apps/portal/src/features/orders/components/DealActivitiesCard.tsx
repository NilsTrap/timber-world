"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { StatusBadge } from "@timber/ui";
import {
  ACTIVITY_STAGES,
  STAGE_CAPTIONS,
  activitiesFor,
  CANCELLED_NOTE,
  type ActivityDirection,
} from "../services/dealActivities";
import { CANCELLED_STAGE, LIFECYCLE_RANK } from "../services/lifecycle";

/**
 * C2 · §7 activities guidance — DISPLAY-ONLY.
 *
 * Renders the spec's §7 activities for this deal's direction. The CURRENT stage
 * is expanded and emphasised (C3); the other stages collapse to a one-click
 * disclosure. There is NO persistence and NO checkboxes — §1.3 excludes activity
 * tracking, so nothing here is stored or actionable beyond expand/collapse. It is
 * pure reference text; every capability stays available at every stage (§8.1).
 */
export function DealActivitiesCard({
  stage,
  direction,
}: {
  stage: string;
  direction: ActivityDirection;
}) {
  const stageLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const directionLabel = direction === "sell" ? "sell deal" : "buy deal";

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Activities by stage</h3>
        <span className="text-xs text-muted-foreground">— guidance for this {directionLabel}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        What is typically done at each stage (§7). Reference only — nothing here is a
        required step; every action stays available at any stage.
      </p>
      <ul className="space-y-1.5">
        {ACTIVITY_STAGES.map((s) => (
          <StageRow
            key={s}
            stage={s}
            direction={direction}
            isCurrent={s === stage}
            currentStage={stage}
            stageLabel={stageLabel(s)}
          />
        ))}
      </ul>
    </div>
  );
}

function StageRow({
  stage,
  direction,
  isCurrent,
  currentStage,
  stageLabel,
}: {
  stage: string;
  direction: ActivityDirection;
  isCurrent: boolean;
  currentStage: string;
  stageLabel: string;
}) {
  // Current stage opens by default; the rest collapse. A cancelled deal opens the
  // Cancelled row; otherwise the Cancelled row stays collapsed (it is a terminal
  // note, not a work stage).
  const [open, setOpen] = useState(isCurrent);
  // These rows are keyed by a stable stage string, so an IN-PLACE stage advance
  // (DealAdvanceControl → load()) re-renders without remounting — re-sync the
  // disclosure so the newly-current row opens and the previous one collapses. A
  // manual toggle within a stage persists (isCurrent doesn't change, so no re-fire).
  useEffect(() => { setOpen(isCurrent); }, [isCurrent]);
  const isCancelled = stage === CANCELLED_STAGE;
  const activities = activitiesFor(stage, direction);
  const caption = STAGE_CAPTIONS[stage];

  // Emphasis (C3): the current stage is highlighted; already-passed stages read
  // muted, upcoming stages neutral. Pure visual ordering — zero gating.
  const currentRank = LIFECYCLE_RANK[currentStage];
  const rowRank = LIFECYCLE_RANK[stage];
  const isPast =
    !isCurrent && !isCancelled && currentRank != null && rowRank != null && rowRank < currentRank;

  return (
    <li className={`rounded-md border ${isCurrent ? "border-primary/50 bg-primary/5" : "border-transparent"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
        aria-expanded={open}
      >
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className={`text-sm font-medium ${isPast ? "text-muted-foreground" : ""}`}>{stageLabel}</span>
        {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
        {isCurrent && (
          <StatusBadge variant="info" className="ml-auto">Current</StatusBadge>
        )}
      </button>
      {open && (
        <div className="px-2 pb-2 pl-7">
          {isCancelled ? (
            <p className="text-xs text-muted-foreground">{CANCELLED_NOTE}</p>
          ) : activities.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activities listed for this stage.</p>
          ) : (
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground marker:text-muted-foreground/50">
              {activities.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
