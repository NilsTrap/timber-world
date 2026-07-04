"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, Hash } from "lucide-react";
import { Button, Input } from "@timber/ui";
import type { OrderExternalRef, OrderExternalRefType } from "../services/dealModel";
import {
  CUSTOMER_ORDER_NO_REF_TYPE, SUPPLIER_ORDER_NO_REF_TYPE,
  CUSTOMER_ORDER_NO_LABEL, SUPPLIER_ORDER_NO_LABEL,
} from "../services/partyOrderNumbers";
import { setDealReferences } from "../actions/dealActions";

/** Display label for an extra ref whose row carries no explicit label. */
function extraTypeLabel(refType: OrderExternalRefType): string {
  switch (refType) {
    case "client_project": return "Client project";
    case "client_job": return "Client job";
    case "client_po": return "Client PO";
    default: return "Reference";
  }
}

type ExtraRow = { key: string; refType: OrderExternalRefType; label: string; value: string };

const CANONICAL = new Set<OrderExternalRefType>([CUSTOMER_ORDER_NO_REF_TYPE, SUPPLIER_ORDER_NO_REF_TYPE, "other"]);

/**
 * N3 · A deal's References editor — its OWN small card (deliberately not folded
 * into the Terms card). Edits the two canonical party order numbers (Customer /
 * Supplier order no.) + free extra refs. Same edit gate as deal terms.
 */
export function DealReferencesCard({
  orderId, refs, canEdit, onSaved,
}: {
  orderId: string;
  refs: OrderExternalRef[];
  canEdit: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const customerRef = refs.find((r) => r.refType === CUSTOMER_ORDER_NO_REF_TYPE)?.refValue ?? "";
  const supplierRef = refs.find((r) => r.refType === SUPPLIER_ORDER_NO_REF_TYPE)?.refValue ?? "";
  const extras = refs.filter((r) => !CANONICAL.has(r.refType));

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerOrderNo, setCustomerOrderNo] = useState(customerRef);
  const [supplierOrderNo, setSupplierOrderNo] = useState(supplierRef);
  const [extraRows, setExtraRows] = useState<ExtraRow[]>([]);

  const startEdit = () => {
    setCustomerOrderNo(customerRef);
    setSupplierOrderNo(supplierRef);
    setExtraRows(extras.map((r, i) => ({
      key: r.id ?? `x${i}`,
      refType: r.refType,
      label: r.label ?? extraTypeLabel(r.refType),
      value: r.refValue,
    })));
    setEditing(true);
  };

  const addExtra = () =>
    setExtraRows((rows) => [...rows, { key: `new-${Date.now()}-${rows.length}`, refType: "custom", label: "", value: "" }]);
  const removeExtra = (key: string) => setExtraRows((rows) => rows.filter((r) => r.key !== key));
  const setExtra = (key: string, field: "label" | "value", v: string) =>
    setExtraRows((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: v } : r)));

  const save = async () => {
    setSaving(true);
    const next: OrderExternalRef[] = [];
    if (customerOrderNo.trim() !== "")
      next.push({ refType: CUSTOMER_ORDER_NO_REF_TYPE, refValue: customerOrderNo.trim(), label: CUSTOMER_ORDER_NO_LABEL });
    if (supplierOrderNo.trim() !== "")
      next.push({ refType: SUPPLIER_ORDER_NO_REF_TYPE, refValue: supplierOrderNo.trim(), label: SUPPLIER_ORDER_NO_LABEL });
    for (const r of extraRows) {
      if (r.value.trim() === "") continue;
      next.push({ refType: r.refType, refValue: r.value.trim(), label: r.label.trim() || null });
    }
    const res = await setDealReferences({ orderId, refs: next });
    setSaving(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("References saved");
    setEditing(false);
    await onSaved();
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Hash className="h-4 w-4 text-muted-foreground" />References
        </h3>
        {canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={startEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{CUSTOMER_ORDER_NO_LABEL}</span>
              <Input value={customerOrderNo} onChange={(e) => setCustomerOrderNo(e.target.value)} placeholder="e.g. PO-10432" className="h-8 text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{SUPPLIER_ORDER_NO_LABEL}</span>
              <Input value={supplierOrderNo} onChange={(e) => setSupplierOrderNo(e.target.value)} placeholder="e.g. SO-88120" className="h-8 text-sm" />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Additional references</span>
            {extraRows.length === 0 && <p className="text-xs text-muted-foreground">None.</p>}
            {extraRows.map((r) => (
              <div key={r.key} className="flex items-center gap-2">
                <Input value={r.label} onChange={(e) => setExtra(r.key, "label", e.target.value)} placeholder="Label" className="h-8 w-40 text-sm" />
                <Input value={r.value} onChange={(e) => setExtra(r.key, "value", e.target.value)} placeholder="Value" className="h-8 flex-1 text-sm" />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => removeExtra(r.key)} aria-label="Remove reference">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addExtra}><Plus className="h-3.5 w-3.5" /> Add reference</Button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save references"}
            </Button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex flex-col">
            <dt className="text-muted-foreground text-xs">{CUSTOMER_ORDER_NO_LABEL}</dt>
            <dd className="font-medium">{customerRef || "—"}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-muted-foreground text-xs">{SUPPLIER_ORDER_NO_LABEL}</dt>
            <dd className="font-medium">{supplierRef || "—"}</dd>
          </div>
          {extras.map((r, i) => (
            <div key={r.id ?? `x${i}`} className="flex flex-col">
              <dt className="text-muted-foreground text-xs">{r.label ?? extraTypeLabel(r.refType)}</dt>
              <dd className="font-medium">{r.refValue}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
