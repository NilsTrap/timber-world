"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, Loader2, Boxes, AlertTriangle } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import {
  getVariantStock, saveVariantStockEntry, deleteVariantStockEntry,
  type VariantStockSummary,
} from "../actions/stock";
import { getVariantPackaging, type VariantPackaging } from "../actions/packaging";

const fmtPcs = (n: number) => `${n.toLocaleString("en-GB")} pcs`;

/**
 * Manual per-variant stock, broken down by packaging form. You can only stock a
 * variant in a packaging form that's DEFINED for it (its packaging assignments) —
 * e.g. you can't stock firewood "in pieces" unless a piece-level packaging option
 * has been added. The Packaging card is where those options are defined; this card
 * says HOW MUCH is on hand in each. Quantities are inline-editable; total in pieces.
 */
export function VariantStockCard({
  variantId,
  initialSummary = null,
  initialPackaging = [],
  initialError = null,
}: {
  variantId: string;
  initialSummary?: VariantStockSummary | null;
  initialPackaging?: VariantPackaging[];
  initialError?: string | null;
}) {
  // Initial data is loaded server-side and passed in (see the P0 fix in the
  // route + VariantDetailPage) — no mount-time server-action round-trip, which
  // was the crash surface. `load()` still refreshes after mutations, resiliently.
  const [summary, setSummary] = useState<VariantStockSummary | null>(initialSummary);
  const [packaging, setPackaging] = useState<VariantPackaging[]>(initialPackaging);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [adding, setAdding] = useState(false);
  const [formPackaging, setFormPackaging] = useState<string>("");
  const [formQty, setFormQty] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, pk] = await Promise.all([getVariantStock(variantId), getVariantPackaging(variantId)]);
      if (s.success) { setSummary(s.data); setError(null); } else { setError(s.error); }
      if (pk.success) setPackaging(pk.data);
    } catch (e) {
      // A refresh failure must never take the page down — show it inline.
      setError(e instanceof Error ? e.message : "Failed to refresh stock");
    } finally {
      setLoading(false);
    }
  }, [variantId]);

  const entries = summary?.entries ?? [];
  const usedPackaging = new Set(entries.map((e) => e.packagingTypeId).filter(Boolean) as string[]);
  // Only packaging forms DEFINED for this variant (and not already stocked) can be added.
  const availableOptions = packaging
    .filter((p) => !usedPackaging.has(p.packagingTypeId))
    .map((p) => ({ id: p.packagingTypeId, name: p.name, piecesPerPackage: p.piecesPerPackage }));

  const saveQty = async (packagingTypeId: string | null, quantity: number) => {
    const res = await saveVariantStockEntry({ variantId, packagingTypeId, quantity });
    if (!res.success) { toast.error(res.error); return false; }
    await load();
    return true;
  };

  const handleAdd = async () => {
    const qty = Number(formQty);
    if (!formPackaging) { toast.error("Pick a packaging form"); return; }
    if (!Number.isFinite(qty) || qty < 0) { toast.error("Enter a valid quantity"); return; }
    setSaving(true);
    const ok = await saveQty(formPackaging, qty);
    setSaving(false);
    if (ok) { toast.success("Stock added"); setAdding(false); setFormQty(""); setFormPackaging(""); }
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
          <Button size="sm" variant="outline" onClick={() => { setFormPackaging(availableOptions[0]?.id ?? ""); setAdding(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add stock
          </Button>
        )}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>Couldn&apos;t load stock. {error}</p>
            <button onClick={() => load()} className="mt-1 underline text-xs" disabled={loading}>
              {loading ? "Retrying…" : "Retry"}
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : packaging.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No packaging options defined for this variant. Add packaging forms in the Packaging card below before recording stock.
        </p>
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
                <option key={o.id} value={o.id}>{o.name} (×{o.piecesPerPackage})</option>
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
