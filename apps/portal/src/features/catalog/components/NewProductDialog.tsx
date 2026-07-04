"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, X } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { saveProduct } from "../actions/products";
import type { CatalogCategory } from "../types";

/** Derive a URL-safe slug from a free-text name. Matches CatalogPageContent.toSlug. */
function toSlug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Categories offered in the picker. Ignored when lockCategory is set. */
  categories: CatalogCategory[];
  /** Pre-selected category. On the category page this is fixed; on the products
   *  table it pre-fills the active chip filter (still editable). */
  defaultCategoryId?: string;
  /** When true, the category is fixed (no picker) — used on the category page. */
  lockCategory?: boolean;
}

/**
 * Shared "New product" dialog. Creates a catalog product (name + slug + category)
 * via saveProduct, then navigates to the product detail page where variants,
 * fields and images are managed.
 */
export function NewProductDialog({ open, onOpenChange, categories, defaultCategoryId, lockCategory }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const [saving, setSaving] = useState(false);

  // Reset the form each time the dialog opens (and re-apply the preset category).
  useEffect(() => {
    if (open) {
      setName("");
      setSlug("");
      setCategoryId(defaultCategoryId ?? "");
      setSaving(false);
    }
  }, [open, defaultCategoryId]);

  if (!open) return null;

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Product name is required"); return; }
    if (!categoryId) { toast.error("Pick a category"); return; }
    const finalSlug = slug.trim() || toSlug(name);
    if (!finalSlug) { toast.error("Slug is required"); return; }

    setSaving(true);
    const result = await saveProduct({ categoryId, name: name.trim(), slug: finalSlug });
    if (!result.success) {
      setSaving(false);
      toast.error(result.error);
      return;
    }
    toast.success(`Product "${result.data.name}" created`);
    onOpenChange(false);
    router.push(`/admin/catalog/${result.data.categoryId}/products/${result.data.id}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !saving && onOpenChange(false)}
    >
      <div
        className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">New product</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Create the product, then add variants, fields and images on the next page.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mr-2 -mt-2" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                // Auto-derive the slug while the user hasn't hand-edited it.
                if (!slug || slug === toSlug(name)) setSlug(toSlug(e.target.value));
              }}
              placeholder="Oak Panel 18mm"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="oak-panel-18mm" />
            <p className="text-xs text-muted-foreground">URL-safe identifier, auto-filled from the name. Editable.</p>
          </div>
          {!lockCategory && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Category</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">— pick a category —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim() || !categoryId}>
            {saving ? "Creating..." : "Create product"}
          </Button>
        </div>
      </div>
    </div>
  );
}
