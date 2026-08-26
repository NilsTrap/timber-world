"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@timber/ui";
import { toast } from "sonner";
import type { ProjectTerms } from "../types";
import { getFieldOptions, type FieldOptionChoice } from "../../orders/actions/getFieldOptions";
import { updateDealTerms } from "../../orders/actions/dealActions";
import { parseAdvanceFromPaymentTerm } from "../../orders/services/paymentTerms";
import { formatDate } from "@/lib/utils";

const NONE = "__none";

export function ProjectTermsCard({ projectId, terms, deliveryDeadline, canEdit }: { projectId: string; terms: ProjectTerms; deliveryDeadline: string | null; canEdit: boolean }) {
  const initialValues = { incoterms: terms.incoterms ?? "", incotermsPlace: terms.incotermsPlace ?? "", paymentTerms: terms.paymentTerms ?? "", deliveryDeadline: deliveryDeadline ?? "", advancePct: terms.advancePct };
  const [values, setValues] = useState(initialValues);
  const saved = useRef(initialValues);
  const saveQueues = useRef<Record<string, Promise<void>>>({});
  const [incoterms, setIncoterms] = useState<FieldOptionChoice[]>([]);
  const [payments, setPayments] = useState<FieldOptionChoice[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getFieldOptions("incoterms"), getFieldOptions("payment_terms")]).then(([i, p]) => {
      if (!active) return;
      if (i.success) setIncoterms(i.data);
      if (p.success) setPayments(p.data);
    });
    return () => { active = false; };
  }, []);

  const incotermChoices = useMemo(() => includeCurrent(incoterms, values.incoterms), [incoterms, values.incoterms]);
  const paymentChoices = useMemo(() => includeCurrent(payments, values.paymentTerms), [payments, values.paymentTerms]);

  async function save(key: "incoterms" | "incotermsPlace" | "paymentTerms" | "deliveryDeadline", raw: string) {
    const value = raw.trim() || null;
    setSaving(key);
    const queued = (saveQueues.current[key] ?? Promise.resolve()).then(async () => {
      let result: Awaited<ReturnType<typeof updateDealTerms>>;
      try {
        result = await updateDealTerms({ orderId: projectId, terms: { [key]: value } });
      } catch {
        result = { success: false, error: "Could not update terms", code: "NETWORK_ERROR" };
      }
      if (!result.success) {
        setValues((current) => current[key] === raw ? ({ ...current, [key]: saved.current[key], ...(key === "paymentTerms" ? { advancePct: saved.current.advancePct } : {}) }) : current);
        toast.error(result.error);
        return;
      }
      const advancePct = key === "paymentTerms" ? parseAdvanceFromPaymentTerm(value) : saved.current.advancePct;
      saved.current = { ...saved.current, [key]: raw, advancePct };
      if (key === "paymentTerms") setValues((current) => ({ ...current, advancePct }));
      toast.success("Terms updated");
    });
    saveQueues.current[key] = queued;
    await queued;
    if (saveQueues.current[key] === queued) setSaving((current) => current === key ? null : current);
  }

  const summary = [[values.incoterms, values.incotermsPlace].filter(Boolean).join(" "), values.paymentTerms, formatOptionalDate(values.deliveryDeadline)].filter(Boolean).join(" · ") || "No terms set";

  return (
    <details className="group rounded-lg border bg-card" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div><h2 className="text-lg font-semibold">Terms</h2><p className="mt-0.5 text-sm text-muted-foreground">{summary}</p></div>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-4">
        <TermField label="Incoterms" saving={saving === "incoterms"}>
          {canEdit ? <Select value={values.incoterms || NONE} onValueChange={(v) => { const value = v === NONE ? "" : v; setValues((c) => ({ ...c, incoterms: value })); void save("incoterms", value); }}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value={NONE}>—</SelectItem>{incotermChoices.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select> : <ReadValue value={values.incoterms} />}
          {canEdit ? <Input className="mt-2" aria-label="Incoterms place" placeholder="Named place" value={values.incotermsPlace} onChange={(e) => setValues((c) => ({ ...c, incotermsPlace: e.target.value }))} onBlur={(e) => void save("incotermsPlace", e.target.value)} /> : values.incotermsPlace ? <p className="mt-1 text-xs text-muted-foreground">{values.incotermsPlace}</p> : null}
        </TermField>
        <TermField label="Payment" saving={saving === "paymentTerms"}>
          {canEdit ? <Select value={values.paymentTerms || NONE} onValueChange={(v) => { const value = v === NONE ? "" : v; setValues((c) => ({ ...c, paymentTerms: value })); void save("paymentTerms", value); }}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value={NONE}>—</SelectItem>{paymentChoices.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select> : <ReadValue value={values.paymentTerms} />}
        </TermField>
        <TermField label="Delivery" saving={saving === "deliveryDeadline"}>
          {canEdit ? <Input aria-label="Delivery deadline" placeholder="Date or delivery window" value={values.deliveryDeadline} onChange={(e) => setValues((c) => ({ ...c, deliveryDeadline: e.target.value }))} onBlur={(e) => void save("deliveryDeadline", e.target.value)} /> : <ReadValue value={formatOptionalDate(values.deliveryDeadline)} />}
        </TermField>
        <TermField label="Advance"><ReadValue value={values.advancePct == null ? "" : `${values.advancePct}%`} /><p className="mt-1 text-xs text-muted-foreground">Derived from payment terms</p></TermField>
      </div>
    </details>
  );
}

function includeCurrent(options: FieldOptionChoice[], current: string): FieldOptionChoice[] { return current && !options.some((o) => o.value === current) ? [...options, { value: current, label: `${current} (current)` }] : options; }
function formatOptionalDate(value: string): string { return value ? formatDate(value) : ""; }
function TermField({ label, saving = false, children }: { label: string; saving?: boolean; children: React.ReactNode }) { return <div className="min-w-0"><div className="mb-2 flex items-center gap-2"><p className="text-sm text-muted-foreground">{label}</p>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}</div>{children}</div>; }
function ReadValue({ value }: { value: string }) { return <p className="text-base font-semibold">{value || "—"}</p>; }
