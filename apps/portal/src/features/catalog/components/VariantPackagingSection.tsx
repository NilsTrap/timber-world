"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { getVariantPackaging, assignVariantPackaging, removeVariantPackaging, type VariantPackaging } from "../actions/packaging";
import { getPackagingTypes } from "../actions/packagingTypes";
import type { PackagingType } from "../actions/packagingTypes";

export function VariantPackagingSection({ variantId }: { variantId: string }) {
  const [assigned, setAssigned] = useState<VariantPackaging[]>([]);
  const [types, setTypes] = useState<PackagingType[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getVariantPackaging(variantId), getPackagingTypes()]).then(([a, t]) => {
      if (a.success) setAssigned(a.data);
      if (t.success) setTypes(t.data.filter((x) => x.isActive));
      setLoaded(true);
    });
  }, [variantId]);

  const assignedTypeIds = new Set(assigned.map((a) => a.packagingTypeId));
  const available = types.filter((t) => !assignedTypeIds.has(t.id));

  const resetForm = () => { setTypeId(""); setPriceOverride(""); setIsDefault(false); setShowForm(false); };

  const handleAdd = async () => {
    if (!typeId) { toast.error("Pick a packaging type"); return; }
    setSaving(true);
    const result = await assignVariantPackaging({
      variantId,
      packagingTypeId: typeId,
      priceOverrideCents: priceOverride ? Math.round(Number(priceOverride) * 100) : null,
      isDefault: isDefault || assigned.length === 0,
    });
    setSaving(false);
    if (result.success) {
      // refresh (default flag may have changed others)
      const refreshed = await getVariantPackaging(variantId);
      if (refreshed.success) setAssigned(refreshed.data);
      resetForm();
      toast.success("Packaging added");
    } else {
      toast.error(result.error);
    }
  };

  const handleRemove = async (id: string) => {
    const result = await removeVariantPackaging(id);
    if (result.success) {
      setAssigned(assigned.filter((a) => a.id !== id));
      toast.success("Packaging removed");
    } else {
      toast.error(result.error);
    }
  };

  if (!loaded) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Packaging ({assigned.length})</h4>
        {!showForm && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(true)} disabled={available.length === 0}>
            <Plus className="h-3 w-3 mr-1" /> Add Packaging
          </Button>
        )}
      </div>

      {assigned.map((a) => (
        <div key={a.id} className="flex items-center gap-3 text-sm rounded border px-3 py-2">
          <span className="font-medium">{a.name}</span>
          <span className="text-muted-foreground">{a.piecesPerPackage} pcs</span>
          {a.priceOverrideCents != null && <span className="text-green-700 font-medium">€{(a.priceOverrideCents / 100).toFixed(2)} (override)</span>}
          {a.isDefault && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Default</span>}
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemove(a.id)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ))}

      {loaded && assigned.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">No packaging assigned. Pick from the global packaging types.</p>
      )}

      {showForm && (
        <div className="rounded border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold">Add Packaging</h5>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetForm}><X className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium">Packaging type</label>
              <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">— select —</option>
                {available.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.piecesPerPackage} pcs)</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Price override (€, optional)</label>
              <Input type="number" step="0.01" value={priceOverride} onChange={(e) => setPriceOverride(e.target.value)} className="h-8 text-sm" placeholder="leave blank for none" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer h-8">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Default packaging
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={saving || !typeId}>{saving ? "Adding..." : "Add"}</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      {available.length === 0 && types.length > 0 && assigned.length > 0 && !showForm && (
        <p className="text-xs text-muted-foreground">All packaging types are assigned. Manage the list under Catalog → Packaging.</p>
      )}
    </div>
  );
}
