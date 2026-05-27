"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight, GripVertical,
} from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import {
  saveCategory,
  deleteCategory,
  saveCategoryField,
  deleteCategoryField,
  saveFieldOption,
  deleteFieldOption,
} from "../actions";
import type {
  CatalogCategory,
  CategoryField,
  FieldOption,
  CatalogProduct,
  PrimaryUnit,
  FieldType,
  AppliesTo,
} from "../types";

interface Props {
  category: CatalogCategory;
  fields: CategoryField[];
  products: CatalogProduct[];
}

const UNIT_OPTIONS: { value: PrimaryUnit; label: string }[] = [
  { value: "m2", label: "Per m²" },
  { value: "m3", label: "Per m³" },
  { value: "piece", label: "Per piece" },
  { value: "linear_m", label: "Per linear meter" },
];

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "select", label: "Select (dropdown)" },
  { value: "number", label: "Number" },
  { value: "text", label: "Text" },
  { value: "boolean", label: "Yes/No" },
];

export function CategoryDetailTabs({ category, fields: initialFields, products: initialProducts }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"fields" | "products" | "settings">("fields");
  const [fields, setFields] = useState(initialFields);
  const [products] = useState(initialProducts);

  const tabs = [
    { id: "fields" as const, label: "Fields", count: fields.length },
    { id: "products" as const, label: "Products", count: products.length },
    { id: "settings" as const, label: "Settings" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/admin/catalog">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Catalog</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{category.name}</h1>
          {category.description && <p className="text-muted-foreground">{category.description}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b-2 border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-[2px] transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "fields" && (
        <FieldsTab
          categoryId={category.id}
          fields={fields}
          onFieldsChange={setFields}
        />
      )}
      {tab === "products" && (
        <ProductsTab categoryId={category.id} products={products} />
      )}
      {tab === "settings" && (
        <SettingsTab category={category} />
      )}
    </div>
  );
}

// ============================================================================
// Fields Tab
// ============================================================================

function FieldsTab({
  categoryId,
  fields,
  onFieldsChange,
}: {
  categoryId: string;
  fields: CategoryField[];
  onFieldsChange: (fields: CategoryField[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New field form state
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const [newAppliesTo, setNewAppliesTo] = useState<AppliesTo>("variant");
  const [newUnit, setNewUnit] = useState("");
  const [newFilter, setNewFilter] = useState(false);
  const [newDetail, setNewDetail] = useState(true);
  const [newPriceList, setNewPriceList] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setNewKey(""); setNewLabel(""); setNewType("text"); setNewAppliesTo("variant");
    setNewUnit(""); setNewFilter(false); setNewDetail(true); setNewPriceList(false);
    setShowForm(false);
  };

  const handleSaveField = async () => {
    if (!newKey.trim() || !newLabel.trim()) {
      toast.error("Key and label are required");
      return;
    }
    setSaving(true);
    const result = await saveCategoryField({
      id: editingId ?? undefined,
      categoryId,
      fieldKey: newKey.trim().toLowerCase().replace(/\s+/g, "_"),
      fieldLabel: newLabel.trim(),
      fieldType: newType,
      appliesTo: newAppliesTo,
      unit: newUnit.trim() || null,
      showInFilter: newFilter,
      showInDetail: newDetail,
      showInPriceList: newPriceList,
      sortOrder: editingId ? undefined : fields.length,
    });
    setSaving(false);

    if (result.success) {
      toast.success(editingId ? "Field updated" : "Field created");
      if (editingId) {
        onFieldsChange(fields.map((f) => (f.id === editingId ? result.data : f)));
      } else {
        onFieldsChange([...fields, result.data]);
      }
      resetForm();
      setEditingId(null);
    } else {
      toast.error(result.error);
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm("Delete this field and all its options? This cannot be undone.")) return;
    const result = await deleteCategoryField(id);
    if (result.success) {
      toast.success("Field deleted");
      onFieldsChange(fields.filter((f) => f.id !== id));
    } else {
      toast.error(result.error);
    }
  };

  const startEdit = (field: CategoryField) => {
    setEditingId(field.id);
    setNewKey(field.fieldKey);
    setNewLabel(field.fieldLabel);
    setNewType(field.fieldType);
    setNewAppliesTo(field.appliesTo);
    setNewUnit(field.unit || "");
    setNewFilter(field.showInFilter);
    setNewDetail(field.showInDetail);
    setNewPriceList(field.showInPriceList);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define the attributes for products and variants in this category
        </p>
        {!showForm && (
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Field
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h3 className="font-semibold">{editingId ? "Edit Field" : "New Field"}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Key</label>
              <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="wood_species" className="text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Label</label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Species" className="text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Type</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newType} onChange={(e) => setNewType(e.target.value as FieldType)}>
                {FIELD_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Applies To</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newAppliesTo} onChange={(e) => setNewAppliesTo(e.target.value as AppliesTo)}>
                <option value="product">Product</option>
                <option value="variant">Variant</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Unit (optional)</label>
              <Input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="mm" className="text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
              <input type="checkbox" checked={newFilter} onChange={(e) => setNewFilter(e.target.checked)} />
              Show in Filter
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
              <input type="checkbox" checked={newDetail} onChange={(e) => setNewDetail(e.target.checked)} />
              Show in Detail
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
              <input type="checkbox" checked={newPriceList} onChange={(e) => setNewPriceList(e.target.checked)} />
              Show in Price List
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveField} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update" : "Add"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { resetForm(); setEditingId(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Field list */}
      <div className="space-y-2">
        {fields.map((field) => (
          <div key={field.id}>
            <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{field.fieldLabel}</span>
                  <span className="text-xs text-muted-foreground font-mono">{field.fieldKey}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${field.appliesTo === "product" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                    {field.appliesTo}
                  </span>
                  <span className="text-xs text-muted-foreground">{field.fieldType}</span>
                  {field.unit && <span className="text-xs text-muted-foreground">({field.unit})</span>}
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                  {field.showInFilter && <span>Filter</span>}
                  {field.showInDetail && <span>Detail</span>}
                  {field.showInPriceList && <span>Price List</span>}
                  {field.options && field.options.length > 0 && (
                    <span>{field.options.length} options</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {field.fieldType === "select" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExpandedId(expandedId === field.id ? null : field.id)}
                  >
                    {expandedId === field.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => startEdit(field)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteField(field.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>

            {/* Expanded options for select fields */}
            {expandedId === field.id && field.fieldType === "select" && (
              <FieldOptionsPanel field={field} onFieldUpdate={(updated) => {
                onFieldsChange(fields.map((f) => f.id === updated.id ? updated : f));
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Field Options Panel
// ============================================================================

function FieldOptionsPanel({ field, onFieldUpdate }: { field: CategoryField; onFieldUpdate: (f: CategoryField) => void }) {
  const [options, setOptions] = useState<FieldOption[]>(field.options || []);
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newValue.trim() || !newLabel.trim()) { toast.error("Value and label required"); return; }
    setSaving(true);
    const result = await saveFieldOption({
      fieldId: field.id,
      value: newValue.trim(),
      label: newLabel.trim(),
      description: newDesc.trim() || null,
      sortOrder: options.length,
    });
    setSaving(false);
    if (result.success) {
      const updated = [...options, result.data];
      setOptions(updated);
      onFieldUpdate({ ...field, options: updated });
      setNewValue(""); setNewLabel(""); setNewDesc("");
      toast.success("Option added");
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteFieldOption(id);
    if (result.success) {
      const updated = options.filter((o) => o.id !== id);
      setOptions(updated);
      onFieldUpdate({ ...field, options: updated });
      toast.success("Option removed");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="ml-8 mt-1 mb-2 rounded-lg border bg-muted/30 p-4 space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Options for &quot;{field.fieldLabel}&quot;
      </h4>
      {options.map((opt) => (
        <div key={opt.id} className="flex items-center gap-2 text-sm">
          <span className="font-medium w-24 truncate">{opt.value}</span>
          <span className="text-muted-foreground flex-1 truncate">{opt.label}</span>
          {opt.description && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{opt.description}</span>}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(opt.id)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium">Value</label>
          <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Oak" className="text-sm h-8" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Label</label>
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="European Oak" className="text-sm h-8" />
        </div>
        <div className="space-y-1 flex-1">
          <label className="text-xs font-medium">Description (optional)</label>
          <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Dense, durable..." className="text-sm h-8" />
        </div>
        <Button size="sm" className="h-8" onClick={handleAdd} disabled={saving}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Products Tab
// ============================================================================

function ProductsTab({ categoryId, products }: { categoryId: string; products: CatalogProduct[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  const { saveProduct } = require("../actions/products");

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const result = await saveProduct({
      categoryId,
      name: name.trim(),
      slug: slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    });
    setSaving(false);
    if (result.success) {
      toast.success(`Product "${result.data.name}" created`);
      router.push(`/admin/catalog/${categoryId}/products/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {products.length} product{products.length !== 1 ? "s" : ""} in this category
        </p>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Add Product
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Name</label>
              <Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")); }} placeholder="Oak Full Stave Panel" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Slug</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="oak-full-stave" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/admin/catalog/${categoryId}/products/${p.id}`}
            className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {p.variantCount ?? 0} variant{(p.variantCount ?? 0) !== 1 ? "s" : ""}
                {p.fieldValues && p.fieldValues.length > 0 && (
                  <span className="ml-2">
                    {p.fieldValues.map((fv) => fv.option?.label || fv.valueText || String(fv.valueNumber)).filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            </div>
            {!p.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Inactive</span>}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Settings Tab
// ============================================================================

function SettingsTab({ category }: { category: CatalogCategory }) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [desc, setDesc] = useState(category.description || "");
  const [unit, setUnit] = useState<PrimaryUnit>(category.primaryUnit);
  const [active, setActive] = useState(category.isActive);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasChanges = name !== category.name || slug !== category.slug ||
    desc !== (category.description || "") || unit !== category.primaryUnit || active !== category.isActive;

  const handleSave = async () => {
    setSaving(true);
    const result = await saveCategory({
      id: category.id,
      name: name.trim(),
      slug: slug.trim(),
      description: desc.trim() || null,
      primaryUnit: unit,
      isActive: active,
    });
    setSaving(false);
    if (result.success) {
      toast.success("Category updated");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete category "${category.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    const result = await deleteCategory(category.id);
    setDeleting(false);
    if (result.success) {
      toast.success("Category deleted");
      router.push("/admin/catalog");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Category Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Slug</label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          <p className="text-xs text-muted-foreground">URL-safe identifier. Change with caution.</p>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Primary Pricing Unit</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={unit}
            onChange={(e) => setUnit(e.target.value as PrimaryUnit)}
          >
            {UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (visible in catalog)
        </label>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="rounded-lg border border-destructive/30 bg-card p-5">
        <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Deleting a category removes all its fields and options. Products must be removed first.
        </p>
        <Button variant="outline" className="text-destructive border-destructive/30" onClick={handleDelete} disabled={deleting}>
          <Trash2 className="h-4 w-4 mr-2" />
          {deleting ? "Deleting..." : "Delete Category"}
        </Button>
      </div>
    </div>
  );
}
