"use client";

import { ArrowLeftRight } from "lucide-react";
import { StatusBadge } from "@timber/ui";
import { STAGE_CAPTIONS } from "../services/dealActivities";

/**
 * C1 · Direction-aware deal header (§2.5).
 *
 * States what the deal is FROM THE VIEWER's standpoint: a house user whose side
 * is the seller sees "Sell deal — facing customer <buyer>"; whose side is the
 * buyer sees "Buy deal — facing supplier <seller>"; a counterparty login sees it
 * from THEIR side (a producer, who is the seller of their leg, sees a Sell deal).
 * Direction + facing party are resolved server-side (getOrderDealView) — the
 * client cannot derive them (it does not know the viewer's org).
 */
export function DealHeader({
  dealCode,
  legacyCode,
  direction,
  facingParty,
  lifecycleStage,
}: {
  dealCode: string | null;
  legacyCode: string | null;
  direction: "sell" | "buy";
  facingParty: { role: "customer" | "supplier"; name: string | null };
  lifecycleStage: string;
}) {
  const title = direction === "sell" ? "Sell deal" : "Buy deal";
  const facingName = facingParty.name ?? "—";
  const caption = STAGE_CAPTIONS[lifecycleStage];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        <StatusBadge variant={stageBadgeVariant(lifecycleStage)}>
          {stageLabel(lifecycleStage)}
          {caption ? <span className="font-normal opacity-70"> · {caption}</span> : null}
        </StatusBadge>
        {dealCode && (
          <span className="ml-auto font-mono text-sm text-muted-foreground">{dealCode}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        facing {facingParty.role}{" "}
        <span className="font-medium text-foreground">{facingName}</span>
        {legacyCode && !dealCode ? <span className="ml-2 font-mono text-xs">{legacyCode}</span> : null}
      </p>
    </div>
  );
}

function stageLabel(stage: string): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

/** Local stage→badge map. F2 will centralise the §12 palette across surfaces. */
function stageBadgeVariant(
  stage: string,
): "draft" | "pending" | "success" | "error" | "info" | "warning" {
  switch (stage) {
    case "draft":
      return "draft";
    case "confirmed":
      return "pending";
    case "produced":
      return "info";
    case "loaded":
      return "warning";
    case "delivered":
      return "success";
    case "cancelled":
      return "error";
    default:
      return "info";
  }
}
