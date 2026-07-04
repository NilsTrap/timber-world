"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Truck, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Button, Label, StatusBadge,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@timber/ui";
import type { DealSourcingState } from "../actions/dealActions";
import { getSupplierOptions, startSourcingAction, replaceSupplierAction, type SupplierOption } from "../actions/sourcingActions";

/**
 * B4 · Sourcing state on a SELL deal (right action column). Shown only to viewers
 * with sourcing rights (canStartSourcing, resolved server-side). Three states:
 * unsourced → "Start sourcing" CTA; sourced → link to the buy deal + "Replace
 * supplier". Supplier name is only present when the viewer has supplier_identity.
 */
export function SourcingCard({
  orderId, sourcing, onChanged,
}: {
  orderId: string;
  sourcing: DealSourcingState;
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
            Not sourced yet. Pick a supplier to create the buy deal on this spine (the sell lines
            are copied over with prices left blank for Purchasing).
          </p>
          <Button size="sm" className="w-full" onClick={() => setMode("start")}>
            <Truck className="h-3.5 w-3.5" /> Start sourcing
          </Button>
        </>
      )}

      {mode && (
        <SupplierDialog
          orderId={orderId}
          mode={mode}
          onClose={() => setMode(null)}
          onDone={onChanged}
        />
      )}
    </div>
  );
}

function SupplierDialog({
  orderId, mode, onClose, onDone,
}: {
  orderId: string;
  mode: "start" | "replace";
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [options, setOptions] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierId, setSupplierId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSupplierOptions().then((res) => {
      if (!alive) return;
      setLoading(false);
      if (res.success) setOptions(res.data);
      else setErr(res.error);
    });
    return () => { alive = false; };
  }, []);

  const confirm = useCallback(async () => {
    if (!supplierId) { setErr("Pick a supplier."); return; }
    setSubmitting(true);
    setErr(null);
    const res = mode === "start"
      ? await startSourcingAction({ orderId, supplierOrgId: supplierId })
      : await replaceSupplierAction({ orderId, newSupplierOrgId: supplierId });
    setSubmitting(false);
    if (!res.success) { setErr(res.error); toast.error(res.error); return; }
    toast.success(mode === "start" ? "Sourcing started" : "Supplier replaced");
    onClose();
    await onDone();
  }, [mode, orderId, supplierId, onClose, onDone]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "start" ? "Start sourcing" : "Replace supplier"}</DialogTitle>
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
            <Label>Supplier</Label>
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
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={confirm} disabled={submitting || !supplierId}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "start" ? "Start sourcing" : "Replace supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
