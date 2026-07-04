"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Input, Textarea,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@timber/ui";
import { updateDealTerms, type DealTermsInput } from "../actions/dealActions";
import { getFieldOptions, type FieldOptionChoice } from "../actions/getFieldOptions";
import { getDealPartyAddresses } from "../actions/getDealPartyAddresses";

/** Radix Select forbids an empty-string item value, so a sentinel represents
 *  "no incoterms" and is mapped back to "" on save. */
const INCOTERMS_NONE = "__none";
/** Same sentinel trick for the R3 Payment terms dropdown (admin-managed field). */
const PAYMENT_TERMS_NONE = "__none";

/**
 * R2 · Which party's address pre-fills the incoterms place for a given incoterm:
 * seller-side terms (EXW/FCA/FAS/FOB) → the seller's address; destination terms
 * (CPT/CIP/CFR/CIF + DAP/DPU/DDP) → the buyer's address (named destination default
 * = buyer). Unknown code → no auto-fill.
 */
function placePartyForIncoterm(incoterm: string): "seller" | "buyer" | null {
  const c = incoterm.trim().toUpperCase();
  if (["EXW", "FCA", "FAS", "FOB"].includes(c)) return "seller";
  if (["CPT", "CIP", "CFR", "CIF", "DAP", "DPU", "DDP"].includes(c)) return "buyer";
  return null;
}
/** A stored delivery deadline in ISO yyyy-mm-dd drives the calendar input; any
 *  other (legacy free-text) value falls back to a plain text input. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * G2/H2 · Deal-terms editor — INLINE + AUTOSAVING (R4: no Save button). Each
 * commercial term that feeds a generated quotation/contract (incoterms + place,
 * payment terms, deadline, notes) + per-deal signee overrides (G3) persists on
 * its own: selects/date on change, text on blur/Enter (debounced while typing).
 * Every write goes through the same updateDealTerms action (advance_pct is derived
 * from the payment term server-side, R3). Optimistic; a failed field reverts and
 * toasts. Rendered by DealPanel only when the deal_terms field-wall allows editing;
 * the action re-checks server-side.
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

/** The deal-term fields that autosave (advance_pct is derived server-side from the
 *  payment term; delivery_terms is no longer edited here). */
type SavableKey =
  | "incoterms" | "incotermsPlace" | "paymentTerms" | "deliveryDeadline" | "notes"
  | "sellerSigneeName" | "sellerSigneeRole" | "buyerSigneeName" | "buyerSigneeRole";

export function DealTermsEditor({
  orderId,
  values,
  sellerName,
  buyerName,
}: {
  orderId: string;
  values: DealTermsValues;
  sellerName: string | null;
  buyerName: string | null;
  /** Kept for API compatibility with DealPanel. R4 autosaves per field and does
   *  NOT reload the parent on every keystroke — a reload would clobber in-progress
   *  edits in other fields — so this is intentionally not invoked. */
  onSaved?: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(values));
  const [incotermsOptions, setIncotermsOptions] = useState<FieldOptionChoice[]>([]);
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<FieldOptionChoice[]>([]);
  const [deadlineTextMode, setDeadlineTextMode] = useState(() => {
    const dd = (values.deliveryDeadline ?? "").trim();
    return dd !== "" && !ISO_DATE_RE.test(dd);
  });
  // R2 · seller/buyer addresses for the incoterms-place auto-fill, plus a ref
  // recording the LAST value we auto-filled so a manual edit is never clobbered.
  const [partyAddresses, setPartyAddresses] = useState<{ seller: string | null; buyer: string | null } | null>(null);
  const lastAutoPlace = useRef<string>("");
  // R4 · the last PERSISTED draft (for skip-if-unchanged + revert-on-error) and the
  // per-field debounce timers. The draft is the editor's source of truth — we never
  // re-sync it from `values` after mount (autosave keeps the DB in step), so a
  // background reload of the deal can't clobber an in-progress edit.
  const savedRef = useRef<Draft>(toDraft(values));
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let alive = true;
    getFieldOptions("incoterms").then((res) => { if (alive && res.success) setIncotermsOptions(res.data); });
    getFieldOptions("payment_terms").then((res) => { if (alive && res.success) setPaymentTermsOptions(res.data); });
    getDealPartyAddresses(orderId).then((res) => { if (alive && res.success) setPartyAddresses(res.data); });
    return () => { alive = false; };
  }, [orderId]);

  // Clear any pending debounce timers on unmount so a fired timer can't update an
  // unmounted component.
  useEffect(() => {
    const t = timers.current;
    return () => { for (const id of Object.values(t)) clearTimeout(id); };
  }, []);

  const set = (k: keyof Draft, v: string) => setDraft((p) => ({ ...p, [k]: v }));

  // R4 · persist ONE field through updateDealTerms (same field-wall gate; server
  // derives advance_pct when payment_terms is the field). Skips a no-op; on failure
  // reverts the field to its last saved value and toasts.
  const saveField = async (key: SavableKey, rawValue: string) => {
    if (savedRef.current[key] === rawValue) return;
    const terms: DealTermsInput = {};
    terms[key] = nn(rawValue);
    const res = await updateDealTerms({ orderId, terms });
    if (!res.success) {
      toast.error(res.error);
      const prev = savedRef.current[key];
      setDraft((p) => ({ ...p, [key]: prev }));
      return;
    }
    savedRef.current = { ...savedRef.current, [key]: rawValue };
  };

  const clearTimer = (key: SavableKey) => {
    const id = timers.current[key];
    if (id) { clearTimeout(id); delete timers.current[key]; }
  };
  /** Debounced autosave for text fields (fires ~600ms after the last keystroke). */
  const debouncedSave = (key: SavableKey, value: string) => {
    clearTimer(key);
    timers.current[key] = setTimeout(() => { delete timers.current[key]; void saveField(key, value); }, 600);
  };
  /** Immediate autosave (blur / Enter / select / date), cancelling any debounce. */
  const flushSave = (key: SavableKey, value: string) => {
    clearTimer(key);
    void saveField(key, value);
  };

  // Shared handler props for a debounced text Input / Textarea.
  const inputAutosave = (key: SavableKey) => ({
    value: draft[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => { set(key, e.target.value); debouncedSave(key, e.target.value); },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => flushSave(key, e.target.value),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") e.currentTarget.blur(); },
  });

  // R2 · pre-fill the incoterms place from the correct party's address when the
  // incoterm changes; returns the filled value so the caller can persist it too.
  // Never clobbers a manual edit: fills only when the place is empty or still
  // equals the value WE last auto-filled.
  const autofillIncotermsPlace = (incoterm: string): string | null => {
    if (!incoterm || !partyAddresses) return null;
    const party = placePartyForIncoterm(incoterm);
    if (!party) return null;
    const addr = party === "seller" ? partyAddresses.seller : partyAddresses.buyer;
    if (!addr) return null; // no address on file → leave the place as-is
    const cur = draft.incotermsPlace.trim();
    if (cur !== "" && cur !== lastAutoPlace.current.trim()) return null;
    lastAutoPlace.current = addr;
    setDraft((prev) => ({ ...prev, incotermsPlace: addr }));
    return addr;
  };

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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
        <Field label="Incoterms">
          <Select
            value={draft.incoterms.trim() === "" ? INCOTERMS_NONE : draft.incoterms}
            onValueChange={(v) => {
              const code = v === INCOTERMS_NONE ? "" : v;
              set("incoterms", code);
              flushSave("incoterms", code);
              const filled = autofillIncotermsPlace(code);
              if (filled != null) flushSave("incotermsPlace", filled);
            }}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={INCOTERMS_NONE}>—</SelectItem>
              {incotermsChoices.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Incoterms place">
          <Input className="h-8" {...inputAutosave("incotermsPlace")} placeholder="e.g. Riga" />
        </Field>

        <Field label="Delivery deadline">
          {deadlineTextMode ? (
            <>
              <Input className="h-8" {...inputAutosave("deliveryDeadline")} placeholder="e.g. week 34" />
              <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => { set("deliveryDeadline", ""); setDeadlineTextMode(false); flushSave("deliveryDeadline", ""); }}>Pick a date instead</button>
            </>
          ) : (
            <>
              <Input className="h-8" type="date" value={draft.deliveryDeadline} onChange={(e) => { set("deliveryDeadline", e.target.value); flushSave("deliveryDeadline", e.target.value); }} />
              <button type="button" className="text-[11px] text-muted-foreground hover:underline" onClick={() => setDeadlineTextMode(true)}>Enter free text instead</button>
            </>
          )}
        </Field>
        <Field label="Payment terms">
          <Select
            value={draft.paymentTerms.trim() === "" ? PAYMENT_TERMS_NONE : draft.paymentTerms}
            onValueChange={(v) => { const val = v === PAYMENT_TERMS_NONE ? "" : v; set("paymentTerms", val); flushSave("paymentTerms", val); }}
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
        <Textarea
          value={draft.notes}
          onChange={(e) => { set("notes", e.target.value); debouncedSave("notes", e.target.value); }}
          onBlur={(e) => flushSave("notes", e.target.value)}
          rows={2} placeholder="Free-text notes shown on the generated documents"
        />
      </Field>

      <div className="border-t pt-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Signatories (documents)</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Field label={`Seller signee — name${sellerName ? ` (${sellerName})` : ""}`}>
            <Input className="h-8" {...inputAutosave("sellerSigneeName")} placeholder="Defaults from the org" />
          </Field>
          <Field label="Seller signee — role">
            <Input className="h-8" {...inputAutosave("sellerSigneeRole")} placeholder="e.g. Director" />
          </Field>
          <Field label={`Buyer signee — name${buyerName ? ` (${buyerName})` : ""}`}>
            <Input className="h-8" {...inputAutosave("buyerSigneeName")} placeholder="Defaults from the org" />
          </Field>
          <Field label="Buyer signee — role">
            <Input className="h-8" {...inputAutosave("buyerSigneeRole")} placeholder="e.g. Purchasing manager" />
          </Field>
        </div>
      </div>
    </div>
  );
}
