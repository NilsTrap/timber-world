"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveVariant, deleteVariant } from "../actions/variants";
import { assignVariantPackaging, removeVariantPackaging } from "../actions/packaging";
import { applyCharmRounding } from "../charmRounding";
import { effectiveRateEurCents, computeQuantity, lineTotalCents, computeStock, formatMoney, formatQty } from "../pricing";
import type {
  CatalogVariant, CatalogCurrency, PricingUnit, SaveVariantInput, StockUnit,
} from "../types";
import type { PackagingType } from "../actions/packagingTypes";
import type { CurrencyPriceMap } from "../actions/currencies";

interface Props {
  categoryId: string;
  productId: string;
  productBasePriceEurCents: number | null;
  categoryDefaultPriceEurCents: number | null;
  unit: PricingUnit | null;
  variants: CatalogVariant[];
  setVariants: (updater: (prev: CatalogVariant[]) => CatalogVariant[]) => void;
  altCurrencies: CatalogCurrency[];
  currencyPrices: CurrencyPriceMap;
  setCurrencyPrices: (updater: (prev: CurrencyPriceMap) => CurrencyPriceMap) => void;
  packagingTypes: PackagingType[];
}

const cellInput = "h-8 w-full rounded border border-transparent bg-transparent px-1.5 text-sm hover:border-input focus:border-primary focus:bg-background focus:outline-none";

export function VariantsTable({
  categoryId, productId, productBasePriceEurCents, categoryDefaultPriceEurCents,
  unit, variants: vars, setVariants: setVars, altCurrencies, currencyPrices: cPrices, setCurrencyPrices: setCPrices, packagingTypes,
}: Props) {
  const unitSymbol = unit?.symbol ?? "unit";
  const calcMethod = unit?.calcMethod ?? "per_piece";

  const effCurrency = (variantId: string, code: string) =>
    cPrices[`variant:${variantId}`]?.[code]?.priceCents ??
    cPrices[`product:${productId}`]?.[code]?.priceCents ??
    cPrices[`category:${categoryId}`]?.[code]?.priceCents ??
    null;

  const rowToInput = (v: CatalogVariant): SaveVariantInput => ({
    id: v.id, productId,
    sku: v.sku, thicknessMm: v.thicknessMm, widthMm: v.widthMm, lengthMm: v.lengthMm,
    lengthMinMm: v.lengthMinMm, lengthMaxMm: v.lengthMaxMm,
    priceEurCents: v.priceEurCents, stockQuantity: v.stockQuantity, stockUnit: v.stockUnit,
    isActive: v.isActive, sortOrder: v.sortOrder,
  });

  // Recompute a variant's derived currency prices locally (mirrors the server) so the table stays live.
  const recomputeLocal = (variantId: string, eurCents: number | null) => {
    setCPrices((prev) => {
      const key = `variant:${variantId}`;
      const entry: Record<string, { priceCents: number; isManual: boolean }> = { ...(prev[key] ?? {}) };
      for (const c of altCurrencies) {
        if (entry[c.code]?.isManual) continue; // keep manual override
        if (eurCents == null || c.exchangeRate == null) { delete entry[c.code]; continue; }
        const major = (eurCents / 100) * c.exchangeRate;
        entry[c.code] = { priceCents: Math.round(applyCharmRounding(major, c.roundingRule) * 100), isManual: false };
      }
      return { ...prev, [key]: entry };
    });
  };

  const patchLocal = (id: string, patch: Partial<CatalogVariant>) =>
    setVars((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const saveScalar = async (v: CatalogVariant, patch: Partial<CatalogVariant>) => {
    const merged = { ...v, ...patch };
    patchLocal(v.id, patch);
    if ("priceEurCents" in patch) recomputeLocal(v.id, merged.priceEurCents);
    const result = await saveVariant(rowToInput(merged));
    if (!result.success) { toast.error(result.error); return; }
    // keep server truth for scalar fields, but preserve our local default-packaging join
    setVars((prev) => prev.map((x) => (x.id === v.id ? { ...result.data, defaultPackaging: x.defaultPackaging } : x)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this variant?")) return;
    const result = await deleteVariant(id);
    if (result.success) { setVars((prev) => prev.filter((x) => x.id !== id)); toast.success("Variant deleted"); }
    else toast.error(result.error);
  };

  const handlePackage = async (v: CatalogVariant, typeId: string) => {
    if (!typeId) {
      if (v.defaultPackaging) await removeVariantPackaging(v.defaultPackaging.assignmentId);
      patchLocal(v.id, { defaultPackaging: null });
      return;
    }
    const result = await assignVariantPackaging({ variantId: v.id, packagingTypeId: typeId, isDefault: true });
    if (!result.success) { toast.error(result.error); return; }
    const t = packagingTypes.find((p) => p.id === typeId);
    patchLocal(v.id, { defaultPackaging: { assignmentId: result.data.id, packagingTypeId: typeId, name: t?.name ?? "", piecesPerPackage: t?.piecesPerPackage ?? 0 } });
  };

  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  if (vars.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs">
            <th className="text-left px-2 py-2 font-medium">SKU</th>
            <th className="text-left px-2 py-2 font-medium">Thick</th>
            <th className="text-left px-2 py-2 font-medium">Width</th>
            <th className="text-left px-2 py-2 font-medium">Length</th>
            <th className="text-right px-2 py-2 font-medium">€/{unitSymbol}</th>
            {altCurrencies.map((c) => <th key={c.code} className="text-right px-2 py-2 font-medium">{c.symbol}/{unitSymbol}</th>)}
            <th className="text-right px-2 py-2 font-medium">Total €</th>
            <th className="text-left px-2 py-2 font-medium">Stock</th>
            <th className="text-left px-2 py-2 font-medium">Package</th>
            <th className="text-center px-2 py-2 font-medium">Active</th>
            <th className="px-2 py-2 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {vars.map((v) => {
            const rate = effectiveRateEurCents(v.priceEurCents, productBasePriceEurCents, categoryDefaultPriceEurCents);
            const qty = computeQuantity(calcMethod, v);
            const total = lineTotalCents(rate, qty);
            const stock = computeStock({
              calcMethod, stockQuantity: v.stockQuantity, stockUnit: v.stockUnit,
              piecesPerPackage: v.defaultPackaging?.piecesPerPackage ?? null, dims: v,
            });
            return (
              <tr key={v.id} className="border-b last:border-0 align-middle">
                <td className="px-2 py-1 font-mono text-xs text-muted-foreground whitespace-nowrap">{v.sku || "—"}</td>
                <td className="px-1 py-1"><input type="number" defaultValue={v.thicknessMm ?? ""} className={cellInput} onBlur={(e) => saveScalar(v, { thicknessMm: num(e.target.value) })} /></td>
                <td className="px-1 py-1"><input type="number" defaultValue={v.widthMm ?? ""} className={cellInput} onBlur={(e) => saveScalar(v, { widthMm: num(e.target.value) })} /></td>
                <td className="px-1 py-1"><input type="number" defaultValue={v.lengthMm ?? ""} className={cellInput} onBlur={(e) => saveScalar(v, { lengthMm: num(e.target.value) })} /></td>
                <td className="px-1 py-1">
                  <input
                    type="number" step="0.01"
                    defaultValue={v.priceEurCents != null ? (v.priceEurCents / 100).toString() : ""}
                    placeholder={rate != null ? (rate / 100).toFixed(2) : ""}
                    className={`${cellInput} text-right`}
                    onBlur={(e) => saveScalar(v, { priceEurCents: e.target.value.trim() ? Math.round(Number(e.target.value) * 100) : null })}
                  />
                </td>
                {altCurrencies.map((c) => {
                  const cents = effCurrency(v.id, c.code);
                  const isManual = cPrices[`variant:${v.id}`]?.[c.code]?.isManual;
                  return (
                    <td key={c.code} className="px-2 py-1 text-right text-muted-foreground">
                      {cents != null ? formatMoney(cents, c.symbol) : "—"}
                      {isManual && <span className="ml-0.5 text-[10px] text-primary" title="Manual">✎</span>}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-right">{total != null ? formatMoney(total, "€") : <span className="text-amber-600">n/a</span>}</td>
                <td className="px-1 py-1">
                  <div className="flex items-center gap-1">
                    <input
                      type="number" defaultValue={v.stockQuantity ?? ""} className={`${cellInput} w-16`}
                      onBlur={(e) => saveScalar(v, { stockQuantity: num(e.target.value) })}
                    />
                    <select
                      defaultValue={v.stockUnit} className="h-8 rounded border border-transparent bg-transparent text-xs hover:border-input focus:border-primary focus:bg-background focus:outline-none"
                      onChange={(e) => saveScalar(v, { stockUnit: e.target.value as StockUnit })}
                    >
                      <option value="piece">pc</option>
                      <option value="package">pkg</option>
                    </select>
                    {stock.baseQty != null && <span className="text-[10px] text-muted-foreground whitespace-nowrap">= {formatQty(stock.baseQty)} {unitSymbol}</span>}
                  </div>
                </td>
                <td className="px-1 py-1">
                  <select
                    value={v.defaultPackaging?.packagingTypeId ?? ""}
                    className="h-8 w-full rounded border border-transparent bg-transparent text-sm hover:border-input focus:border-primary focus:bg-background focus:outline-none"
                    onChange={(e) => handlePackage(v, e.target.value)}
                  >
                    <option value="">— none —</option>
                    {packagingTypes.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.piecesPerPackage})</option>)}
                  </select>
                </td>
                <td className="px-2 py-1 text-center">
                  <input type="checkbox" checked={v.isActive} onChange={(e) => saveScalar(v, { isActive: e.target.checked })} />
                </td>
                <td className="px-2 py-1">
                  <div className="flex gap-0.5">
                    <Link href={`/admin/catalog/${categoryId}/products/${productId}/variants/${v.id}`} className="p-1.5 rounded hover:bg-muted" title="Open variant">
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded hover:bg-muted" title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
