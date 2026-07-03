"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight, GripVertical,
  List, Hash, Type, ToggleLeft, Paperclip, type LucideIcon,
} from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import {
  saveCategory,
  deleteCategory,
  getCategoryDeletionInfo,
  getAllFields,
  saveField,
  saveFieldAssignment,
  removeFieldAssignment,
  saveFieldOption,
  deleteFieldOption,
  uploadCategoryImage,
  removeCategoryImage,
} from "../actions";
import type {
  CatalogCategory,
  CatalogField,
  CategoryField,
  FieldOption,
  CatalogProduct,
  PrimaryUnit,
  PricingUnit,
  FieldType,
  AppliesTo,
} from "../types";

interface Props {
  category: CatalogCategory;
  fields: CategoryField[];
  products: CatalogProduct[];
  pricingUnits: PricingUnit[];
}

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "select", label: "Select (dropdown)" },
  { value: "number", label: "Number" },
  { value: "text", label: "Text" },
  { value: "boolean", label: "Yes/No" },
  { value: "file", label: "File upload" },
];

/** A vector icon per field type, shown at the left of each field row. */
const FIELD_TYPE_ICON: Record<FieldType, LucideIcon> = {
  select: List,
  number: Hash,
  text: Type,
  boolean: ToggleLeft,
  file: Paperclip,
};

export function CategoryDetailTabs({ category, fields: initialFields, pricingUnits }: Props) {
  const [fields, setFields] = useState(initialFields);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/admin/catalog/categories">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Categories</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{category.name}</h1>
          {category.description && <p className="text-muted-foreground text-sm">{category.description}</p>}
        </div>
      </div>

      {/* Category settings + Fields, side by side (50/50). Products live in the
          Products section now, so there's no Products tab here. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <SettingsTab category={category} pricingUnits={pricingUnits} />
        <FieldsTab categoryId={category.id} fields={fields} onFieldsChange={setFields} />
      </div>
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
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [allGlobalFields, setAllGlobalFields] = useState<CatalogField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [assignAppliesTo, setAssignAppliesTo] = useState<AppliesTo>("variant");
  const [assignFilter, setAssignFilter] = useState(false);
  const [assignDetail, setAssignDetail] = useState(true);
  const [assignPriceList, setAssignPriceList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // For creating new global fields inline
  const [showNewField, setShowNewField] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const [newUnit, setNewUnit] = useState("");

  const loadGlobalFields = async () => {
    const result = await getAllFields();
    if (result.success) setAllGlobalFields(result.data);
  };

  const handleOpenAssign = async () => {
    await loadGlobalFields();
    setShowAssignForm(true);
  };

  const handleAssign = async () => {
    if (!selectedFieldId) { toast.error("Select a field"); return; }
    setSaving(true);
    const result = await saveFieldAssignment({
      categoryId,
      fieldId: selectedFieldId,
      appliesTo: assignAppliesTo,
      showInFilter: assignFilter,
      showInDetail: assignDetail,
      showInPriceList: assignPriceList,
      sortOrder: fields.length,
    });
    setSaving(false);
    if (result.success) {
      toast.success("Field assigned");
      setShowAssignForm(false);
      setSelectedFieldId("");
      // Reload to get full field data with options
      const { getCategoryFields } = await import("../actions/fields");
      const refreshed = await getCategoryFields(categoryId);
      if (refreshed.success) onFieldsChange(refreshed.data);
    } else {
      toast.error(result.error);
    }
  };

  const handleCreateAndAssign = async () => {
    if (!newKey.trim() || !newLabel.trim()) { toast.error("Key and label required"); return; }
    setSaving(true);
    const fieldResult = await saveField({
      fieldKey: newKey.trim().toLowerCase().replace(/\s+/g, "_"),
      fieldLabel: newLabel.trim(),
      fieldType: newType,
      unit: newUnit.trim() || null,
    });
    if (!fieldResult.success) { setSaving(false); toast.error(fieldResult.error); return; }

    const assignResult = await saveFieldAssignment({
      categoryId,
      fieldId: fieldResult.data.id,
      appliesTo: assignAppliesTo,
      showInFilter: assignFilter,
      showInDetail: assignDetail,
      showInPriceList: assignPriceList,
      sortOrder: fields.length,
    });
    setSaving(false);
    if (assignResult.success) {
      toast.success("Field created and assigned");
      setShowAssignForm(false);
      setShowNewField(false);
      setNewKey(""); setNewLabel(""); setNewType("text"); setNewUnit("");
      const { getCategoryFields } = await import("../actions/fields");
      const refreshed = await getCategoryFields(categoryId);
      if (refreshed.success) onFieldsChange(refreshed.data);
    } else {
      toast.error(assignResult.error);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm("Remove this field from the category? The global field and its options remain intact.")) return;
    const result = await removeFieldAssignment(assignmentId);
    if (result.success) {
      toast.success("Field removed from category");
      onFieldsChange(fields.filter((f) => f.assignmentId !== assignmentId));
    } else {
      toast.error(result.error);
    }
  };

  // Persist one assignment (applies_to / show-flags / sort order), keeping the
  // other columns intact. Used by the inline applies_to editor and drag-reorder.
  const persistAssignment = (f: CategoryField, patch: Partial<CategoryField>) =>
    saveFieldAssignment({
      id: f.assignmentId,
      categoryId,
      fieldId: f.id,
      appliesTo: patch.appliesTo ?? f.appliesTo,
      showInFilter: patch.showInFilter ?? f.showInFilter,
      showInDetail: patch.showInDetail ?? f.showInDetail,
      showInPriceList: patch.showInPriceList ?? f.showInPriceList,
      sortOrder: patch.sortOrder ?? f.sortOrder,
    });

  const changeAppliesTo = async (field: CategoryField, appliesTo: AppliesTo) => {
    onFieldsChange(fields.map((f) => (f.id === field.id ? { ...f, appliesTo } : f)));
    const res = await persistAssignment(field, { appliesTo });
    if (!res.success) { toast.error(res.error); onFieldsChange(fields); }
  };

  const handleDrop = async (targetIdx: number) => {
    const from = dragIdx;
    setDragIdx(null);
    if (from == null || from === targetIdx) return;
    const reordered = [...fields];
    const [moved] = reordered.splice(from, 1);
    if (!moved) return;
    reordered.splice(targetIdx, 0, moved);
    const withOrder = reordered.map((f, i) => ({ ...f, sortOrder: i }));
    onFieldsChange(withOrder);
    const results = await Promise.all(withOrder.map((f) => persistAssignment(f, { sortOrder: f.sortOrder })));
    if (results.some((r) => !r.success)) toast.error("Couldn't save the new order");
  };

  const assignedFieldIds = new Set(fields.map((f) => f.id));
  const availableFields = allGlobalFields.filter((f) => !assignedFieldIds.has(f.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Assign global fields to this category. Fields can be reused across categories.
        </p>
        {!showAssignForm && (
          <Button size="sm" onClick={handleOpenAssign}>
            <Plus className="h-4 w-4 mr-1" /> Assign Field
          </Button>
        )}
      </div>

      {showAssignForm && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h3 className="font-semibold">Assign Field to Category</h3>

          {!showNewField ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Select Field</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedFieldId} onChange={(e) => setSelectedFieldId(e.target.value)}>
                    <option value="">— pick a field —</option>
                    {availableFields.map((f) => <option key={f.id} value={f.id}>{f.fieldLabel} ({f.fieldKey})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Applies To</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={assignAppliesTo} onChange={(e) => setAssignAppliesTo(e.target.value as AppliesTo)}>
                    <option value="product">Product</option>
                    <option value="variant">Variant</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={assignFilter} onChange={(e) => setAssignFilter(e.target.checked)} /> Filter
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={assignDetail} onChange={(e) => setAssignDetail(e.target.checked)} /> Detail
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={assignPriceList} onChange={(e) => setAssignPriceList(e.target.checked)} /> Price List
                </label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAssign} disabled={saving || !selectedFieldId}>{saving ? "Assigning..." : "Assign"}</Button>
                <Button size="sm" variant="outline" onClick={() => setShowNewField(true)}>Create New Field</Button>
                <Button size="sm" variant="outline" onClick={() => setShowAssignForm(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Create a new global field and assign it to this category</p>
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
                  <label className="text-xs font-medium">Unit</label>
                  <Input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="mm" className="text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateAndAssign} disabled={saving}>{saving ? "Creating..." : "Create & Assign"}</Button>
                <Button size="sm" variant="outline" onClick={() => setShowNewField(false)}>Back to list</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Field list — drag a row to reorder; "Applies to" is an editable column */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {fields.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No fields yet. Assign a field to this category.</p>
        ) : (
          <div className="divide-y">
            {fields.map((field, idx) => {
              const TypeIcon = FIELD_TYPE_ICON[field.fieldType] ?? Type;
              return (
                <div key={field.id}>
                  <div
                    className={`flex items-center gap-2 px-2 py-2 ${dragIdx === idx ? "opacity-50" : ""}`}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={() => setDragIdx(null)}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                    <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" aria-label={field.fieldType} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{field.fieldLabel}</span>
                        <span className="text-xs text-muted-foreground font-mono truncate">{field.fieldKey}</span>
                        {field.unit && <span className="text-xs text-muted-foreground shrink-0">({field.unit})</span>}
                      </div>
                      {(field.showInFilter || field.showInDetail || field.showInPriceList || (field.options?.length ?? 0) > 0) && (
                        <div className="flex gap-2 text-[11px] text-muted-foreground mt-0.5">
                          {field.showInFilter && <span>Filter</span>}
                          {field.showInDetail && <span>Detail</span>}
                          {field.showInPriceList && <span>Price&nbsp;list</span>}
                          {field.options && field.options.length > 0 && <span>{field.options.length}&nbsp;options</span>}
                        </div>
                      )}
                    </div>
                    {/* Applies-to is now an editable column, not a static badge */}
                    <select
                      value={field.appliesTo}
                      onChange={(e) => changeAppliesTo(field, e.target.value as AppliesTo)}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                      title="Does this field apply to the product, or to each variant?"
                    >
                      <option value="product">Product</option>
                      <option value="variant">Variant</option>
                    </select>
                    {field.fieldType === "select" && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setExpandedId(expandedId === field.id ? null : field.id)}>
                        {expandedId === field.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleRemoveAssignment(field.assignmentId)} title="Remove from category">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>

                  {expandedId === field.id && field.fieldType === "select" && (
                    <div className="px-2 pb-2">
                      <FieldOptionsPanel field={field} onFieldUpdate={(updated) => {
                        onFieldsChange(fields.map((f) => f.id === updated.id ? updated : f));
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
// Settings Tab
// ============================================================================

function SettingsTab({ category, pricingUnits }: { category: CatalogCategory; pricingUnits: PricingUnit[] }) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [desc, setDesc] = useState(category.description || "");
  const [unit, setUnit] = useState<PrimaryUnit>(category.primaryUnit);
  const [active, setActive] = useState(category.isActive);
  const [visAgents, setVisAgents] = useState(category.visibleAgents);
  const [visInternal, setVisInternal] = useState(category.visibleInternal);
  const [visMarketing, setVisMarketing] = useState(category.visibleMarketing);
  const pctStr = (v: number | null) => (v != null ? String(v) : "");
  const [commStd, setCommStd] = useState(pctStr(category.commissionStandardPct));
  const [commMaxDisc, setCommMaxDisc] = useState(pctStr(category.commissionMaxDiscountPct));
  const [commDisc, setCommDisc] = useState(pctStr(category.commissionDiscountedPct));
  const [imagePath, setImagePath] = useState<string | null>(category.imageStoragePath);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletionInfo, setDeletionInfo] = useState<{ productCount: number; variantCount: number } | null>(null);

  const imageUrl = imagePath ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog/${imagePath}` : null;

  const hasChanges = name !== category.name || slug !== category.slug ||
    desc !== (category.description || "") || unit !== category.primaryUnit ||
    active !== category.isActive ||
    visAgents !== category.visibleAgents ||
    visInternal !== category.visibleInternal ||
    visMarketing !== category.visibleMarketing ||
    commStd !== pctStr(category.commissionStandardPct) ||
    commMaxDisc !== pctStr(category.commissionMaxDiscountPct) ||
    commDisc !== pctStr(category.commissionDiscountedPct);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadCategoryImage(category.id, fd);
    setUploading(false);
    if (result.success) { setImagePath(`categories/${category.id}.${file.name.split(".").pop() || "jpg"}`); toast.success("Image uploaded"); }
    else toast.error(result.error);
  };

  const handleImageRemove = async () => {
    const result = await removeCategoryImage(category.id);
    if (result.success) { setImagePath(null); toast.success("Image removed"); }
    else toast.error(result.error);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await saveCategory({
      id: category.id,
      name: name.trim(),
      slug: slug.trim(),
      description: desc.trim() || null,
      primaryUnit: unit,
      commissionStandardPct: commStd.trim() ? Number(commStd) : null,
      commissionMaxDiscountPct: commMaxDisc.trim() ? Number(commMaxDisc) : null,
      commissionDiscountedPct: commDisc.trim() ? Number(commDisc) : null,
      isActive: active,
      visibleAgents: visAgents,
      visibleInternal: visInternal,
      visibleMarketing: visMarketing,
    });
    setSaving(false);
    if (result.success) {
      toast.success("Category updated");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const openDeleteConfirm = async () => {
    const info = await getCategoryDeletionInfo(category.id);
    setDeletionInfo(info.success ? info.data : { productCount: 0, variantCount: 0 });
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteCategory(category.id);
    setDeleting(false);
    if (result.success) {
      toast.success("Category deleted");
      router.push("/admin/catalog/categories");
    } else {
      toast.error(result.error);
      setConfirmOpen(false);
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
          <label className="text-sm font-medium">Category Image</label>
          <p className="text-xs text-muted-foreground">Shown on the agent app catalog with the category name.</p>
          <div className="flex items-center gap-3 mt-1">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="h-20 w-28 rounded-md object-cover border" />
            ) : (
              <div className="h-20 w-28 rounded-md border bg-muted flex items-center justify-center text-xs text-muted-foreground">No image</div>
            )}
            <div className="flex flex-col gap-2">
              <label className="inline-flex">
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
                <Button size="sm" asChild disabled={uploading}>
                  <span>{uploading ? "Uploading..." : imageUrl ? "Replace" : "Upload Image"}</span>
                </Button>
              </label>
              {imageUrl && <Button size="sm" variant="outline" className="text-destructive" onClick={handleImageRemove}>Remove</Button>}
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Primary Pricing Unit</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {pricingUnits.map((u) => <option key={u.code} value={u.code}>{u.name} ({u.symbol})</option>)}
          </select>
        </div>
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <div className="text-sm font-medium">Agent commission</div>
          <p className="text-xs text-muted-foreground">Percentages only. Money is computed from the sale price. Commission scales linearly between the standard rate (no discount) and the discounted rate (at max discount).</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Standard %</label>
              <Input type="number" step="0.1" value={commStd} onChange={(e) => setCommStd(e.target.value)} placeholder="e.g. 20" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Max discount %</label>
              <Input type="number" step="0.1" value={commMaxDisc} onChange={(e) => setCommMaxDisc(e.target.value)} placeholder="e.g. 20" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Commission % at max discount</label>
              <Input type="number" step="0.1" value={commDisc} onChange={(e) => setCommDisc(e.target.value)} placeholder="e.g. 10" />
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (visible in catalog)
        </label>
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <div className="text-sm font-medium">Surface visibility</div>
          <p className="text-xs text-muted-foreground">Control which apps show this category. Uncheck to hide it from that surface.</p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={visAgents} onChange={(e) => setVisAgents(e.target.checked)} />
            Agents app
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={visInternal} onChange={(e) => setVisInternal(e.target.checked)} />
            Internal (deals / orders)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={visMarketing} onChange={(e) => setVisMarketing(e.target.checked)} />
            Marketing
          </label>
        </div>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="rounded-lg border border-destructive/30 bg-card p-5">
        <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Deleting a category permanently removes the category, its field assignments,
          and <strong>all products and variants inside it</strong>.
        </p>
        <Button variant="outline" className="text-destructive border-destructive/30" onClick={openDeleteConfirm} disabled={deleting}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Category
        </Button>
      </div>

      {/* Confirmation dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !deleting && setConfirmOpen(false)}>
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Delete &quot;{category.name}&quot;?</h3>
                <p className="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
              </div>
            </div>

            {deletionInfo && deletionInfo.productCount > 0 ? (
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 text-sm">
                <p className="font-medium text-destructive">
                  This will permanently delete:
                </p>
                <ul className="mt-2 space-y-1 text-foreground">
                  <li>• The category and its field assignments</li>
                  <li>• <strong>{deletionInfo.productCount}</strong> product{deletionInfo.productCount !== 1 ? "s" : ""}</li>
                  <li>• <strong>{deletionInfo.variantCount}</strong> variant{deletionInfo.variantCount !== 1 ? "s" : ""} (with their prices, images, and field values)</li>
                </ul>
                <p className="mt-2 text-muted-foreground">
                  All product data inside this category will be lost irreversibly.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This category has no products. The category and its field assignments will be removed.
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
              <Button className="bg-destructive text-white hover:bg-destructive/90" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Everything"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
