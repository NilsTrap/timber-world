"use client";

import { useState } from "react";
import { Plus, Trash2, X, RefreshCw, Coins, Settings2 } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { saveCurrency, deleteCurrency, updateCurrencyPrices } from "../actions/currencies";
import { applyCharmRounding } from "../charmRounding";
import type { CatalogCurrency, RoundingRule, RoundingBand } from "../types";

interface Props {
  currencies: CatalogCurrency[];
}

const PREVIEW_VALUES = [4.2, 8.5, 17.3, 43.2, 88, 117, 250, 999];

export function CurrenciesPage({ currencies: initial }: Props) {
  const [currencies, setCurrencies] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newCode.trim() || !newName.trim() || !newSymbol.trim()) { toast.error("Code, name and symbol required"); return; }
    setBusy("add");
    const result = await saveCurrency({ code: newCode, name: newName.trim(), symbol: newSymbol.trim(), sortOrder: currencies.length });
    setBusy(null);
    if (result.success) {
      setCurrencies([...currencies.filter((c) => c.code !== result.data.code), result.data]);
      setNewCode(""); setNewName(""); setNewSymbol(""); setShowAdd(false);
      toast.success("Currency added");
    } else { toast.error(result.error); }
  };

  const handleUpdate = async (c: CatalogCurrency) => {
    setBusy(c.code);
    const result = await updateCurrencyPrices(c.code);
    setBusy(null);
    if (result.success) {
      toast.success(`Rate 1 EUR = ${result.data.rate} ${c.code}. Updated ${result.data.updated} prices.`);
      setCurrencies(currencies.map((x) => x.code === c.code ? { ...x, exchangeRate: result.data.rate, rateFetchedAt: result.data.fetchedAt, rateSource: "ecb" } : x));
    } else { toast.error(result.error); }
  };

  const handleDelete = async (c: CatalogCurrency) => {
    if (!confirm(`Delete currency ${c.code}? Its converted prices will be removed.`)) return;
    const result = await deleteCurrency(c.code);
    if (result.success) { setCurrencies(currencies.filter((x) => x.code !== c.code)); toast.success("Currency deleted"); }
    else { toast.error(result.error); }
  };

  const handleSaveRule = async (c: CatalogCurrency, rule: RoundingRule) => {
    const result = await saveCurrency({ code: c.code, name: c.name, symbol: c.symbol, roundingRule: rule, isActive: c.isActive, sortOrder: c.sortOrder });
    if (result.success) {
      setCurrencies(currencies.map((x) => x.code === c.code ? result.data : x));
      setEditingRule(null);
      toast.success("Rounding rule saved");
    } else { toast.error(result.error); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Currencies</h1>
          <p className="text-muted-foreground">EUR is the base. Other currencies are derived — press &quot;Update prices&quot; to fetch the latest ECB rate and recompute all catalog prices with charm rounding.</p>
        </div>
        {!showAdd && (
          <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Add Currency</Button>
        )}
      </div>

      {showAdd && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">New Currency</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowAdd(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><label className="text-xs font-medium">Code</label><Input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="GBP" maxLength={3} /></div>
            <div className="space-y-1"><label className="text-xs font-medium">Name</label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="British Pound" /></div>
            <div className="space-y-1"><label className="text-xs font-medium">Symbol</label><Input value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="£" /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={busy === "add"}>{busy === "add" ? "Adding..." : "Add"}</Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {currencies.map((c) => (
          <div key={c.code} className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Coins className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{c.symbol} {c.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{c.code}</span>
                  {c.isBase && <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Base</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {c.isBase ? "All admin prices are entered in this currency." :
                    c.exchangeRate != null
                      ? `1 EUR = ${c.exchangeRate} ${c.code}${c.rateFetchedAt ? ` · updated ${new Date(c.rateFetchedAt).toLocaleString("en-GB")}` : ""}`
                      : "No rate yet — press Update prices."}
                </div>
              </div>
              {!c.isBase && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditingRule(editingRule === c.code ? null : c.code)}>
                    <Settings2 className="h-3.5 w-3.5 mr-1" /> Rounding
                  </Button>
                  <Button size="sm" onClick={() => handleUpdate(c)} disabled={busy === c.code}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${busy === c.code ? "animate-spin" : ""}`} /> {busy === c.code ? "Updating..." : "Update prices"}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              )}
            </div>
            {editingRule === c.code && (
              <RoundingEditor currency={c} onSave={(rule) => handleSaveRule(c, rule)} onCancel={() => setEditingRule(null)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface BandRow {
  upTo: string;
  mode: "endings" | "step";
  endings: string;
  step: string;
  minus: string;
}

const DEFAULT_BANDS: BandRow[] = [
  { upTo: "20", mode: "endings", endings: "0.29, 0.49, 0.79, 0.99", step: "", minus: "" },
  { upTo: "100", mode: "endings", endings: "0.99", step: "", minus: "" },
  { upTo: "", mode: "step", endings: "", step: "10", minus: "0.01" },
];

function ruleToRows(rule: RoundingRule | null): BandRow[] {
  if (!rule?.bands?.length) return DEFAULT_BANDS;
  return rule.bands.map((b) => ({
    upTo: b.upTo == null ? "" : String(b.upTo),
    mode: b.stepEnding ? "step" : "endings",
    endings: (b.endings ?? []).join(", "),
    step: b.stepEnding ? String(b.stepEnding.step) : "",
    minus: b.stepEnding ? String(b.stepEnding.minus) : "",
  }));
}

function rowsToRule(rows: BandRow[]): RoundingRule {
  const bands: RoundingBand[] = rows.map((r) => {
    const upTo = r.upTo.trim() === "" ? null : Number(r.upTo);
    if (r.mode === "step") {
      return { upTo, stepEnding: { step: Number(r.step) || 1, minus: Number(r.minus) || 0 } };
    }
    return { upTo, endings: r.endings.split(",").map((e) => Number(e.trim())).filter((n) => !isNaN(n)) };
  });
  return { bands };
}

function RoundingEditor({ currency, onSave, onCancel }: { currency: CatalogCurrency; onSave: (r: RoundingRule) => void; onCancel: () => void }) {
  const [rows, setRows] = useState<BandRow[]>(() => ruleToRows(currency.roundingRule));

  const update = (i: number, patch: Partial<BandRow>) => setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const rule = rowsToRule(rows);
  const rate = currency.exchangeRate ?? 1;

  return (
    <div className="border-t bg-muted/20 p-4 space-y-4">
      <p className="text-xs text-muted-foreground">Round UP to a charm price. Bands are checked top to bottom; the first matching <em>up to</em> wins. Leave the last band&apos;s limit empty for &quot;and above&quot;.</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border bg-card p-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Up to ({currency.symbol})</label>
              <Input className="h-8 w-24 text-sm" value={r.upTo} onChange={(e) => update(i, { upTo: e.target.value })} placeholder="∞" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Mode</label>
              <select className="flex h-8 w-32 rounded-md border border-input bg-background px-2 text-sm" value={r.mode} onChange={(e) => update(i, { mode: e.target.value as "endings" | "step" })}>
                <option value="endings">Charm endings</option>
                <option value="step">Round to step</option>
              </select>
            </div>
            {r.mode === "endings" ? (
              <div className="space-y-1 flex-1 min-w-[180px]">
                <label className="text-[11px] font-medium text-muted-foreground">Allowed endings (e.g. 0.29, 0.49, 0.99)</label>
                <Input className="h-8 text-sm" value={r.endings} onChange={(e) => update(i, { endings: e.target.value })} />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Step</label>
                  <Input className="h-8 w-20 text-sm" value={r.step} onChange={(e) => update(i, { step: e.target.value })} placeholder="10" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Minus</label>
                  <Input className="h-8 w-20 text-sm" value={r.minus} onChange={(e) => update(i, { minus: e.target.value })} placeholder="0.01" />
                </div>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}><X className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setRows([...rows, { upTo: "", mode: "endings", endings: "0.99", step: "", minus: "" }])}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add band
        </Button>
      </div>

      <div className="rounded-md border bg-card p-3">
        <div className="text-[11px] font-medium text-muted-foreground mb-2">Live preview (EUR → {currency.code} at {rate})</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {PREVIEW_VALUES.map((eur) => {
            const converted = eur * rate;
            const rounded = applyCharmRounding(converted, rule);
            return <span key={eur}>€{eur.toFixed(2)} → <strong>{currency.symbol}{rounded.toFixed(2)}</strong></span>;
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(rule)}>Save rounding rule</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
