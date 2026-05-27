"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Pencil, X } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { saveProduct, deleteProduct } from "../actions/products";
import { getVariants, saveVariant, deleteVariant } from "../actions/variants";
import type {
  CatalogProduct,
  CatalogVariant,
  CategoryField,
  FieldOption,
  PrimaryUnit,
} from "../types";

const UNIT_LABELS: Record<string, string> = { m2: "£/m²", m3: "£/m³", piece: "£/pc", linear_m: "£/m" };

interface Props {
  product: CatalogProduct;
  categoryId: string;
  categoryName: string;
  primaryUnit: PrimaryUnit;
  productFields: CategoryField[];
  variantFields: CategoryField[];
  variants: CatalogVariant[];
}

export function ProductDetailContent({
  product: initialProduct,
  categoryId,
  categoryName,
  primaryUnit,
  productFields,
  variantFields,
  variants: initialVariants,
}: Props) {
  const router = useRouter();
  const [product, setProduct] = useState(initialProduct);
  const [variants, setVariants] = useState(initialVariants);
  const [name, setName] = useState(product.name);
  const [desc, setDesc] = useState(product.description || "");
  const [slug, setSlug] = useState(product.slug);
  const [saving, setSaving] = useState(false);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<CatalogVariant | null>(null);

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

  const priceKey = `price${primaryUnit === "m2" ? "M2" : primaryUnit === "m3" ? "M3" : primaryUnit === "piece" ? "Piece" : "LinearM"}Cents` as keyof CatalogVariant;

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
            <label className="text-sm font-medium">Description</label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description" />
          </div>
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
            primaryUnit={primaryUnit}
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
                  <th className="text-left px-3 py-2 font-medium">Thickness</th>
                  <th className="text-left px-3 py-2 font-medium">Width</th>
                  <th className="text-left px-3 py-2 font-medium">Length</th>
                  <th className="text-right px-3 py-2 font-medium">{UNIT_LABELS[primaryUnit] || "Price"}</th>
                  <th className="text-right px-3 py-2 font-medium">£/piece</th>
                  <th className="text-center px-3 py-2 font-medium">Active</th>
                  <th className="px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => {
                  const mainPrice = v[priceKey] as number | null;
                  return (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
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
                        {mainPrice != null ? `£${(mainPrice / 100).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {v.pricePieceCents != null ? `£${(v.pricePieceCents / 100).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {v.isActive ? <span className="text-green-600">✓</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingVariant(v); setShowVariantForm(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
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
  primaryUnit,
  variantFields,
  variant,
  onSave,
  onCancel,
}: {
  productId: string;
  primaryUnit: PrimaryUnit;
  variantFields: CategoryField[];
  variant: CatalogVariant | null;
  onSave: (input: any) => Promise<any>;
  onCancel: () => void;
}) {
  const [thickness, setThickness] = useState(variant?.thicknessMm?.toString() || "");
  const [width, setWidth] = useState(variant?.widthMm?.toString() || "");
  const [length, setLength] = useState(variant?.lengthMm?.toString() || "");
  const [priceM2, setPriceM2] = useState(variant?.priceM2Cents != null ? (variant.priceM2Cents / 100).toString() : "");
  const [priceM3, setPriceM3] = useState(variant?.priceM3Cents != null ? (variant.priceM3Cents / 100).toString() : "");
  const [pricePiece, setPricePiece] = useState(variant?.pricePieceCents != null ? (variant.pricePieceCents / 100).toString() : "");
  const [sku, setSku] = useState(variant?.sku || "");
  const [active, setActive] = useState(variant?.isActive ?? true);
  const [saving, setSaving] = useState(false);

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
      priceM2Cents: priceM2 ? Math.round(Number(priceM2) * 100) : null,
      priceM3Cents: priceM3 ? Math.round(Number(priceM3) * 100) : null,
      pricePieceCents: pricePiece ? Math.round(Number(pricePiece) * 100) : null,
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
          <label className="text-xs font-medium">Price / m²</label>
          <Input type="number" step="0.01" className="h-9 text-sm" value={priceM2} onChange={(e) => setPriceM2(e.target.value)} placeholder="£" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Price / m³</label>
          <Input type="number" step="0.01" className="h-9 text-sm" value={priceM3} onChange={(e) => setPriceM3(e.target.value)} placeholder="£" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Price / piece</label>
          <Input type="number" step="0.01" className="h-9 text-sm" value={pricePiece} onChange={(e) => setPricePiece(e.target.value)} placeholder="£" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      </div>

      {/* Dynamic variant-level fields */}
      {variantFields.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Variant Attributes</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {variantFields.map((field) => (
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

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : variant ? "Update Variant" : "Create Variant"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
