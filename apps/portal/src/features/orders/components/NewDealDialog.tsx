"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button, Input, Label,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@timber/ui";
import { getOrderPartyOptions, type OrderPartyOptions } from "../actions/getOrderPartyOptions";
import { createOrder } from "../actions/createOrder";
import { getOriginDealOptions, createDealLegAction, type OriginDealOption } from "../actions/legActions";
import { getCurrencies } from "@/features/catalog/actions/currencies";
import { PartyFields, partyPickComplete, type PartyValue } from "./PartyFields";

/** R7 · fallback currency list when getCurrencies is unavailable (a creator without
 *  catalogue.view) — the active set today; the CHECK also allows USD. */
const FALLBACK_CURRENCIES = [
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
];

/**
 * H1/L1 · New-deal dialog. "Add order" opens this so the deal is born with its
 * parties. For ADMINS it offers a mode choice (§1):
 *   1. Blank order — today's flow; the deal becomes a spine origin.
 *   2. Leg from an original order — pick an existing deal; the new deal joins
 *      that deal's spine and copies its spec lines (prices blank). Admin picks
 *      the leg's parties (trader = seller, buyer = customer).
 * Salespeople never see the mode choice — they only create blank deals for their
 * own trader.
 */
export function NewDealDialog({
  open,
  onOpenChange,
  presetOriginDealId,
  presetOriginLabel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** L1 · when set (e.g. "Create next leg" from a deal), the dialog opens in leg
   *  mode with this origin fixed. */
  presetOriginDealId?: string;
  presetOriginLabel?: string;
}) {
  const router = useRouter();
  const [partyOptions, setPartyOptions] = useState<OrderPartyOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [value, setValue] = useState<PartyValue>({ customerOrganisationId: null, sellerOrganisationId: null });
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // R7 · currency for a blank deal (defaults EUR). Options come from the catalog;
  // falls back to the active set when the creator lacks catalogue.view.
  const [currency, setCurrency] = useState("EUR");
  const [currencyOptions, setCurrencyOptions] = useState<{ code: string; name: string }[]>(FALLBACK_CURRENCIES);

  // L1 · mode + origin (admin only). A preset origin forces leg mode.
  const [mode, setMode] = useState<"blank" | "leg">(presetOriginDealId ? "leg" : "blank");
  const [originOptions, setOriginOptions] = useState<OriginDealOption[] | null>(null);
  const [originId, setOriginId] = useState<string>(presetOriginDealId ?? "");
  const [legValue, setLegValue] = useState<PartyValue>({ customerOrganisationId: null, sellerOrganisationId: null });

  // R7 · load currency options once when the dialog opens (active only, fallback set).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    getCurrencies().then((res) => {
      if (!alive || !res.success) return;
      const active = res.data.filter((c) => c.isActive).map((c) => ({ code: c.code, name: c.name }));
      if (active.length > 0) setCurrencyOptions(active);
    });
    return () => { alive = false; };
  }, [open]);

  // Load the pick lists when the dialog first opens.
  useEffect(() => {
    if (!open || partyOptions) return;
    let alive = true;
    getOrderPartyOptions().then((res) => {
      if (!alive) return;
      setLoading(false);
      if (!res.success) { setLoadErr(res.error); return; }
      setPartyOptions(res.data);
      // L2 · Trader (seller) default for BLANK mode. A salesperson bound to
      // exactly ONE trader gets it auto-selected; an admin pre-selects their own
      // org when it is a trader (so the code mints HOUSE-BUYER-NNN).
      const d = res.data;
      const soleTrader = d.userTraderOrgs.length === 1 ? d.userTraderOrgs[0] : null;
      if (soleTrader) {
        setValue((v) => ({ ...v, sellerOrganisationId: soleTrader.id }));
      } else if (d.isAdmin && d.userOrgId && d.traderOptions.some((o) => o.id === d.userOrgId)) {
        setValue((v) => ({ ...v, sellerOrganisationId: d.userOrgId }));
      }
    });
    return () => { alive = false; };
  }, [open, partyOptions]);

  // Load origin deals lazily the first time leg mode is shown (admin only).
  useEffect(() => {
    if (!open || mode !== "leg" || originOptions || !partyOptions?.isAdmin) return;
    let alive = true;
    getOriginDealOptions().then((res) => {
      if (!alive) return;
      if (res.success) setOriginOptions(res.data);
      else toast.error(res.error);
    });
    return () => { alive = false; };
  }, [open, mode, originOptions, partyOptions?.isAdmin]);

  const isAdmin = partyOptions?.isAdmin ?? false;
  // A leg's buyer may be a client OR another trader (chains can be anything) — so
  // the buyer picker is the union; the trader (seller) picker is the traders.
  const traderOptions = partyOptions?.traderOptions ?? [];
  const buyerOptions = (() => {
    if (!partyOptions) return [];
    const seen = new Set<string>();
    return [...partyOptions.customerOptions, ...partyOptions.traderOptions].filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
  })();

  const createBlank = useCallback(async () => {
    setSubmitting(true);
    const res = await createOrder({
      name: name.trim() || "-",
      customerOrganisationId: value.customerOrganisationId,
      sellerOrganisationId: value.sellerOrganisationId,
      currency: currency as "EUR" | "GBP" | "USD",
      dateReceived: new Date().toISOString().slice(0, 10),
    });
    setSubmitting(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(res.data.dealCode ? `Deal ${res.data.dealCode} created` : "Deal created");
    router.push(`/orders/${res.data.id}`);
  }, [name, value, currency, router]);

  const createLeg = useCallback(async () => {
    if (!originId) { toast.error("Pick the original order to fork from."); return; }
    setSubmitting(true);
    const res = await createDealLegAction({
      originDealId: originId,
      name: name.trim() || null,
      customerOrganisationId: legValue.customerOrganisationId,
      sellerOrganisationId: legValue.sellerOrganisationId,
    });
    setSubmitting(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(res.data.dealCode ? `Leg ${res.data.dealCode} created` : "Leg created");
    router.push(`/orders/${res.data.id}`);
  }, [originId, name, legValue, router]);

  const canSubmitBlank = !!partyOptions && partyPickComplete(partyOptions, value) && !submitting;
  // A leg needs an origin + at least one party (the code mints lazily once both exist).
  const canSubmitLeg =
    !!originId && (!!legValue.sellerOrganisationId || !!legValue.customerOrganisationId) && !submitting;

  const originLabel = (o: OriginDealOption) =>
    [o.dealCode ?? o.code, o.buyerName, o.spineCode].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "leg" ? "New leg on a spine" : "New deal"}</DialogTitle>
          <DialogDescription>
            {mode === "leg"
              ? "Fork a new deal onto an existing order's spine — its spec lines copy over (prices blank)."
              : "Pick the parties — the deal code is assigned automatically."}
          </DialogDescription>
        </DialogHeader>

        {/* L1 · mode choice — ADMIN ONLY. A preset origin locks leg mode. */}
        {isAdmin && !presetOriginDealId && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={mode === "blank" ? "default" : "outline"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setMode("blank")}
              disabled={submitting}
            >
              Blank order
            </Button>
            <Button
              type="button"
              variant={mode === "leg" ? "default" : "outline"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setMode("leg")}
              disabled={submitting}
            >
              Leg from an order
            </Button>
          </div>
        )}

        {loading ? (
          <span className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </span>
        ) : loadErr ? (
          <p className="py-4 text-sm text-destructive">{loadErr}</p>
        ) : partyOptions && mode === "blank" ? (
          <div className="space-y-4">
            <PartyFields partyOptions={partyOptions} value={value} onChange={(patch) => setValue((v) => ({ ...v, ...patch }))} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nd-name">Reference <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="nd-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Firewood truckload" />
              </div>
              {/* R7 · deal currency (can still be changed later while Draft). */}
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((o) => <SelectItem key={o.code} value={o.code}>{o.code} — {o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : partyOptions && mode === "leg" ? (
          <div className="space-y-4">
            {/* Origin picker (or a fixed origin when preset) */}
            <div className="space-y-1.5">
              <Label>Original order</Label>
              {presetOriginDealId ? (
                <p className="text-sm rounded-md border bg-muted/40 px-3 py-2">{presetOriginLabel ?? "This deal"} <span className="text-muted-foreground">(spine origin)</span></p>
              ) : originOptions == null ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading deals…
                </span>
              ) : originOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No existing deals to fork from.</p>
              ) : (
                <Select value={originId} onValueChange={setOriginId}>
                  <SelectTrigger><SelectValue placeholder="Pick the original order" /></SelectTrigger>
                  <SelectContent>
                    {originOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{originLabel(o)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Leg parties — admin picks freely (R1: Seller + Buyer). */}
            <div className="space-y-1.5">
              <Label>Seller</Label>
              <Select
                value={legValue.sellerOrganisationId ?? ""}
                onValueChange={(v) => setLegValue((s) => ({ ...s, sellerOrganisationId: v || null }))}
              >
                <SelectTrigger><SelectValue placeholder="Pick the seller" /></SelectTrigger>
                <SelectContent>
                  {traderOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.code ? `${o.code} — ${o.name}` : o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Buyer <span className="text-muted-foreground">(optional — set later)</span></Label>
              <Select
                value={legValue.customerOrganisationId ?? ""}
                onValueChange={(v) => setLegValue((s) => ({ ...s, customerOrganisationId: v || null }))}
              >
                <SelectTrigger><SelectValue placeholder="Pick the buyer" /></SelectTrigger>
                <SelectContent>
                  {buyerOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.code ? `${o.code} — ${o.name}` : o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nd-leg-name">Reference <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="nd-leg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. UK middle leg" />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          {mode === "leg" ? (
            <Button onClick={createLeg} disabled={!canSubmitLeg}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create leg
            </Button>
          ) : (
            <Button onClick={createBlank} disabled={!canSubmitBlank}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create deal
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
