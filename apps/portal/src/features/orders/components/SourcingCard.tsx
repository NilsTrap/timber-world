"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Truck, ArrowRight, RefreshCw, GitBranch } from "lucide-react";
import { toast } from "sonner";
import {
  Button, Label, StatusBadge,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@timber/ui";
import type { DealSourcingState } from "../actions/dealActions";
import { getSupplierOptions, startSourcingAction, replaceSupplierAction, type SupplierOption } from "../actions/sourcingActions";
import { getOrderPartyOptions } from "../actions/getOrderPartyOptions";

interface PartyOpt { id: string; code: string; name: string }

/**
 * B4/L1 · Sourcing state on a SELL deal (right action column). Shown only to
 * viewers with sourcing rights (canStartSourcing, resolved server-side). The
 * "Create next leg" action spawns the buy leg: seller = the picked supplier;
 * buyer defaults to THIS deal's seller (the trader) but is EDITABLE — L1's fix
 * for the Meeting-1 wrong-buyer bug.
 */
export function SourcingCard({
  orderId, sourcing, sellerOrgId, sellerName, onChanged,
}: {
  orderId: string;
  sourcing: DealSourcingState;
  /** This deal's seller (the trader) — the default buyer for the new buy leg. */
  sellerOrgId: string | null;
  sellerName: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<null | "start" | "replace">(null);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Sourcing</span>
        {sourcing.hasBuyLeg && <StatusBadge variant="info">Sourced</StatusBadge>}
      </div>

      {sourcing.hasBuyLeg ? (
        <>
          <dl className="space-y-1 text-sm">
            {sourcing.buyLegDealCode && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Buy deal</dt>
                <dd className="font-medium tabular-nums">{sourcing.buyLegDealCode}</dd>
              </div>
            )}
            {sourcing.buyLegStage && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Stage</dt>
                <dd className="font-medium capitalize">{sourcing.buyLegStage}</dd>
              </div>
            )}
            {sourcing.supplierName && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Supplier</dt>
                <dd className="font-medium">{sourcing.supplierName}</dd>
              </div>
            )}
          </dl>
          {sourcing.buyLegOrderId && (
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/orders/${sourcing.buyLegOrderId}`}>
                Open buy deal <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setMode("replace")}>
            <RefreshCw className="h-3.5 w-3.5" /> Replace supplier
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Not sourced yet. Create the buy leg on this spine — the sell lines copy over with prices
            left blank for the new leg to price.
          </p>
          <Button size="sm" className="w-full" onClick={() => setMode("start")}>
            <GitBranch className="h-3.5 w-3.5" /> Create next leg
          </Button>
        </>
      )}

      {mode && (
        <SupplierDialog
          orderId={orderId}
          mode={mode}
          defaultBuyerId={sellerOrgId}
          defaultBuyerName={sellerName}
          onClose={() => setMode(null)}
          onDone={onChanged}
        />
      )}
    </div>
  );
}

function SupplierDialog({
  orderId, mode, defaultBuyerId, defaultBuyerName, onClose, onDone,
}: {
  orderId: string;
  mode: "start" | "replace";
  defaultBuyerId: string | null;
  defaultBuyerName: string | null;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [options, setOptions] = useState<SupplierOption[]>([]);
  const [buyerOptions, setBuyerOptions] = useState<PartyOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierId, setSupplierId] = useState<string>("");
  const [buyerId, setBuyerId] = useState<string>(defaultBuyerId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getSupplierOptions(), getOrderPartyOptions()]).then(([sup, parties]) => {
      if (!alive) return;
      setLoading(false);
      if (sup.success) setOptions(sup.data);
      else setErr(sup.error);
      // Buyer (trader) options — always include this deal's seller as the default,
      // then any traders the viewer may pick from.
      const traders = parties.success ? parties.data.traderOptions : [];
      const merged: PartyOpt[] = [];
      const seen = new Set<string>();
      if (defaultBuyerId) {
        merged.push({ id: defaultBuyerId, code: "", name: defaultBuyerName ?? "This deal's trader" });
        seen.add(defaultBuyerId);
      }
      for (const t of traders) if (!seen.has(t.id)) { merged.push(t); seen.add(t.id); }
      setBuyerOptions(merged);
    });
    return () => { alive = false; };
  }, [defaultBuyerId, defaultBuyerName]);

  const confirm = useCallback(async () => {
    if (!supplierId) { setErr("Pick a supplier."); return; }
    setSubmitting(true);
    setErr(null);
    const buyer = buyerId || null;
    const res = mode === "start"
      ? await startSourcingAction({ orderId, supplierOrgId: supplierId, buyerOrgId: buyer })
      : await replaceSupplierAction({ orderId, newSupplierOrgId: supplierId, buyerOrgId: buyer });
    setSubmitting(false);
    if (!res.success) { setErr(res.error); toast.error(res.error); return; }
    toast.success(mode === "start" ? "Next leg created" : "Supplier replaced");
    onClose();
    await onDone();
  }, [mode, orderId, supplierId, buyerId, onClose, onDone]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "start" ? "Create next leg" : "Replace supplier"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {mode === "replace" && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              The current sourcing deal will be <strong>cancelled</strong> and the spine flagged as
              re-sourced (expected). A fresh buy deal is created for the new supplier with the sell
              lines copied over. Only allowed before production.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Supplier <span className="text-muted-foreground">(seller)</span></Label>
            {loading ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading suppliers…
              </span>
            ) : options.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suppliers in the book yet — add one in CRM → Suppliers.</p>
            ) : (
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Pick a supplier" /></SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}{o.code ? ` (${o.code})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {/* L1 · buyer — defaults to this deal's seller (the trader) but editable. */}
          {!loading && buyerOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label>Buyer <span className="text-muted-foreground">(who buys from the supplier)</span></Label>
              <Select value={buyerId} onValueChange={setBuyerId}>
                <SelectTrigger><SelectValue placeholder="Pick the buyer" /></SelectTrigger>
                <SelectContent>
                  {buyerOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.code ? `${o.code} — ${o.name}` : o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={confirm} disabled={submitting || !supplierId}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "start" ? "Create next leg" : "Replace supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
