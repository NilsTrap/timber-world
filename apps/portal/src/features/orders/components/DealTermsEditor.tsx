"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus, UserPen } from "lucide-react";
import {
  Button, Input, Textarea, Label,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Popover, PopoverTrigger, PopoverContent,
} from "@timber/ui";
import { updateDealTerms, type DealTermsInput } from "../actions/dealActions";
import { getFieldOptions, type FieldOptionChoice } from "../actions/getFieldOptions";
import { getDealPartyAddresses } from "../actions/getDealPartyAddresses";
import { getDealSigneeContext } from "../actions/getDealSigneeContext";
import { getCurrencies } from "@/features/catalog/actions/currencies";
import { listOrgContacts, createOrgContact } from "@/features/counterparties/actions/orgContacts";
import type { OrgContactRow } from "@/features/counterparties/contactTypes";

/** R9 · one side's signee context (party org + its G3 default signee), fetched
 *  from getDealSigneeContext. Mirrors that action's per-side return shape. */
interface SigneeParty {
  orgId: string | null;
  orgName: string | null;
  defaultSigneeName: string | null;
  defaultSigneeRole: string | null;
}

/** R7 · fallback currency list when getCurrencies is unavailable (a deal_terms
 *  editor without catalogue.view) — the active set today; the CHECK allows USD too. */
const FALLBACK_CURRENCIES = [
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
];

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
  /** R7 · the deal currency (EUR/GBP/…). */
  currency: string | null;
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
    currency: v.currency ?? "EUR",
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
  currencyEditable = false,
}: {
  orderId: string;
  values: DealTermsValues;
  sellerName: string | null;
  buyerName: string | null;
  /** R7 · the currency Select is live only while the deal is Draft (changing it
   *  after lines are priced would be inconsistent); past Draft it's a read-only chip.
   *  The service re-checks server-side. */
  currencyEditable?: boolean;
  /** Kept for API compatibility with DealPanel. R4 autosaves per field and does
   *  NOT reload the parent on every keystroke — a reload would clobber in-progress
   *  edits in other fields — so this is intentionally not invoked. */
  onSaved?: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(values));
  const [incotermsOptions, setIncotermsOptions] = useState<FieldOptionChoice[]>([]);
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<FieldOptionChoice[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<{ code: string; name: string }[]>(FALLBACK_CURRENCIES);
  // R9 · seller/buyer party org + its default signee, driving the contact picker.
  const [signeeCtx, setSigneeCtx] = useState<{ seller: SigneeParty; buyer: SigneeParty } | null>(null);
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
    // R9 · party org ids + G3 default signees for the signee picker.
    getDealSigneeContext(orderId).then((res) => { if (alive && res.success) setSigneeCtx(res.data); });
    // R7 · currency options from the catalog (active only). Falls back to the
    // hardcoded set when the viewer lacks catalogue.view (getCurrencies FORBIDDEN).
    getCurrencies().then((res) => {
      if (!alive || !res.success) return;
      const active = res.data.filter((c) => c.isActive).map((c) => ({ code: c.code, name: c.name }));
      if (active.length > 0) setCurrencyOptions(active);
    });
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

  // R7 · currency is not a text field — save it immediately on select. Optimistic;
  // the service enforces Draft-only + active-currency (a rejection reverts + toasts).
  const saveCurrency = async (code: string) => {
    if (savedRef.current.currency === code) return;
    const prev = savedRef.current.currency;
    set("currency", code);
    const res = await updateDealTerms({ orderId, terms: { currency: code } });
    if (!res.success) {
      toast.error(res.error);
      setDraft((p) => ({ ...p, currency: prev }));
      return;
    }
    savedRef.current = { ...savedRef.current, currency: code };
  };

  // R9 · write BOTH per-deal signee override columns for one side in a single
  // updateDealTerms call (from a chosen CRM contact, or null to fall back to the
  // org default). Same field-wall + optimistic-revert pattern as saveField. Passing
  // null/"" clears the override so documents render the org default again.
  const saveSignee = async (side: "seller" | "buyer", name: string | null, role: string | null): Promise<boolean> => {
    const nameKey: keyof Draft = side === "seller" ? "sellerSigneeName" : "buyerSigneeName";
    const roleKey: keyof Draft = side === "seller" ? "sellerSigneeRole" : "buyerSigneeRole";
    const nameVal = (name ?? "").trim();
    const roleVal = (role ?? "").trim();
    const prevName = savedRef.current[nameKey];
    const prevRole = savedRef.current[roleKey];
    if (prevName === nameVal && prevRole === roleVal) return true;
    setDraft((p) => ({ ...p, [nameKey]: nameVal, [roleKey]: roleVal }));
    const terms: DealTermsInput = side === "seller"
      ? { sellerSigneeName: nn(nameVal), sellerSigneeRole: nn(roleVal) }
      : { buyerSigneeName: nn(nameVal), buyerSigneeRole: nn(roleVal) };
    const res = await updateDealTerms({ orderId, terms });
    if (!res.success) {
      toast.error(res.error);
      setDraft((p) => ({ ...p, [nameKey]: prevName, [roleKey]: prevRole }));
      return false;
    }
    savedRef.current = { ...savedRef.current, [nameKey]: nameVal, [roleKey]: roleVal };
    return true;
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
        {/* R7 · deal currency. Editable only while Draft (past Draft it's a chip) —
            changing currency after lines are priced would be inconsistent. */}
        <Field label="Currency">
          {currencyEditable ? (
            <Select value={draft.currency || "EUR"} onValueChange={(v) => void saveCurrency(v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencyOptions.map((o) => <SelectItem key={o.code} value={o.code}>{o.code} — {o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <span className="inline-flex h-8 items-center rounded-md border bg-muted/40 px-2 text-sm font-medium" title="Currency locks after Draft">
              {draft.currency || "EUR"}
            </span>
          )}
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

      {/* R9 · signee = a person from the party org's CRM contacts. Auto-shows the
          org's default signee; "Change" picks another contact (or quick-adds one)
          which writes the per-deal seller_/buyer_signee_* override columns — the same
          storage documents resolve (deal override → org default). */}
      <div className="border-t pt-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Signatories (documents)</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SigneeField
            sideLabel="Seller"
            partyName={signeeCtx?.seller.orgName ?? sellerName}
            orgId={signeeCtx?.seller.orgId ?? null}
            overrideName={draft.sellerSigneeName}
            overrideRole={draft.sellerSigneeRole}
            orgDefaultName={signeeCtx?.seller.defaultSigneeName ?? null}
            orgDefaultRole={signeeCtx?.seller.defaultSigneeRole ?? null}
            onSelect={(n, r) => saveSignee("seller", n, r)}
          />
          <SigneeField
            sideLabel="Buyer"
            partyName={signeeCtx?.buyer.orgName ?? buyerName}
            orgId={signeeCtx?.buyer.orgId ?? null}
            overrideName={draft.buyerSigneeName}
            overrideRole={draft.buyerSigneeRole}
            orgDefaultName={signeeCtx?.buyer.defaultSigneeName ?? null}
            orgDefaultRole={signeeCtx?.buyer.defaultSigneeRole ?? null}
            onSelect={(n, r) => saveSignee("buyer", n, r)}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * R9 · one side's signee, driven by CRM contacts. Shows the effective signee
 * (per-deal override → org default → none), a "Change" popover that lists the
 * party org's contacts (listOrgContacts) and quick-adds one (createOrgContact),
 * and a "use org default" clear. Selecting a contact / clearing writes the per-deal
 * override columns via onSelect (name, role); passing null clears back to the org
 * default. A K1 book-wall refusal (e.g. a non-admin on a trader/seller org) is shown
 * cleanly — the list is hidden / quick-add disabled — never a crash.
 */
function SigneeField({
  sideLabel, partyName, orgId,
  overrideName, overrideRole, orgDefaultName, orgDefaultRole, onSelect,
}: {
  sideLabel: string;
  partyName: string | null;
  orgId: string | null;
  overrideName: string;
  overrideRole: string;
  orgDefaultName: string | null;
  orgDefaultRole: string | null;
  onSelect: (name: string | null, role: string | null) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<OrgContactRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Quick-add form
  const [adding, setAdding] = useState(false);
  const [qa, setQa] = useState({ name: "", role: "", email: "", phone: "" });
  const [addError, setAddError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const hasOverride = overrideName.trim() !== "";
  const effName = hasOverride ? overrideName : (orgDefaultName ?? "");
  const effRole = hasOverride ? overrideRole : (orgDefaultRole ?? "");
  const source = hasOverride ? "chosen contact" : (orgDefaultName ? "org default" : null);

  const loadContacts = async () => {
    if (!orgId) return;
    setLoadingList(true);
    setListError(null);
    const res = await listOrgContacts(orgId);
    setLoadingList(false);
    if (!res.success) {
      // Graceful K1 book-wall refusal — list stays empty, message shown.
      setContacts([]);
      setListError(res.error || "You can't view this organisation's contacts.");
      return;
    }
    setContacts(res.data);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setAdding(false);
      setAddError(null);
      setQa({ name: "", role: "", email: "", phone: "" });
      void loadContacts();
    }
  };

  const pick = async (name: string, role: string | null) => {
    setSaving(true);
    const ok = await onSelect(name, role);
    setSaving(false);
    if (ok) setOpen(false);
  };

  const clearToDefault = async () => {
    setSaving(true);
    const ok = await onSelect(null, null);
    setSaving(false);
    if (ok) setOpen(false);
  };

  const submitQuickAdd = async () => {
    if (!orgId) return;
    const name = qa.name.trim();
    if (!name) { setAddError("Name is required."); return; }
    setCreating(true);
    setAddError(null);
    const res = await createOrgContact(orgId, {
      name,
      roleTitle: qa.role.trim() || null,
      email: qa.email.trim() || null,
      phone: qa.phone.trim() || null,
    });
    if (!res.success) {
      setCreating(false);
      // FORBIDDEN on a walled org (e.g. a non-admin adding to a trader/seller org).
      setAddError(
        res.code === "FORBIDDEN"
          ? "You can't add contacts to this organisation — ask an admin."
          : (res.error || "Couldn't add the contact."),
      );
      return;
    }
    setContacts((prev) => [res.data, ...prev]);
    const ok = await onSelect(res.data.name, res.data.roleTitle);
    setCreating(false);
    if (ok) { setAdding(false); setOpen(false); }
  };

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">
        {sideLabel} signee{partyName ? ` — ${partyName}` : ""}
      </label>
      <div className="flex items-start justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5">
        <div className="min-w-0">
          {effName ? (
            <>
              <p className="truncate text-sm font-medium">{effName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {effRole || "—"}
                {source && <span className="ml-1 text-muted-foreground/70">· {source}</span>}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Not set — blank on documents unless a signee is chosen.</p>
          )}
        </div>
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button" variant="outline" size="sm" className="h-7 shrink-0"
              disabled={!orgId}
              title={orgId ? "Pick a signee from this organisation's contacts" : "Set the party first"}
            >
              <UserPen className="h-3.5 w-3.5" /> Change
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b px-3 py-2">
              <p className="text-xs font-medium">{sideLabel} signee — {partyName ?? "organisation"}</p>
            </div>

            {/* Contact list */}
            <div className="max-h-56 overflow-y-auto">
              {loadingList ? (
                <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading contacts…
                </div>
              ) : listError ? (
                <p className="px-3 py-3 text-xs text-amber-600 dark:text-amber-500">{listError}</p>
              ) : contacts.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground">No contacts yet for this organisation.</p>
              ) : (
                contacts.map((c) => {
                  const selected = hasOverride && c.name === overrideName && (c.roleTitle ?? "") === overrideRole;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={saving}
                      onClick={() => void pick(c.name, c.roleTitle)}
                      className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left hover:bg-muted/60 disabled:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <span className="truncate">{c.name}</span>
                          {c.isPrimary && <span className="rounded bg-primary/10 px-1 text-[10px] text-primary">primary</span>}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[c.roleTitle, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </span>
                      {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Quick-add + clear */}
            <div className="border-t p-3">
              {adding ? (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Name *</Label>
                    <Input className="h-8" value={qa.name} onChange={(e) => setQa((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" autoFocus />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input className="h-8" value={qa.role} onChange={(e) => setQa((p) => ({ ...p, role: e.target.value }))} placeholder="Role" />
                    <Input className="h-8" value={qa.phone} onChange={(e) => setQa((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" />
                  </div>
                  <Input className="h-8" type="email" value={qa.email} onChange={(e) => setQa((p) => ({ ...p, email: e.target.value }))} placeholder="Email" />
                  {addError && <p className="text-xs text-amber-600 dark:text-amber-500">{addError}</p>}
                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setAddError(null); }} disabled={creating}>Cancel</Button>
                    <Button type="button" size="sm" onClick={() => void submitQuickAdd()} disabled={creating}>
                      {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add & select
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setAdding(true); setAddError(null); }}>
                    <Plus className="h-3.5 w-3.5" /> New contact
                  </Button>
                  {hasOverride && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => void clearToDefault()} disabled={saving}>
                      Use org default
                    </Button>
                  )}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
