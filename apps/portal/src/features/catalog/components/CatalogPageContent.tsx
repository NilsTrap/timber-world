"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Layers, Copy } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { saveCategory, duplicateCategory } from "../actions/categories";
import type { CatalogCategory, PrimaryUnit, PricingUnit } from "../types";

interface Props {
  categories: CatalogCategory[];
  pricingUnits: PricingUnit[];
}

export function CatalogPageContent({ categories, pricingUnits }: Props) {
  const router = useRouter();
  const unitSymbol = (code: string) => pricingUnits.find((u) => u.code === code)?.symbol ?? code;
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [unit, setUnit] = useState<PrimaryUnit>(pricingUnits[0]?.code ?? "m2");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    setSaving(true);
    const result = await saveCategory({ name: name.trim(), slug: slug.trim(), primaryUnit: unit });
    setSaving(false);
    if (result.success) {
      toast.success(`Category "${result.data.name}" created`);
      setShowForm(false);
      setName("");
      setSlug("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">Manage product categories, fields, and variants</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold">New Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug || slug === toSlug(name)) {
                    setSlug(toSlug(e.target.value));
                  }
                }}
                placeholder="Solid Wood Panels"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Slug</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="solid-wood-panels" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Primary Unit</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {pricingUnits.map((u) => <option key={u.code} value={u.code}>{u.name} ({u.symbol})</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Category"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {categories.length === 0 && !showForm ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-1">No categories yet</h2>
          <p className="text-muted-foreground mb-4">Create your first product category to get started</p>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/admin/catalog/${cat.id}`}
              className="rounded-lg border bg-card p-5 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                {!cat.isActive && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Inactive</span>
                )}
              </div>
              <h3 className="font-semibold group-hover:text-primary transition-colors">{cat.name}</h3>
              {cat.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{cat.description}</p>
              )}
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{cat.fieldCount ?? 0} fields</span>
                  <span>{cat.productCount ?? 0} products</span>
                  <span>{unitSymbol(cat.primaryUnit)}</span>
                </div>
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const result = await duplicateCategory(cat.id);
                    if (result.success) {
                      toast.success(`Duplicated as "${result.data.name}"`);
                      router.refresh();
                    } else {
                      toast.error(result.error);
                    }
                  }}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Duplicate category"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function toSlug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
