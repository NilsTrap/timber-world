"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@timber/ui";
import { getOrderPartyOptions, type OrderPartyOptions } from "../actions/getOrderPartyOptions";
import { setDealParties } from "../actions/setDealParties";
import { PartyFields, partyPickComplete, type PartyValue } from "./PartyFields";

/**
 * H1 · Parties card — shown on a DRAFT deal that arrived party-less (portal
 * drafts predating H1, or MCP rows created without a customer). Setting the
 * parties mints the bilateral deal code. Parties are only editable while Draft;
 * after Draft a deal's identity is fixed (a change = cancel + recreate, B2), so
 * DealPanel stops rendering this card once the deal advances.
 */
export function DealPartiesCard({
  orderId,
  customer,
  seller,
  onChanged,
}: {
  orderId: string;
  customer: { id: string | null; name: string | null };
  seller: { id: string | null; name: string | null };
  onChanged: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [partyOptions, setPartyOptions] = useState<OrderPartyOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [value, setValue] = useState<PartyValue>({
    customerOrganisationId: customer.id,
    sellerOrganisationId: seller.id,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || partyOptions) return;
    let alive = true;
    getOrderPartyOptions().then((res) => {
      if (!alive) return;
      setLoading(false);
      if (!res.success) { setLoadErr(res.error); return; }
      setPartyOptions(res.data);
      // L2 · Default a still-blank Trader (seller): a salesperson's sole trader
      // org, or (admin) their own org when it is a trader; still changeable.
      if (!seller.id) {
        const d = res.data;
        const soleTrader = d.userTraderOrgs.length === 1 ? d.userTraderOrgs[0] : null;
        if (soleTrader) {
          setValue((v) => ({ ...v, sellerOrganisationId: soleTrader.id }));
        } else if (d.isAdmin && d.userOrgId && d.traderOptions.some((o) => o.id === d.userOrgId)) {
          setValue((v) => ({ ...v, sellerOrganisationId: d.userOrgId }));
        }
      }
    });
    return () => { alive = false; };
  }, [open, partyOptions, seller.id]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    const res = await setDealParties({
      orderId,
      customerOrganisationId: value.customerOrganisationId,
      sellerOrganisationId: value.sellerOrganisationId,
    });
    setSubmitting(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(res.data.dealCode ? `Parties set — deal ${res.data.dealCode}` : "Parties set");
    setOpen(false);
    await onChanged();
  }, [orderId, value, onChanged]);

  const canSubmit = !!partyOptions && partyPickComplete(partyOptions, value) && !submitting;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Users className="h-4 w-4 text-amber-600" />
        <span className="font-medium">Parties not set</span>
      </div>
      <p className="text-xs text-muted-foreground">
        This deal has no {customer.id ? "seller" : seller.id ? "buyer" : "buyer or seller"} yet.
        Set the parties to assign the deal its <span className="font-medium">SELLER-BUYER</span> code. Parties lock once the deal leaves Draft.
      </p>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Users className="h-3.5 w-3.5" /> Set parties
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!submitting) setOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set deal parties</DialogTitle>
            <DialogDescription>The deal code is assigned automatically once both parties are set.</DialogDescription>
          </DialogHeader>

          {loading ? (
            <span className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </span>
          ) : loadErr ? (
            <p className="py-4 text-sm text-destructive">{loadErr}</p>
          ) : partyOptions ? (
            <PartyFields
              partyOptions={partyOptions}
              value={value}
              onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
              lockedCustomerName={customer.id ? customer.name ?? "Buyer" : undefined}
              lockedSellerName={seller.id ? seller.name ?? "Seller" : undefined}
            />
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={!canSubmit}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save parties
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
