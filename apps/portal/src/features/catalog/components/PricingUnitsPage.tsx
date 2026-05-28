"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, X, Ruler } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { savePricingUnit, deletePricingUnit } from "../actions/pricingUnits";
import type { PricingUnit, CalcMethod } from "../types";

const CALC_METHODS: { value: CalcMethod; label: string; hint: string }[] = [
  { value: "area", label: "Area", hint: "width × length" },
  { value: "volume", label: "Volume", hint: "width × length × thickness" },
  { value: "length", label: "Length", hint: "length only" },
  { value: "per_piece", label: "Per piece", hint: "quantity = 1" },
];

interface Props {
  units: PricingUnit[];
}

export function PricingUnitsPage({ units: initial }: Props) {
  const [units, setUnits] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [calcMethod, setCalcMethod] = useState<CalcMethod>("area");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCode(""); setName(""); setSymbol(""); setCalcMethod("area");
    setShowForm(false); setEditingId(null);
  };

  const startEdit = (u: PricingUnit) => {
    setEditingId(u.id);
    setCode(u.code); setName(u.name); setSymbol(u.symbol); setCalcMethod(u.calcMethod);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!code.trim() || !name.trim() || !symbol.trim()) {
      toast.error("Code, name and symbol are required");
      return;
    }
    setSaving(true);
    const result = await savePricingUnit({
      id: editingId ?? undefined,
      code: code.trim().toLowerCase().replace(/\s+/g, "_"),
      name: name.trim(),
      symbol: symbol.trim(),
      calcMethod,
      sortOrder: editingId ? undefined : units.length,
    });
    setSaving(false);
    if (result.success) {
      toast.success(editingId ? "Unit updated" : "Unit created");
      setUnits(editingId ? units.map((u) => u.id === editingId ? result.data : u) : [...units, result.data]);
      reset();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async (u: PricingUnit) => {
    if (!confirm(`Delete pricing unit "${u.name}"?`)) return;
    const result = await deletePricingUnit(u.id);
    if (result.success) {
      setUnits(units.filter((x) => x.id !== u.id));
      toast.success("Unit deleted");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pricing Units</h1>
          <p className="text-muted-foreground">Units a category can be priced in. The calculation method derives the billable quantity from a variant&apos;s dimensions.</p>
        </div>
        {!showForm && (
          <Button onClick={() => { reset(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Unit
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? "Edit Unit" : "New Unit"}</h3>
            <Button variant="ghost" size="icon" onClick={reset}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Code</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="m2" disabled={!!editingId} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Square meter" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Symbol</label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="m²" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Calculation</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={calcMethod} onChange={(e) => setCalcMethod(e.target.value as CalcMethod)}>
                {CALC_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label} ({m.hint})</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
            <Button variant="outline" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {units.map((u) => {
          const method = CALC_METHODS.find((m) => m.value === u.calcMethod);
          return (
            <div key={u.id} className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Ruler className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{u.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{u.symbol}</span>
                  <span className="text-xs text-muted-foreground font-mono">{u.code}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{method?.label} — {method?.hint}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(u)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(u)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
