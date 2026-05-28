"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, X, Package } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { savePackagingType, deletePackagingType, type PackagingType } from "../actions/packagingTypes";

interface Props {
  types: PackagingType[];
}

export function PackagingTypesPage({ types: initialTypes }: Props) {
  const [types, setTypes] = useState(initialTypes);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pieces, setPieces] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName(""); setPieces(""); setDescription("");
    setShowForm(false); setEditingId(null);
  };

  const startEdit = (t: PackagingType) => {
    setEditingId(t.id);
    setName(t.name);
    setPieces(String(t.piecesPerPackage));
    setDescription(t.description || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !pieces || parseInt(pieces) <= 0) {
      toast.error("Name and a positive piece count are required");
      return;
    }
    setSaving(true);
    const result = await savePackagingType({
      id: editingId ?? undefined,
      name: name.trim(),
      piecesPerPackage: parseInt(pieces),
      description: description.trim() || null,
      sortOrder: editingId ? undefined : types.length,
    });
    setSaving(false);
    if (result.success) {
      toast.success(editingId ? "Packaging type updated" : "Packaging type created");
      if (editingId) {
        setTypes(types.map((t) => t.id === editingId ? result.data : t));
      } else {
        setTypes([...types, result.data]);
      }
      resetForm();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async (t: PackagingType) => {
    if (!confirm(`Delete packaging type "${t.name}"? It will be removed from any variants using it.`)) return;
    const result = await deletePackagingType(t.id);
    if (result.success) {
      setTypes(types.filter((x) => x.id !== t.id));
      toast.success("Packaging type deleted");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Packaging</h1>
          <p className="text-muted-foreground">Reusable packaging types that can be assigned to any variant</p>
        </div>
        {!showForm && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Packaging Type
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? "Edit Packaging Type" : "New Packaging Type"}</h3>
            <Button variant="ghost" size="icon" onClick={resetForm}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard Pallet" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Pieces per Package</label>
              <Input type="number" value={pieces} onChange={(e) => setPieces(e.target.value)} placeholder="10" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Description (optional)</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Standard pallet with 10 pieces" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {types.map((t) => (
          <div key={t.id} className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{t.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{t.piecesPerPackage} pcs</span>
                {!t.isActive && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">Inactive</span>}
              </div>
              {t.description && <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(t)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(t)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {types.length === 0 && !showForm && (
          <div className="rounded-lg border bg-card p-8 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-3">No packaging types yet.</p>
            <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" /> Create First Type</Button>
          </div>
        )}
      </div>
    </div>
  );
}
