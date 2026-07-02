"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, PackagePlus, PencilLine } from "lucide-react";
import { toast } from "sonner";
import {
  Button, Input, Label,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@timber/ui";
import type { DealSide, LineUnit } from "../services/dealModel";
import type { OrderDealView } from "../services/orderDeals";
import {
  getPickerCategories, getPickerProducts, getPickerVariants,
  addCatalogLineItem, addCustomLineItem, previewCatalogLinePrice,
  type PickerCategory, type PickerProduct, type PickerVariant,
} from "../actions/catalogPicker";

const CUSTOM_UNITS: LineUnit[] = ["m3", "m2", "piece", "linear_m", "package", "crate", "loose_m3"];

function fmtCents(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  const v = (cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v} ${currency}`;
}
function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function variantLabel(v: PickerVariant): string {
  const dims = [v.thicknessMm, v.widthMm, v.lengthMm].filter((d) => d != null).join(" × ");
  return [v.sku, dims ? `${dims} mm` : null].filter(Boolean).join(" · ") || "Variant";
}

/**
 * E5 · Per-side "add line" affordances for the Deal tab: a catalog picker
 * (category → product → variant → quantity, live-priced) and a free-text
 * custom line. Both append via the deal actions and hand the fresh deal view
 * back to the parent, which swaps it into local state.
 */
export function DealLineAdder({
  orderId, side, currency, canEditPrice, onApplied,
}: {
  orderId: string;
  side: DealSide;
  currency: string;
  canEditPrice: boolean;
  onApplied: (view: OrderDealView) => void;
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setCatalogOpen(true)}>
        <PackagePlus className="h-3.5 w-3.5" /> Add from catalog
      </Button>
      <Button variant="outline" size="sm" onClick={() => setCustomOpen(true)}>
        <PencilLine className="h-3.5 w-3.5" /> Add custom
      </Button>
      {catalogOpen && (
        <CatalogDialog
          orderId={orderId} side={side} currency={currency}
          onClose={() => setCatalogOpen(false)} onApplied={onApplied}
        />
      )}
      {customOpen && (
        <CustomDialog
          orderId={orderId} side={side} currency={currency} canEditPrice={canEditPrice}
          onClose={() => setCustomOpen(false)} onApplied={onApplied}
        />
      )}
    </div>
  );
}

function CatalogDialog({
  orderId, side, currency, onClose, onApplied,
}: {
  orderId: string; side: DealSide; currency: string;
  onClose: () => void; onApplied: (view: OrderDealView) => void;
}) {
  const [categories, setCategories] = useState<PickerCategory[]>([]);
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [variants, setVariants] = useState<PickerVariant[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [variantId, setVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [preview, setPreview] = useState<{ unitPriceCents: number | null; unit: string; lineTotalCents: number | null } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load categories once.
  useEffect(() => {
    let alive = true;
    getPickerCategories().then((res) => {
      if (!alive) return;
      if (res.success) setCategories(res.data);
      else setErr(res.error);
    });
    return () => { alive = false; };
  }, []);

  // Cascade: category → products (reset downstream).
  useEffect(() => {
    setProductId(""); setProducts([]); setVariantId(""); setVariants([]); setPreview(null);
    if (!categoryId) return;
    let alive = true;
    getPickerProducts(categoryId).then((res) => {
      if (!alive) return;
      if (res.success) setProducts(res.data);
      else setErr(res.error);
    });
    return () => { alive = false; };
  }, [categoryId]);

  // Cascade: product → variants (reset downstream).
  useEffect(() => {
    setVariantId(""); setVariants([]); setPreview(null);
    if (!productId) return;
    let alive = true;
    getPickerVariants(productId).then((res) => {
      if (!alive) return;
      if (res.success) setVariants(res.data);
      else setErr(res.error);
    });
    return () => { alive = false; };
  }, [productId]);

  // Live price preview on variant / quantity change.
  useEffect(() => {
    const qty = parseNum(quantity);
    if (!variantId || qty == null || qty <= 0) { setPreview(null); return; }
    let alive = true;
    setPreviewing(true);
    previewCatalogLinePrice({ orderId, variantId, quantity: qty }).then((res) => {
      if (!alive) return;
      setPreviewing(false);
      if (res.success) setPreview(res.data);
      else { setPreview(null); }
    });
    return () => { alive = false; };
  }, [orderId, variantId, quantity]);

  const confirm = useCallback(async () => {
    const qty = parseNum(quantity);
    if (!variantId || qty == null || qty <= 0) { setErr("Pick a variant and a quantity greater than zero."); return; }
    setSubmitting(true);
    setErr(null);
    const res = await addCatalogLineItem({ orderId, side, variantId, quantity: qty });
    setSubmitting(false);
    if (!res.success) { setErr(res.error); toast.error(res.error); return; }
    onApplied(res.data);
    toast.success("Catalog line added");
    onClose();
  }, [orderId, side, variantId, quantity, onApplied, onClose]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add {side === "buy" ? "buy-side" : "sell-side"} line from catalog</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId} disabled={!categoryId || products.length === 0}>
              <SelectTrigger><SelectValue placeholder={categoryId ? "Select a product" : "Pick a category first"} /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Variant</Label>
            <Select value={variantId} onValueChange={setVariantId} disabled={!productId || variants.length === 0}>
              <SelectTrigger><SelectValue placeholder={productId ? "Select a variant" : "Pick a product first"} /></SelectTrigger>
              <SelectContent>
                {variants.map((v) => <SelectItem key={v.id} value={v.id}>{variantLabel(v)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity{preview ? ` (${preview.unit})` : ""}</Label>
            <Input type="number" inputMode="decimal" min="0" step="0.001" value={quantity}
              onChange={(e) => setQuantity(e.target.value)} className="w-40" />
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            {previewing ? (
              <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Pricing…</span>
            ) : preview ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Unit {fmtCents(preview.unitPriceCents, currency)}/{preview.unit}</span>
                <span className="font-medium">Line total {fmtCents(preview.lineTotalCents, currency)}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Pick a variant and quantity for a live price.</span>
            )}
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={confirm} disabled={submitting || !variantId}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add line
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomDialog({
  orderId, side, currency, canEditPrice, onClose, onApplied,
}: {
  orderId: string; side: DealSide; currency: string; canEditPrice: boolean;
  onClose: () => void; onApplied: (view: OrderDealView) => void;
}) {
  const [productName, setProductName] = useState("");
  const [woodSpecies, setWoodSpecies] = useState("");
  const [thickness, setThickness] = useState("");
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");
  const [unit, setUnit] = useState<LineUnit>("m3");
  const [pieces, setPieces] = useState("");
  const [volumeM3, setVolumeM3] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const confirm = useCallback(async () => {
    if (productName.trim() === "") { setErr("Product name is required."); return; }
    const vol = parseNum(volumeM3);
    const price = parseNum(unitPrice);
    if ((vol != null && vol < 0) || (price != null && price < 0)) { setErr("Amounts can't be negative."); return; }
    setSubmitting(true);
    setErr(null);
    const res = await addCustomLineItem({
      orderId,
      side,
      productName: productName.trim(),
      woodSpecies: woodSpecies.trim() === "" ? null : woodSpecies.trim(),
      thickness: thickness.trim() === "" ? null : thickness.trim(),
      width: width.trim() === "" ? null : width.trim(),
      length: length.trim() === "" ? null : length.trim(),
      pieces: pieces.trim() === "" ? null : pieces.trim(),
      volumeM3: vol,
      unit,
      unitPriceCents: canEditPrice && price != null ? Math.round(price * 100) : null,
    });
    setSubmitting(false);
    if (!res.success) { setErr(res.error); toast.error(res.error); return; }
    onApplied(res.data);
    toast.success("Custom line added");
    onClose();
  }, [orderId, side, productName, woodSpecies, thickness, width, length, unit, pieces, volumeM3, unitPrice, canEditPrice, onApplied, onClose]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add {side === "buy" ? "buy-side" : "sell-side"} custom line</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product name</Label>
            <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Bespoke oak beam" />
          </div>
          <div className="space-y-1.5">
            <Label>Species (optional)</Label>
            <Input value={woodSpecies} onChange={(e) => setWoodSpecies(e.target.value)} placeholder="e.g. Oak" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Thickness</Label>
              <Input value={thickness} onChange={(e) => setThickness(e.target.value)} placeholder="mm" />
            </div>
            <div className="space-y-1.5">
              <Label>Width</Label>
              <Input value={width} onChange={(e) => setWidth(e.target.value)} placeholder="mm" />
            </div>
            <div className="space-y-1.5">
              <Label>Length</Label>
              <Input value={length} onChange={(e) => setLength(e.target.value)} placeholder="mm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as LineUnit)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CUSTOM_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {unit === "piece" ? (
              <div className="space-y-1.5">
                <Label>Pieces</Label>
                <Input type="number" inputMode="numeric" min="0" value={pieces} onChange={(e) => setPieces(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Volume (m³)</Label>
                <Input type="number" inputMode="decimal" min="0" step="0.001" value={volumeM3} onChange={(e) => setVolumeM3(e.target.value)} />
              </div>
            )}
          </div>
          {canEditPrice && (
            <div className="space-y-1.5">
              <Label>Unit price ({currency}/{unit})</Label>
              <Input type="number" inputMode="decimal" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={confirm} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add line
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
