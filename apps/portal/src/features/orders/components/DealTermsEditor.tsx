"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import {
  Button, Input, Textarea,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@timber/ui";
import { updateDealTerms, type DealTermsInput } from "../actions/dealActions";

/**
 * G2 · Deal-terms editor (§8 merge-field sources). Edits the commercial terms that
 * feed a generated quotation/contract (incoterms, advance, payment/delivery terms,
 * deadline, notes) + the per-deal signee overrides (G3). Previously these had a DB
 * column but NO portal input (MCP-only). Gated by the deal_terms field-wall — the
 * caller only renders this when the viewer may edit; the action re-checks.
 */
export interface DealTermsValues {
  incoterms: string | null;
  incotermsPlace: string | null;
  advancePct: number | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  deliveryDeadline: string | null;
  notes: string | null;
  sellerSigneeName: string | null;
  sellerSigneeRole: string | null;
  buyerSigneeName: string | null;
  buyerSigneeRole: string | null;
}

type Draft = Record<keyof DealTermsValues, string>;

function toDraft(v: DealTermsValues): Draft {
  return {
    incoterms: v.incoterms ?? "",
    incotermsPlace: v.incotermsPlace ?? "",
    advancePct: v.advancePct != null ? String(v.advancePct) : "",
    paymentTerms: v.paymentTerms ?? "",
    deliveryTerms: v.deliveryTerms ?? "",
    deliveryDeadline: v.deliveryDeadline ?? "",
    notes: v.notes ?? "",
    sellerSigneeName: v.sellerSigneeName ?? "",
    sellerSigneeRole: v.sellerSigneeRole ?? "",
    buyerSigneeName: v.buyerSigneeName ?? "",
    buyerSigneeRole: v.buyerSigneeRole ?? "",
  };
}

/** Trim; empty → null (clears the column). */
function nn(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

export function DealTermsEditor({
  orderId,
  values,
  sellerName,
  buyerName,
  onSaved,
}: {
  orderId: string;
  values: DealTermsValues;
  sellerName: string | null;
  buyerName: string | null;
  onSaved: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(values));
  const [saving, setSaving] = useState(false);

  const openDialog = () => { setDraft(toDraft(values)); setOpen(true); };
  const set = (k: keyof Draft, v: string) => setDraft((p) => ({ ...p, [k]: v }));

  const save = async () => {
    // advance % must be a number in 0..100 if given.
    let advancePct: number | null = null;
    if (draft.advancePct.trim() !== "") {
      const n = Number(draft.advancePct.trim().replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 100) { toast.error("Advance % must be a number between 0 and 100"); return; }
      advancePct = n;
    }
    const terms: DealTermsInput = {
      incoterms: nn(draft.incoterms),
      incotermsPlace: nn(draft.incotermsPlace),
      advancePct,
      paymentTerms: nn(draft.paymentTerms),
      deliveryTerms: nn(draft.deliveryTerms),
      deliveryDeadline: nn(draft.deliveryDeadline),
      notes: nn(draft.notes),
      sellerSigneeName: nn(draft.sellerSigneeName),
      sellerSigneeRole: nn(draft.sellerSigneeRole),
      buyerSigneeName: nn(draft.buyerSigneeName),
      buyerSigneeRole: nn(draft.buyerSigneeRole),
    };
    setSaving(true);
    const res = await updateDealTerms({ orderId, terms });
    setSaving(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Deal terms updated");
    setOpen(false);
    await onSaved();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog}>
        <Pencil className="h-3.5 w-3.5" /> Edit terms
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit deal terms</DialogTitle>
            <DialogDescription>These appear on the generated quotation, order specification and contract.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="dt-inc">Incoterms</label>
                <Input id="dt-inc" value={draft.incoterms} onChange={(e) => set("incoterms", e.target.value)} placeholder="e.g. FCA" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="dt-incp">Incoterms place</label>
                <Input id="dt-incp" value={draft.incotermsPlace} onChange={(e) => set("incotermsPlace", e.target.value)} placeholder="e.g. Riga" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="dt-adv">Advance %</label>
                <Input id="dt-adv" type="number" min="0" max="100" value={draft.advancePct} onChange={(e) => set("advancePct", e.target.value)} placeholder="e.g. 30" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="dt-dl">Delivery deadline</label>
                <Input id="dt-dl" value={draft.deliveryDeadline} onChange={(e) => set("deliveryDeadline", e.target.value)} placeholder="e.g. 2026-08-15 or week 34" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="dt-pay">Payment terms</label>
              <Input id="dt-pay" value={draft.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} placeholder="e.g. 30% advance, balance before dispatch" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="dt-del">Delivery terms</label>
              <Input id="dt-del" value={draft.deliveryTerms} onChange={(e) => set("deliveryTerms", e.target.value)} placeholder="e.g. Delivered to the customer's warehouse" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="dt-notes">Notes</label>
              <Textarea id="dt-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
            </div>

            {/* G3 · signature block (defaults from the party org; override per deal). */}
            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Signatories (documents)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="dt-ssn">Seller signee — name{sellerName ? ` (${sellerName})` : ""}</label>
                  <Input id="dt-ssn" value={draft.sellerSigneeName} onChange={(e) => set("sellerSigneeName", e.target.value)} placeholder="Defaults from the org" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="dt-ssr">Seller signee — role</label>
                  <Input id="dt-ssr" value={draft.sellerSigneeRole} onChange={(e) => set("sellerSigneeRole", e.target.value)} placeholder="e.g. Director" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="dt-bsn">Buyer signee — name{buyerName ? ` (${buyerName})` : ""}</label>
                  <Input id="dt-bsn" value={draft.buyerSigneeName} onChange={(e) => set("buyerSigneeName", e.target.value)} placeholder="Defaults from the org" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="dt-bsr">Buyer signee — role</label>
                  <Input id="dt-bsr" value={draft.buyerSigneeRole} onChange={(e) => set("buyerSigneeRole", e.target.value)} placeholder="e.g. Purchasing manager" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save terms"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
