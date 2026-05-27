"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil } from "lucide-react";
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

interface Props {
  fields: CatalogField[];
}

export function GlobalFieldsPage({ fields: initialFields }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);

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
        setFields(fields.map((f) => f.id === editingId ? result.data : f));
      } else {
        setFields([...fields, result.data]);
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

      {showForm && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h3 className="font-semibold">{editingId ? "Edit Field" : "New Field"}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Key</label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="wood_species" className="text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Label</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Species" className="text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Type</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as FieldType)}>
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
      )}

      <div className="space-y-2">
        {fields.map((field) => (
          <div key={field.id}>
            <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{field.fieldLabel}</span>
                  <span className="text-xs text-muted-foreground font-mono">{field.fieldKey}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{field.fieldType}</span>
                  {field.unit && <span className="text-xs text-muted-foreground">({field.unit})</span>}
                </div>
                {field.options && field.options.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-0.5">{field.options.length} options</div>
                )}
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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(field.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>

            {expandedId === field.id && field.fieldType === "select" && (
              <FieldOptionsPanel
                field={field}
                onUpdate={(updated) => setFields(fields.map((f) => f.id === updated.id ? updated : f))}
              />
            )}
          </div>
        ))}
        {fields.length === 0 && !showForm && (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground mb-3">No fields defined yet.</p>
            <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" /> Create First Field</Button>
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
    <div className="ml-6 mt-1 mb-2 rounded-lg border bg-muted/30 p-4 space-y-3">
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
