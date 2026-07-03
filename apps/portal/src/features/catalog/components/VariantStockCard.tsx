"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Loader2, Boxes } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import {
  getVariantStock, saveVariantStockEntry, deleteVariantStockEntry,
  type VariantStockSummary,
} from "../actions/stock";
import { getPackagingTypes, type PackagingType } from "../actions/packagingTypes";

const LOOSE = "loose";
const fmtPcs = (n: number) => `${n.toLocaleString("en-GB")} pcs`;

/**
 * Manual per-variant stock, broken down by packaging form. Packaging *options*
 * (which forms the variant comes in + price) live in the Packaging card; this is
 * HOW MUCH is on hand in each form. Quantities are editable inline; the total is
 * rolled up in pieces.
 */
export function VariantStockCard({ variantId }: { variantId: string }) {
  const [summary, setSummary] = useState<VariantStockSummary | null>(null);
  const [packagingTypes, setPackagingTypes] = useState<PackagingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [formPackaging, setFormPackaging] = useState<string>(LOOSE);
  const [formQty, setFormQty] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [s, pt] = await Promise.all([getVariantStock(variantId), getPackagingTypes()]);
    if (s.success) setSummary(s.data);
    if (pt.success) setPackagingTypes(pt.data);
    setLoading(false);
  }, [variantId]);

  useEffect(() => { load(); }, [load]);

  const entries = summary?.entries ?? [];
  const usedPackaging = new Set(entries.map((e) => e.packagingTypeId ?? LOOSE));
  const availableOptions = [
    ...(usedPackaging.has(LOOSE) ? [] : [{ id: LOOSE, name: "Loose pieces", piecesPerPackage: null as number | null }]),
    ...packagingTypes.filter((p) => !usedPackaging.has(p.id)).map((p) => ({ id: p.id, name: p.name, piecesPerPackage: p.piecesPerPackage })),
  ];

  const saveQty = async (packagingTypeId: string | null, quantity: number) => {
    const res = await saveVariantStockEntry({ variantId, packagingTypeId, quantity });
    if (!res.success) { toast.error(res.error); return false; }
    await load();
    return true;
  };

  const handleAdd = async () => {
    const qty = Number(formQty);
    if (!Number.isFinite(qty) || qty < 0) { toast.error("Enter a valid quantity"); return; }
    setSaving(true);
    const ok = await saveQty(formPackaging === LOOSE ? null : formPackaging, qty);
    setSaving(false);
    if (ok) { toast.success("Stock added"); setAdding(false); setFormQty(""); setFormPackaging(LOOSE); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this stock line? This cannot be undone.")) return;
    const res = await deleteVariantStockEntry(id);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Removed");
    await load();
  };

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-1.5">
          <Boxes className="h-4 w-4 text-muted-foreground" />
          Stock {summary && <span className="text-muted-foreground font-normal">· {fmtPcs(summary.totalPieces)}</span>}
        </h2>
        {availableOptions.length > 0 && !adding && (
          <Button size="sm" variant="outline" onClick={() => { setFormPackaging(availableOptions[0]?.id ?? LOOSE); setAdding(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add stock
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No stock recorded. Add how many are on hand in each packaging form.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left font-medium py-1">Packaging</th>
              <th className="text-right font-medium py-1 w-24">Qty</th>
              <th className="text-right font-medium py-1 w-24">Pieces</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="py-1.5">
                  {e.packagingName ?? "Loose pieces"}
                  {e.piecesPerPackage != null && <span className="text-xs text-muted-foreground"> ×{e.piecesPerPackage}</span>}
                </td>
                <td className="py-1 text-right">
                  <Input
                    type="number" min="0" defaultValue={e.quantity}
                    className="h-7 w-20 text-sm text-right ml-auto"
                    onBlur={(ev) => {
                      const v = Number(ev.target.value);
                      if (Number.isFinite(v) && v >= 0 && v !== e.quantity) saveQty(e.packagingTypeId, v);
                    }}
                  />
                </td>
                <td className="py-1.5 text-right tabular-nums">{fmtPcs(e.pieces)}</td>
                <td className="py-1 text-right">
                  <button onClick={() => handleDelete(e.id)} className="p-1 rounded hover:bg-muted" title="Remove stock line">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </td>
              </tr>
            ))}
            {entries.length > 0 && (
              <tr className="font-medium">
                <td className="py-1.5" colSpan={2}>Total on hand</td>
                <td className="py-1.5 text-right tabular-nums">{fmtPcs(summary?.totalPieces ?? 0)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      )}

      {adding && (
        <div className="flex items-end gap-2 rounded-md border bg-muted/20 p-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium">Packaging form</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={formPackaging}
              onChange={(e) => setFormPackaging(e.target.value)}
            >
              {availableOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}{o.piecesPerPackage != null ? ` (×${o.piecesPerPackage})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24 space-y-1">
            <label className="text-xs font-medium">Qty</label>
            <Input type="number" min="0" value={formQty} onChange={(e) => setFormQty(e.target.value)} className="h-9 text-sm" autoFocus />
          </div>
          <Button size="sm" className="h-9" onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
          <Button size="sm" variant="ghost" className="h-9" onClick={() => { setAdding(false); setFormQty(""); }}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
