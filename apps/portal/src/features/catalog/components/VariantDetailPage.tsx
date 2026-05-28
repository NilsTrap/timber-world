"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { saveVariant, deleteVariant } from "../actions/variants";
import { uploadVariantImage, deleteVariantImage } from "../actions/images";
import { getVariantPackages, saveVariantPackage, deleteVariantPackage, type VariantPackage } from "../actions/packaging";
import { effectiveRateEurCents, computeQuantity, lineTotalCents, formatMoney } from "../pricing";
import type { CatalogVariant, CategoryField, PricingUnit } from "../types";

interface Props {
  variant: CatalogVariant;
  categoryId: string;
  productId: string;
  productName: string;
  unit: PricingUnit | null;
  productBasePriceEurCents: number | null;
  categoryDefaultPriceEurCents: number | null;
  variantFields: CategoryField[];
}

export function VariantDetailPage({ variant: initialVariant, categoryId, productId, productName, unit, productBasePriceEurCents, categoryDefaultPriceEurCents, variantFields }: Props) {
  const router = useRouter();
  const [variant, setVariant] = useState(initialVariant);
  const [thickness, setThickness] = useState(variant.thicknessMm?.toString() || "");
  const [width, setWidth] = useState(variant.widthMm?.toString() || "");
  const [length, setLength] = useState(variant.lengthMm?.toString() || "");
  const [price, setPrice] = useState(variant.priceEurCents != null ? (variant.priceEurCents / 100).toString() : "");
  const [sku, setSku] = useState(variant.sku || "");
  const [active, setActive] = useState(variant.isActive);
  const [saving, setSaving] = useState(false);

  const unitSymbol = unit?.symbol ?? "unit";
  const calcMethod = unit?.calcMethod ?? "per_piece";
  const nonDimensionFields = variantFields.filter((f) => !f.dimensionRole);
  // Live preview from the edited inputs.
  const previewOverride = price ? Math.round(Number(price) * 100) : null;
  const previewRate = effectiveRateEurCents(previewOverride, productBasePriceEurCents, categoryDefaultPriceEurCents);
  const previewQty = computeQuantity(calcMethod, {
    widthMm: width ? Number(width) : null,
    lengthMm: length ? Number(length) : null,
    thicknessMm: thickness ? Number(thickness) : null,
  });
  const previewTotal = lineTotalCents(previewRate, previewQty);

  const [images, setImages] = useState(variant.images || []);
  const [uploading, setUploading] = useState(false);

  const [packages, setPackages] = useState<VariantPackage[]>([]);
  const [packagesLoaded, setPackagesLoaded] = useState(false);
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [pkgName, setPkgName] = useState("Standard Pack");
  const [pkgPieces, setPkgPieces] = useState("");
  const [pkgArea, setPkgArea] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgSaving, setPkgSaving] = useState(false);

  const [fieldValues, setFieldValues] = useState<Record<string, { optionId?: string; valueText?: string; valueNumber?: number }>>(
    () => {
      const map: Record<string, any> = {};
      for (const fv of variant.fieldValues || []) {
        map[fv.fieldId] = { optionId: fv.optionId, valueText: fv.valueText, valueNumber: fv.valueNumber };
      }
      return map;
    }
  );

  useEffect(() => {
    getVariantPackages(variant.id).then((r) => {
      if (r.success) setPackages(r.data);
      setPackagesLoaded(true);
    });
  }, [variant.id]);

  const handleSave = async () => {
    setSaving(true);
    const fvArray = Object.entries(fieldValues).map(([fieldId, v]) => ({
      fieldId,
      optionId: v.optionId || null,
      valueText: v.valueText || null,
      valueNumber: v.valueNumber ?? null,
    }));

    const result = await saveVariant({
      id: variant.id,
      productId,
      sku: sku.trim() || null,
      thicknessMm: thickness ? Number(thickness) : null,
      widthMm: width ? Number(width) : null,
      lengthMm: length ? Number(length) : null,
      priceEurCents: price ? Math.round(Number(price) * 100) : null,
      isActive: active,
      fieldValues: fvArray,
    });
    setSaving(false);
    if (result.success) {
      setVariant(result.data);
      toast.success("Variant saved");
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this variant?")) return;
    const result = await deleteVariant(variant.id);
    if (result.success) {
      toast.success("Variant deleted");
      router.push(`/admin/catalog/${categoryId}/products/${productId}`);
    } else {
      toast.error(result.error);
    }
  };

  const backUrl = `/admin/catalog/${categoryId}/products/${productId}`;
  const dimLabel = [
    thickness && `${thickness}mm`,
    width && `${width}mm`,
    length && `${length}mm`,
  ].filter(Boolean).join(" × ") || "New Variant";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href={backUrl}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to {productName}</span>
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">{dimLabel}</h1>
          <p className="text-muted-foreground">{productName} · Variant</p>
        </div>
        <Button variant="outline" className="text-destructive" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </Button>
      </div>

      {/* Dimensions & Pricing Card */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Dimensions & Pricing</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Thickness (mm)</label>
            <Input type="number" className="text-sm" value={thickness} onChange={(e) => setThickness(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Width (mm)</label>
            <Input type="number" className="text-sm" value={width} onChange={(e) => setWidth(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Length (mm)</label>
            <Input type="number" className="text-sm" value={length} onChange={(e) => setLength(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">SKU</label>
            <Input className="text-sm" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium">Price (€ / {unitSymbol})</label>
            <Input type="number" step="0.01" className="text-sm" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="blank = inherit product" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Effective rate</label>
            <div className="h-9 flex items-center text-sm">
              {formatMoney(previewRate, "€")}{previewRate != null && <span className="text-muted-foreground">/{unitSymbol}</span>}
              {!price && previewRate != null && <span className="ml-1 text-[10px] text-muted-foreground">inherited</span>}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Computed total</label>
            <div className="h-9 flex items-center text-sm font-medium">
              {previewTotal != null ? formatMoney(previewTotal, "€") : <span className="text-amber-600 text-xs">needs dimensions</span>}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
        </div>

        {/* Dynamic variant-level fields (dimensions handled above) */}
        {nonDimensionFields.length > 0 && (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Variant Attributes</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {nonDimensionFields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  value={fieldValues[field.id]}
                  onChange={(val) => setFieldValues((prev) => ({ ...prev, [field.id]: val }))}
                />
              ))}
            </div>
          </>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Variant"}
        </Button>
      </div>

      {/* Images Card */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Images ({images.length})</h2>
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                const fd = new FormData();
                fd.append("file", file);
                const result = await uploadVariantImage(variant.id, fd);
                setUploading(false);
                if (result.success) {
                  setImages([...images, result.data]);
                  toast.success("Image uploaded");
                } else {
                  toast.error(result.error);
                }
                e.target.value = "";
              }}
            />
            <Button size="sm" asChild disabled={uploading}>
              <span><Plus className="h-4 w-4 mr-1" /> {uploading ? "Uploading..." : "Upload Image"}</span>
            </Button>
          </label>
        </div>
        {images.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {images.map((img: any) => {
              const url = `https://fyzrtqsnmnizoxgcqsjc.supabase.co/storage/v1/object/public/catalog/${img.storagePath}`;
              return (
                <div key={img.id} className="relative group rounded-lg overflow-hidden border">
                  <img src={url} alt={img.altText || ""} className="w-full aspect-square object-cover" />
                  {img.isPrimary && (
                    <span className="absolute top-1 left-1 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Primary</span>
                  )}
                  <button
                    onClick={async () => {
                      const result = await deleteVariantImage(img.id);
                      if (result.success) {
                        setImages(images.filter((i: any) => i.id !== img.id));
                        toast.success("Image removed");
                      }
                    }}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No images yet. Upload variant-specific photos.</p>
        )}
      </div>

      {/* Packaging Card */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Packaging ({packages.length})</h2>
          {!showPkgForm && (
            <Button size="sm" onClick={() => setShowPkgForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Package
            </Button>
          )}
        </div>

        {packages.map((pkg) => (
          <div key={pkg.id} className="flex items-center gap-3 text-sm rounded-lg border px-4 py-3">
            <span className="font-medium">{pkg.name}</span>
            <span className="text-muted-foreground">{pkg.piecesPerPackage} pcs</span>
            {pkg.areaM2 && <span className="text-muted-foreground">{pkg.areaM2} m²</span>}
            {pkg.packagePriceCents != null && <span className="text-green-700 font-medium">£{(pkg.packagePriceCents / 100).toFixed(2)}</span>}
            {pkg.isDefault && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Default</span>}
            <div className="flex-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
              const result = await deleteVariantPackage(pkg.id);
              if (result.success) { setPackages(packages.filter((p) => p.id !== pkg.id)); toast.success("Package removed"); }
            }}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}

        {!packagesLoaded && <p className="text-sm text-muted-foreground">Loading...</p>}
        {packagesLoaded && packages.length === 0 && !showPkgForm && (
          <p className="text-sm text-muted-foreground">No packages defined. Add package configurations for this variant.</p>
        )}

        {showPkgForm && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h3 className="text-sm font-semibold">New Package</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Name</label>
                <Input value={pkgName} onChange={(e) => setPkgName(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Pieces per pack</label>
                <Input type="number" value={pkgPieces} onChange={(e) => setPkgPieces(e.target.value)} className="text-sm" placeholder="10" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Area (m²)</label>
                <Input type="number" step="0.01" value={pkgArea} onChange={(e) => setPkgArea(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Price (£)</label>
                <Input type="number" step="0.01" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} className="text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={async () => {
                if (!pkgPieces || parseInt(pkgPieces) <= 0) { toast.error("Pieces required"); return; }
                setPkgSaving(true);
                const result = await saveVariantPackage({
                  variantId: variant.id,
                  name: pkgName.trim() || "Standard Pack",
                  piecesPerPackage: parseInt(pkgPieces),
                  areaM2: pkgArea ? parseFloat(pkgArea) : null,
                  packagePriceCents: pkgPrice ? Math.round(parseFloat(pkgPrice) * 100) : null,
                  isDefault: packages.length === 0,
                });
                setPkgSaving(false);
                if (result.success) {
                  setPackages([...packages, result.data]);
                  setShowPkgForm(false);
                  setPkgName("Standard Pack"); setPkgPieces(""); setPkgArea(""); setPkgPrice("");
                  toast.success("Package added");
                } else { toast.error(result.error); }
              }} disabled={pkgSaving}>{pkgSaving ? "Adding..." : "Add Package"}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowPkgForm(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DynamicField({ field, value, onChange }: { field: CategoryField; value?: any; onChange: (val: any) => void }) {
  if (field.fieldType === "select" && field.options) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium">{field.fieldLabel}</label>
        <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={value?.optionId || ""} onChange={(e) => onChange({ optionId: e.target.value || undefined })}>
          <option value="">— select —</option>
          {field.options.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
        </select>
      </div>
    );
  }
  if (field.fieldType === "number") {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium">{field.fieldLabel} {field.unit && <span className="text-muted-foreground">({field.unit})</span>}</label>
        <Input type="number" className="h-9 text-sm" value={value?.valueNumber ?? ""} onChange={(e) => onChange({ valueNumber: e.target.value ? Number(e.target.value) : undefined })} />
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{field.fieldLabel}</label>
      <Input className="h-9 text-sm" value={value?.valueText || ""} onChange={(e) => onChange({ valueText: e.target.value })} />
    </div>
  );
}
