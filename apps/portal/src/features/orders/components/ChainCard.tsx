"use client";

import Link from "next/link";
import { Link2, ArrowRight } from "lucide-react";
import { StatusBadge } from "@timber/ui";
import type { SpineLegRef } from "../services/spineSiblings";

function fmtCents(cents: number, currency: string): string {
  const v = (cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v} ${currency}`;
}

/**
 * B3 · Chain card (spec §6.2 "the full spine overview is for the owner"). Lists
 * EVERY leg on the deal's spine — resolved via `spine_id` (§2.3), owner/admin only
 * (the server sends an empty array to everyone else). Sell ↔ buy navigation.
 */
export function ChainCard({
  legs, currentOrderId, currency, spineCode,
}: {
  legs: SpineLegRef[];
  currentOrderId: string;
  currency: string;
  /** M1 · the spine's SP-NNN code, shown in the header (owner only). */
  spineCode?: string | null;
}) {
  if (legs.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Chain</span>
        {spineCode && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums" title="Spine code">{spineCode}</span>
        )}
        <span className="text-xs text-muted-foreground">{legs.length} leg{legs.length === 1 ? "" : "s"} on the spine</span>
      </div>
      <ul className="space-y-2">
        {legs.map((leg) => {
          const isBuy = leg.dealKind === "purchase_only";
          const isCurrent = leg.orderId === currentOrderId;
          const cancelled = leg.lifecycleStage === "cancelled" || leg.status === "cancelled";
          return (
            <li
              key={leg.orderId}
              className={`rounded-md border p-2 text-xs ${isCurrent ? "border-primary/50 bg-primary/5" : "border-border"} ${cancelled ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <StatusBadge variant={isBuy ? "warning" : "info"}>{isBuy ? "Buy" : "Sell"}</StatusBadge>
                  <span className="font-medium tabular-nums">{leg.dealCode ?? leg.code}</span>
                  {isCurrent && <span className="text-[10px] text-muted-foreground">(this deal)</span>}
                </span>
                <span className="text-muted-foreground capitalize">{leg.lifecycleStage ?? "—"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
                <span className="truncate">{leg.sellerName ?? "—"} <ArrowRight className="inline h-3 w-3" /> {leg.buyerName ?? "—"}</span>
                <span className="tabular-nums shrink-0">{fmtCents(leg.ownTotalCents, currency)}</span>
              </div>
              {!isCurrent && (
                <Link href={`/orders/${leg.orderId}`} className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">
                  Open <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
