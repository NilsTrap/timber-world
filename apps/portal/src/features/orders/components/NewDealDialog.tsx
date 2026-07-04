"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@timber/ui";
import { getOrderPartyOptions, type OrderPartyOptions } from "../actions/getOrderPartyOptions";
import { createOrder } from "../actions/createOrder";
import { PartyFields, partyPickComplete, type PartyValue } from "./PartyFields";

/**
 * H1 · New-deal dialog. "Add order" now opens this first so the deal is born with
 * its parties — which lets createOrder mint the bilateral deal code (SELLER-BUYER-
 * NNN) immediately (the old flow created a party-less draft with no code). Party
 * selection respects the walled books + company roles server-side; this dialog
 * only surfaces the slots the user may pick (PartyFields). On create it navigates
 * to the new deal, where the code is already shown.
 */
export function NewDealDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [partyOptions, setPartyOptions] = useState<OrderPartyOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [value, setValue] = useState<PartyValue>({ customerOrganisationId: null, sellerOrganisationId: null });
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load the pick lists when the dialog first opens.
  useEffect(() => {
    if (!open || partyOptions) return;
    let alive = true;
    getOrderPartyOptions().then((res) => {
      if (!alive) return;
      setLoading(false);
      if (!res.success) { setLoadErr(res.error); return; }
      setPartyOptions(res.data);
      // Admin default: pre-select the house org as the Manufacturer when it is one
      // (so the code mints as HOUSE-BUYER-NNN); the admin can still change it.
      if (res.data.isAdmin && res.data.userOrgId && res.data.manufacturerOptions.some((o) => o.id === res.data.userOrgId)) {
        setValue((v) => ({ ...v, sellerOrganisationId: res.data.userOrgId }));
      }
    });
    return () => { alive = false; };
  }, [open, partyOptions]);

  const create = useCallback(async () => {
    setSubmitting(true);
    const res = await createOrder({
      name: name.trim() || "-",
      customerOrganisationId: value.customerOrganisationId,
      sellerOrganisationId: value.sellerOrganisationId,
      dateReceived: new Date().toISOString().slice(0, 10),
    });
    setSubmitting(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(res.data.dealCode ? `Deal ${res.data.dealCode} created` : "Deal created");
    router.push(`/orders/${res.data.id}`);
  }, [name, value, router]);

  const canSubmit = !!partyOptions && partyPickComplete(partyOptions, value) && !submitting;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
          <DialogDescription>Pick the parties — the deal code is assigned automatically.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <span className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </span>
        ) : loadErr ? (
          <p className="py-4 text-sm text-destructive">{loadErr}</p>
        ) : partyOptions ? (
          <div className="space-y-4">
            <PartyFields partyOptions={partyOptions} value={value} onChange={(patch) => setValue((v) => ({ ...v, ...patch }))} />
            <div className="space-y-1.5">
              <Label htmlFor="nd-name">Reference <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="nd-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Firewood truckload" />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={create} disabled={!canSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
