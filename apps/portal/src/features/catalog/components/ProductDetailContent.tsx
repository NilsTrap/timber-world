"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Pencil, X, Copy } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { saveProduct, duplicateProduct, deleteProduct } from "../actions/products";
import { getVariants, saveVariant, deleteVariant } from "../actions/variants";
import { uploadProductImage, deleteProductImage, uploadVariantImage, deleteVariantImage } from "../actions/images";
import { VariantPackagingSection } from "./VariantPackagingSection";
import type {
  CatalogProduct,
  CatalogVariant,
  CategoryField,
  FieldOption,
  PricingUnit,
  CatalogCurrency,
} from "../types";
import type { CurrencyPriceMap } from "../actions/currencies";
import { effectiveRateEurCents, computeQuantity, lineTotalCents, formatMoney } from "../pricing";

interface Props {
  product: CatalogProduct;
  categoryId: string;
  categoryName: string;
  unit: PricingUnit | null;
  categoryDefaultPriceEurCents: number | null;
  productFields: CategoryField[];
  variantFields: CategoryField[];
  variants: CatalogVariant[];
  altCurrencies: CatalogCurrency[];
  currencyPrices: CurrencyPriceMap;
}

export function ProductDetailContent({
  product: initialProduct,
  categoryId,
  categoryName,
  unit,
  categoryDefaultPriceEurCents,
  productFields,
  variantFields,
  variants: initialVariants,
  altCurrencies,
  currencyPrices,
}: Props) {
  const router = useRouter();
  const [product, setProduct] = useState(initialProduct);
  const [variants, setVariants] = useState(initialVariants);
  const [name, setName] = useState(product.name);
  const [desc, setDesc] = useState(product.description || "");
  const [slug, setSlug] = useState(product.slug);
  const [basePrice, setBasePrice] = useState(product.basePriceEurCents != null ? (product.basePriceEurCents / 100).toString() : "");
  const unitSymbol = unit?.symbol ?? "unit";
  const calcMethod = unit?.calcMethod ?? "per_piece";

  // Effective converted rate for a variant in a derived currency: variant -> product -> category.
  const effCurrency = (variantId: string, code: string) =>
    currencyPrices[`variant:${variantId}`]?.[code]?.priceCents ??
    currencyPrices[`product:${product.id}`]?.[code]?.priceCents ??
    currencyPrices[`category:${categoryId}`]?.[code]?.priceCents ??
    null;
  const [saving, setSaving] = useState(false);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<CatalogVariant | null>(null);
  const [images, setImages] = useState(product.images || []);
  const [uploading, setUploading] = useState(false);

  // Product-level field values state
  const [fieldValues, setFieldValues] = useState<Record<string, { optionId?: string; valueText?: string; valueNumber?: number }>>(
    () => {
      const map: Record<string, any> = {};
      for (const fv of product.fieldValues || []) {
        map[fv.fieldId] = { optionId: fv.optionId, valueText: fv.valueText, valueNumber: fv.valueNumber };
      }
      return map;
    }
  );

  const handleSaveProduct = async () => {
    setSaving(true);
    const fvArray = Object.entries(fieldValues).map(([fieldId, v]) => ({
      fieldId,
      optionId: v.optionId || null,
      valueText: v.valueText || null,
      valueNumber: v.valueNumber ?? null,
    }));

    const result = await saveProduct({
      id: product.id,
      categoryId,
      name: name.trim(),
      slug: slug.trim(),
      description: desc.trim() || null,
      basePriceEurCents: basePrice ? Math.round(Number(basePrice) * 100) : null,
      fieldValues: fvArray,
    });
    setSaving(false);
    if (result.success) {
      setProduct(result.data);
      toast.success("Product saved");
    } else {
      toast.error(result.error);
    }
  };

  const handleDeleteProduct = async () => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    const result = await deleteProduct(product.id);
    if (result.success) {
      toast.success("Product deleted");
      router.push(`/admin/catalog/${categoryId}`);
    } else {
      toast.error(result.error);
    }
  };

  const handleSaveVariant = async (input: any) => {
    const result = await saveVariant(input);
    if (result.success) {
      if (input.id) {
        setVariants(variants.map((v) => v.id === input.id ? result.data : v));
      } else {
        setVariants([...variants, result.data]);
      }
      setShowVariantForm(false);
      setEditingVariant(null);
      toast.success(input.id ? "Variant updated" : "Variant created");
    } else {
      toast.error(result.error);
    }
    return result;
  };

  const handleDeleteVariant = async (id: string) => {
    if (!confirm("Delete this variant?")) return;
    const result = await deleteVariant(id);
    if (result.success) {
      setVariants(variants.filter((v) => v.id !== id));
      toast.success("Variant deleted");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href={`/admin/catalog/${categoryId}`}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to {categoryName}</span>
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-muted-foreground">{categoryName}</p>
        </div>
        <Button variant="outline" onClick={async () => {
          const result = await duplicateProduct(product.id);
          if (result.success) {
            toast.success(`Duplicated as "${result.data.name}"`);
            router.push(`/admin/catalog/${categoryId}/products/${result.data.id}`);
          } else {
            toast.error(result.error);
          }
        }}>
          <Copy className="h-4 w-4 mr-2" /> Duplicate
        </Button>
        <Button variant="outline" className="text-destructive" onClick={handleDeleteProduct}>
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </Button>
      </div>

      {/* Product details form */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Product Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Base price (€ / {unitSymbol})</label>
            <Input type="number" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="applies to all variants unless overridden" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Product description — supports multiple lines"
          />
        </div>

        {/* Dynamic product-level fields */}
        {productFields.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Product Attributes</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {productFields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  value={fieldValues[field.id]}
                  onChange={(val) => setFieldValues((prev) => ({ ...prev, [field.id]: val }))}
                />
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleSaveProduct} disabled={saving}>
          {saving ? "Saving..." : "Save Product"}
        </Button>
      </div>

      {/* Images */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Images ({images.length})</h2>
          <label className="inline-flex items-center gap-2 cursor-pointer">
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
                const result = await uploadProductImage(product.id, fd);
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
            {images.map((img) => {
              const url = `https://fyzrtqsnmnizoxgcqsjc.supabase.co/storage/v1/object/public/catalog/${img.storagePath}`;
              return (
                <div key={img.id} className="relative group rounded-lg overflow-hidden border">
                  <img src={url} alt={img.altText || ""} className="w-full aspect-square object-cover" />
                  {img.isPrimary && (
                    <span className="absolute top-1 left-1 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Primary</span>
                  )}
                  <button
                    onClick={async () => {
                      const result = await deleteProductImage(img.id);
                      if (result.success) {
                        setImages(images.filter((i) => i.id !== img.id));
                        toast.success("Image removed");
                      } else {
                        toast.error(result.error);
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
          <p className="text-sm text-muted-foreground">No images yet. Upload product photos to show in the catalog.</p>
        )}
      </div>

      {/* Variants */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Variants ({variants.length})</h2>
          <Button size="sm" onClick={() => { setEditingVariant(null); setShowVariantForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Variant
          </Button>
        </div>

        {(showVariantForm || editingVariant) && (
          <VariantForm
            productId={product.id}
            unit={unit}
            variantFields={variantFields}
            variant={editingVariant}
            onSave={handleSaveVariant}
            onCancel={() => { setShowVariantForm(false); setEditingVariant(null); }}
          />
        )}

        {variants.length > 0 && (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-10 px-3 py-2"></th>
                  <th className="text-left px-3 py-2 font-medium">Thickness</th>
                  <th className="text-left px-3 py-2 font-medium">Width</th>
                  <th className="text-left px-3 py-2 font-medium">Length</th>
                  <th className="text-right px-3 py-2 font-medium">€/{unitSymbol}</th>
                  {altCurrencies.map((c) => (
                    <th key={c.code} className="text-right px-3 py-2 font-medium">{c.symbol}/{unitSymbol}</th>
                  ))}
                  <th className="text-right px-3 py-2 font-medium">Total (€)</th>
                  <th className="text-center px-3 py-2 font-medium">Active</th>
                  <th className="px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => {
                  const rate = effectiveRateEurCents(v.priceEurCents, product.basePriceEurCents, categoryDefaultPriceEurCents);
                  const qty = computeQuantity(calcMethod, v);
                  const total = lineTotalCents(rate, qty);
                  const inherited = v.priceEurCents == null;
                  return (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        {v.images && v.images.length > 0 && v.images[0] ? (
                          <img
                            src={`https://fyzrtqsnmnizoxgcqsjc.supabase.co/storage/v1/object/public/catalog/${v.images[0]!.storagePath}`}
                            alt=""
                            className="w-8 h-8 rounded object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted" />
                        )}
                      </td>
                      <td className="px-3 py-2">{v.thicknessMm ? `${v.thicknessMm}mm` : "—"}</td>
                      <td className="px-3 py-2">{v.widthMm ? `${v.widthMm}mm` : "—"}</td>
                      <td className="px-3 py-2">
                        {v.lengthMm
                          ? `${v.lengthMm}mm`
                          : v.lengthMinMm && v.lengthMaxMm
                            ? `${v.lengthMinMm}–${v.lengthMaxMm}mm`
                            : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatMoney(rate, "€")}
                        {inherited && rate != null && <span className="ml-1 text-[10px] text-muted-foreground">inh.</span>}
                      </td>
                      {altCurrencies.map((c) => {
                        const cents = effCurrency(v.id, c.code);
                        const isManual = currencyPrices[`variant:${v.id}`]?.[c.code]?.isManual;
                        return (
                          <td key={c.code} className="px-3 py-2 text-right">
                            {cents != null ? formatMoney(cents, c.symbol) : <span className="text-muted-foreground">—</span>}
                            {isManual && <span className="ml-1 text-[10px] text-primary" title="Manually set">✎</span>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right">
                        {total != null ? formatMoney(total, "€") : <span className="text-amber-600" title="Missing dimensions for this unit">n/a</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {v.isActive ? <span className="text-green-600">✓</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <Link href={`/admin/catalog/${categoryId}/products/${product.id}/variants/${v.id}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteVariant(v.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Dynamic Field Renderer
// ============================================================================

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: CategoryField;
  value?: { optionId?: string; valueText?: string; valueNumber?: number };
  onChange: (val: { optionId?: string; valueText?: string; valueNumber?: number }) => void;
}) {
  if (field.fieldType === "select" && field.options) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium">{field.fieldLabel}</label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          value={value?.optionId || ""}
          onChange={(e) => onChange({ optionId: e.target.value || undefined })}
        >
          <option value="">— select —</option>
          {field.options.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.fieldType === "number") {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium">{field.fieldLabel} {field.unit && <span className="text-muted-foreground">({field.unit})</span>}</label>
        <Input
          type="number"
          className="h-9 text-sm"
          value={value?.valueNumber ?? ""}
          onChange={(e) => onChange({ valueNumber: e.target.value ? Number(e.target.value) : undefined })}
        />
      </div>
    );
  }

  if (field.fieldType === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
        <input
          type="checkbox"
          checked={value?.valueText === "true"}
          onChange={(e) => onChange({ valueText: e.target.checked ? "true" : "false" })}
        />
        {field.fieldLabel}
      </label>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{field.fieldLabel}</label>
      <Input
        className="h-9 text-sm"
        value={value?.valueText || ""}
        onChange={(e) => onChange({ valueText: e.target.value })}
      />
    </div>
  );
}

// ============================================================================
// Variant Form
// ============================================================================

function VariantForm({
  productId,
  unit,
  variantFields,
  variant,
  onSave,
  onCancel,
}: {
  productId: string;
  unit: PricingUnit | null;
  variantFields: CategoryField[];
  variant: CatalogVariant | null;
  onSave: (input: any) => Promise<any>;
  onCancel: () => void;
}) {
  const [thickness, setThickness] = useState(variant?.thicknessMm?.toString() || "");
  const [width, setWidth] = useState(variant?.widthMm?.toString() || "");
  const [length, setLength] = useState(variant?.lengthMm?.toString() || "");
  const [price, setPrice] = useState(variant?.priceEurCents != null ? (variant.priceEurCents / 100).toString() : "");
  const [sku, setSku] = useState(variant?.sku || "");
  const [active, setActive] = useState(variant?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  // Dimensions are dedicated columns; hide their (system) fields from the generic list.
  const nonDimensionFields = variantFields.filter((f) => !f.dimensionRole);

  const [fieldValues, setFieldValues] = useState<Record<string, { optionId?: string; valueText?: string; valueNumber?: number }>>(
    () => {
      const map: Record<string, any> = {};
      for (const fv of variant?.fieldValues || []) {
        map[fv.fieldId] = { optionId: fv.optionId, valueText: fv.valueText, valueNumber: fv.valueNumber };
      }
      return map;
    }
  );

  const handleSave = async () => {
    setSaving(true);
    const fvArray = Object.entries(fieldValues).map(([fieldId, v]) => ({
      fieldId,
      optionId: v.optionId || null,
      valueText: v.valueText || null,
      valueNumber: v.valueNumber ?? null,
    }));

    await onSave({
      id: variant?.id,
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
  };

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{variant ? "Edit Variant" : "New Variant"}</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Thickness (mm)</label>
          <Input type="number" className="h-9 text-sm" value={thickness} onChange={(e) => setThickness(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Width (mm)</label>
          <Input type="number" className="h-9 text-sm" value={width} onChange={(e) => setWidth(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Length (mm)</label>
          <Input type="number" className="h-9 text-sm" value={length} onChange={(e) => setLength(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">SKU (optional)</label>
          <Input className="h-9 text-sm" value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Price (€ / {unit?.symbol ?? "unit"})</label>
          <Input type="number" step="0.01" className="h-9 text-sm" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="blank = inherit product price" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      </div>

      {/* Dynamic variant-level fields (dimensions handled above) */}
      {nonDimensionFields.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Variant Attributes</h4>
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
        </div>
      )}

      {/* Variant images (only for existing variants) */}
      {variant && (
        <VariantImageSection variantId={variant.id} initialImages={variant.images || []} />
      )}

      {/* Packaging (only for existing variants) */}
      {variant && (
        <VariantPackagingSection variantId={variant.id} />
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : variant ? "Update Variant" : "Create Variant"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function VariantImageSection({ variantId, initialImages }: { variantId: string; initialImages: any[] }) {
  const [images, setImages] = useState(initialImages);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variant Images ({images.length})</h4>
        <label className="inline-flex items-center gap-1 cursor-pointer">
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
              const result = await uploadVariantImage(variantId, fd);
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
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild disabled={uploading}>
            <span><Plus className="h-3 w-3 mr-1" /> {uploading ? "Uploading..." : "Upload"}</span>
          </Button>
        </label>
      </div>
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((img: any) => {
            const url = `https://fyzrtqsnmnizoxgcqsjc.supabase.co/storage/v1/object/public/catalog/${img.storagePath}`;
            return (
              <div key={img.id} className="relative group w-16 h-16 rounded border overflow-hidden">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={async () => {
                    const result = await deleteVariantImage(img.id);
                    if (result.success) {
                      setImages(images.filter((i: any) => i.id !== img.id));
                      toast.success("Removed");
                    }
                  }}
                  className="absolute inset-0 bg-red-500/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

