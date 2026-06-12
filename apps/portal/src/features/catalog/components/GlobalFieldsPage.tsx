"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil, List, Hash, Type, ToggleLeft, Search } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { saveField, deleteField, saveFieldOption, deleteFieldOption } from "../actions/fields";
import type { CatalogField, FieldOption, FieldType } from "../types";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "select", label: "Select (dropdown)" },
  { value: "number", label: "Number" },
  { value: "text", label: "Text" },
  { value: "boolean", label: "Yes/No" },
];

const TYPE_ICON: Record<string, typeof List> = {
  select: List,
  number: Hash,
  text: Type,
  boolean: ToggleLeft,
};

interface FieldWithAssignments extends CatalogField {
  assignments?: { categoryId: string; categoryName: string; appliesTo: string }[];
}

interface Props {
  fields: FieldWithAssignments[];
}

export function GlobalFieldsPage({ fields: initialFields }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAppliesTo, setFilterAppliesTo] = useState<string>("all");

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredFields = useMemo(() => {
    return fields.filter((f) => {
      if (search && !f.fieldLabel.toLowerCase().includes(search.toLowerCase()) && !f.fieldKey.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType !== "all" && f.fieldType !== filterType) return false;
      if (filterAppliesTo !== "all") {
        const hasMatch = f.assignments?.some((a) => a.appliesTo === filterAppliesTo);
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [fields, search, filterType, filterAppliesTo]);

  const resetForm = () => {
    setKey(""); setLabel(""); setType("text"); setUnit("");
    setShowForm(false); setEditingId(null);
  };

  const startEdit = (f: CatalogField) => {
    setEditingId(f.id); setKey(f.fieldKey); setLabel(f.fieldLabel);
    setType(f.fieldType); setUnit(f.unit || ""); setShowForm(true);
  };

  const handleSave = async () => {
    if (!key.trim() || !label.trim()) { toast.error("Key and label required"); return; }
    setSaving(true);
    const result = await saveField({
      id: editingId ?? undefined,
      fieldKey: key.trim().toLowerCase().replace(/\s+/g, "_"),
      fieldLabel: label.trim(),
      fieldType: type,
      unit: unit.trim() || null,
    });
    setSaving(false);
    if (result.success) {
      toast.success(editingId ? "Field updated" : "Field created");
      if (editingId) {
        setFields(fields.map((f) => f.id === editingId ? { ...result.data, assignments: (f as FieldWithAssignments).assignments } : f));
      } else {
        setFields([...fields, { ...result.data, assignments: [] }]);
      }
      resetForm();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this field globally? It will be removed from all categories.")) return;
    const result = await deleteField(id);
    if (result.success) {
      setFields(fields.filter((f) => f.id !== id));
      toast.success("Field deleted");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Fields</h1>
          <p className="text-muted-foreground">Global field definitions shared across all categories</p>
        </div>
        {!showForm && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Field
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields..."
            className="pl-9"
          />
        </div>
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All types</option>
          <option value="select">Select</option>
          <option value="number">Number</option>
          <option value="text">Text</option>
          <option value="boolean">Boolean</option>
        </select>
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filterAppliesTo}
          onChange={(e) => setFilterAppliesTo(e.target.value)}
        >
          <option value="all">All levels</option>
          <option value="product">Product-level</option>
          <option value="variant">Variant-level</option>
        </select>
        <span className="text-sm text-muted-foreground">{filteredFields.length} of {fields.length}</span>
      </div>

      {showForm && (() => {
        const editingField = fields.find((f) => f.id === editingId);
        const lockSystem = !!editingField?.isSystem;
        return (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h3 className="font-semibold">{editingId ? "Edit Field" : "New Field"}{lockSystem && <span className="ml-2 text-xs font-normal text-amber-700">System field — key &amp; type are locked</span>}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Key</label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="wood_species" className="text-sm" disabled={lockSystem} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Label</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Species" className="text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Type</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as FieldType)} disabled={lockSystem}>
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Unit (optional)</label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="mm" className="text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
            <Button size="sm" variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
        );
      })()}

      <div className="space-y-2">
        {filteredFields.map((field) => {
          const Icon = TYPE_ICON[field.fieldType] || Type;
          const fa = field as FieldWithAssignments;
          return (
            <div key={field.id}>
              <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{field.fieldLabel}</span>
                    <span className="text-xs text-muted-foreground font-mono">{field.fieldKey}</span>
                    {field.unit && <span className="text-xs text-muted-foreground">({field.unit})</span>}
                    {field.isSystem && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium" title="System dimension field — pricing depends on it">
                        System · {field.dimensionRole}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {fa.assignments && fa.assignments.length > 0 ? (
                      fa.assignments.map((a, i) => (
                        <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${a.appliesTo === "product" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
                          {a.categoryName} ({a.appliesTo})
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Not assigned to any category</span>
                    )}
                    {field.options && field.options.length > 0 && (
                      <span className="text-xs text-muted-foreground">{field.options.length} options</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {field.fieldType === "select" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(expandedId === field.id ? null : field.id)}>
                      {expandedId === field.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(field)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {!field.isSystem && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(field.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              {expandedId === field.id && field.fieldType === "select" && (
                <FieldOptionsPanel
                  field={field}
                  onUpdate={(updated) => setFields(fields.map((f) => f.id === updated.id ? { ...updated, assignments: (f as FieldWithAssignments).assignments } : f))}
                />
              )}
            </div>
          );
        })}
        {filteredFields.length === 0 && (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">{search || filterType !== "all" || filterAppliesTo !== "all" ? "No fields match your filters." : "No fields defined yet."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldOptionsPanel({ field, onUpdate }: { field: CatalogField; onUpdate: (f: CatalogField) => void }) {
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
      onUpdate({ ...field, options: updated });
      setNewValue(""); setNewLabel(""); setNewDesc("");
      toast.success("Option added");
    } else {
      toast.error(result.error);
    }
  };

  const handleDeleteOpt = async (id: string) => {
    const result = await deleteFieldOption(id);
    if (result.success) {
      const updated = options.filter((o) => o.id !== id);
      setOptions(updated);
      onUpdate({ ...field, options: updated });
      toast.success("Option removed");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="ml-11 mt-1 mb-2 rounded-lg border bg-muted/30 p-4 space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Options for &quot;{field.fieldLabel}&quot;
      </h4>
      {options.map((opt) => (
        <div key={opt.id} className="flex items-center gap-3 text-sm">
          <span className="font-medium w-28 truncate">{opt.value}</span>
          <span className="text-muted-foreground flex-1 truncate">{opt.label}</span>
          {opt.description && <span className="text-xs text-muted-foreground truncate max-w-[250px]" title={opt.description}>{opt.description}</span>}
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDeleteOpt(opt.id)}>
            <Trash2 className="h-3 w-3 text-destructive" />
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
          <label className="text-xs font-medium">Description</label>
          <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Rich description..." className="text-sm h-8" />
        </div>
        <Button size="sm" className="h-8" onClick={handleAdd} disabled={saving}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}
