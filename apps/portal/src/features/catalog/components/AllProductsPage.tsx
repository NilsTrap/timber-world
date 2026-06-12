"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, ExternalLink } from "lucide-react";
import { Button } from "@timber/ui";
import { toast } from "sonner";
import { deleteProduct } from "../actions/products";
import type { CatalogCategory } from "../types";

interface ProductWithCategory {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  variantCount: number;
  fieldValues: { option?: { label: string } | null; valueText: string | null }[];
}

interface Props {
  products: ProductWithCategory[];
  categories: CatalogCategory[];
}

export function AllProductsPage({ products: initialProducts, categories }: Props) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const allSelected = products.length > 0 && selected.size === products.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} product(s)? This cannot be undone.`)) return;
    setDeleting(true);
    let deleted = 0;
    for (const id of selected) {
      const result = await deleteProduct(id);
      if (result.success) deleted++;
    }
    setDeleting(false);
    setProducts(products.filter((p) => !selected.has(p.id)));
    setSelected(new Set());
    toast.success(`Deleted ${deleted} product(s)`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">All Products</h1>
          <p className="text-muted-foreground">{products.length} products across {categories.length} categories</p>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" className="text-destructive" onClick={handleBulkDelete} disabled={deleting}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> {deleting ? "Deleting..." : "Delete Selected"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-10 px-3 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="text-left px-3 py-2 font-medium">Product</th>
              <th className="text-left px-3 py-2 font-medium">Category</th>
              <th className="text-center px-3 py-2 font-medium">Variants</th>
              <th className="text-center px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/catalog/${p.categoryId}/products/${p.id}`}
                    className="font-medium hover:text-primary transition-colors"
                  >
                    {p.name}
                  </Link>
                  {p.fieldValues && p.fieldValues.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.fieldValues.map((fv) => fv.option?.label || fv.valueText).filter(Boolean).join(" · ")}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{p.categoryName}</td>
                <td className="px-3 py-2 text-center">{p.variantCount ?? 0}</td>
                <td className="px-3 py-2 text-center">
                  {p.isActive ? <span className="text-green-600">✓</span> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/catalog/${p.categoryId}/products/${p.id}`}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No products yet. Create products within a category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
