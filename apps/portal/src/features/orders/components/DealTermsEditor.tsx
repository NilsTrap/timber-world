"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Button, Input, Textarea,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@timber/ui";
import { updateDealTerms, type DealTermsInput } from "../actions/dealActions";
import { getFieldOptions, type FieldOptionChoice } from "../actions/getFieldOptions";

/** Radix Select forbids an empty-string item value, so a sentinel represents
 *  "no incoterms" and is mapped back to "" on save. */
const INCOTERMS_NONE = "__none";
/** Same sentinel trick for the R3 Payment terms dropdown (admin-managed field). */
const PAYMENT_TERMS_NONE = "__none";
/** A stored delivery deadline in ISO yyyy-mm-dd drives the calendar input; any
 *  other (legacy free-text) value falls back to a plain text input. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * G2/H2 · Deal-terms editor — now INLINE (Edgars 2026-07-04: no modal). The
 * commercial terms that feed a generated quotation/contract (incoterms, advance,
 * payment/delivery terms, deadline, notes) + per-deal signee overrides (G3) edit
 * in place; a Save bar appears only when there are unsaved changes. Rendered by
 * DealPanel only when the deal_terms field-wall allows editing; the action
 * re-checks server-side.
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
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
  const savedKey = useMemo(() => JSON.stringify(toDraft(values)), [values]);
  const [draft, setDraft] = useState<Draft>(() => toDraft(values));
  const [saving, setSaving] = useState(false);
  const [incotermsOptions, setIncotermsOptions] = useState<FieldOptionChoice[]>([]);
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<FieldOptionChoice[]>([]);
  const [deadlineTextMode, setDeadlineTextMode] = useState(false);

  // Re-sync the draft only when the SAVED values actually change (after a save +
  // reload) — keyed on content, not object identity, so typing is never reset.
  useEffect(() => {
    const d = toDraft(values);
    setDraft(d);
    setDeadlineTextMode(d.deliveryDeadline.trim() !== "" && !ISO_DATE_RE.test(d.deliveryDeadline.trim()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  useEffect(() => {
    let alive = true;
    getFieldOptions("incoterms").then((res) => { if (alive && res.success) setIncotermsOptions(res.data); });
    getFieldOptions("payment_terms").then((res) => { if (alive && res.success) setPaymentTermsOptions(res.data); });
    return () => { alive = false; };
  }, []);

  const set = (k: keyof Draft, v: string) => setDraft((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(draft) !== savedKey;

  const incotermsChoices = useMemo(() => {
    const cur = draft.incoterms.trim();
    const known = incotermsOptions.some((o) => o.value === cur);
    return cur && !known ? [...incotermsOptions, { value: cur, label: `${cur} (current)` }] : incotermsOptions;
  }, [incotermsOptions, draft.incoterms]);

  // R3 · a stored value that predates the seeded option set (legacy free-text
  // payment terms) is surfaced as a "(current)" choice so the Select can show it.
  const paymentTermsChoices = useMemo(() => {
    const cur = draft.paymentTerms.trim();
    const known = paymentTermsOptions.some((o) => o.value === cur);
    return cur && !known ? [...paymentTermsOptions, { value: cur, label: `${cur} (current)` }] : paymentTermsOptions;
  }, [paymentTermsOptions, draft.paymentTerms]);

  const save = async () => {
    // R3: advance_pct is DERIVED server-side from the chosen payment term (no
    // longer a hand-edited field); delivery_terms is no longer edited here (kept
    // in the DB + its doc merge token for legacy documents).
    const terms: DealTermsInput = {
      incoterms: nn(draft.incoterms),
      incotermsPlace: nn(draft.incotermsPlace),
      paymentTerms: nn(draft.paymentTerms),
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
    await onSaved();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
        <Field label="Incoterms">
          <Select
            value={draft.incoterms.trim() === "" ? INCOTERMS_NONE : draft.incoterms}
            onValueChange={(v) => set("incoterms", v === INCOTERMS_NONE ? "" : v)}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={INCOTERMS_NONE}>—</SelectItem>
              {incotermsChoices.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Incoterms place">
          <Input className="h-8" value={draft.incotermsPlace} onChange={(e) => set("incotermsPlace", e.target.value)} placeholder="e.g. Riga" />
        </Field>

        <Field label="Delivery deadline">
          {deadlineTextMode ? (
            <>
              <Input className="h-8" value={draft.deliveryDeadline} onChange={(e) => set("deliveryDeadline", e.target.value)} placeholder="e.g. week 34" />
              <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => { set("deliveryDeadline", ""); setDeadlineTextMode(false); }}>Pick a date instead</button>
            </>
          ) : (
            <>
              <Input className="h-8" type="date" value={draft.deliveryDeadline} onChange={(e) => set("deliveryDeadline", e.target.value)} />
              <button type="button" className="text-[11px] text-muted-foreground hover:underline" onClick={() => setDeadlineTextMode(true)}>Enter free text instead</button>
            </>
          )}
        </Field>
        <Field label="Payment terms">
          <Select
            value={draft.paymentTerms.trim() === "" ? PAYMENT_TERMS_NONE : draft.paymentTerms}
            onValueChange={(v) => set("paymentTerms", v === PAYMENT_TERMS_NONE ? "" : v)}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={PAYMENT_TERMS_NONE}>—</SelectItem>
              {paymentTermsChoices.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Notes">
        <Textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Free-text notes shown on the generated documents" />
      </Field>

      <div className="border-t pt-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Signatories (documents)</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Field label={`Seller signee — name${sellerName ? ` (${sellerName})` : ""}`}>
            <Input className="h-8" value={draft.sellerSigneeName} onChange={(e) => set("sellerSigneeName", e.target.value)} placeholder="Defaults from the org" />
          </Field>
          <Field label="Seller signee — role">
            <Input className="h-8" value={draft.sellerSigneeRole} onChange={(e) => set("sellerSigneeRole", e.target.value)} placeholder="e.g. Director" />
          </Field>
          <Field label={`Buyer signee — name${buyerName ? ` (${buyerName})` : ""}`}>
            <Input className="h-8" value={draft.buyerSigneeName} onChange={(e) => set("buyerSigneeName", e.target.value)} placeholder="Defaults from the org" />
          </Field>
          <Field label="Buyer signee — role">
            <Input className="h-8" value={draft.buyerSigneeRole} onChange={(e) => set("buyerSigneeRole", e.target.value)} placeholder="e.g. Purchasing manager" />
          </Field>
        </div>
      </div>

      {/* N4 · Save/Discard live in a card FOOTER pinned to the bottom (Nils: "save
          pogu būtu jānolaiž"). Sticky so it stays reachable at the viewport bottom
          while editing the long form; breaks out of the card's padding to sit flush
          with the card's bottom edge. Only shown when there are unsaved changes. */}
      {dirty && (
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex items-center justify-between gap-2 rounded-b-lg border-t bg-card px-4 py-2.5">
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(toDraft(values))} disabled={saving}>Discard</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save terms"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
