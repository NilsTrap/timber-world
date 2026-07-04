"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Search, ImageIcon, Plus } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { deleteProduct } from "../actions/products";
import { catalogImageUrl } from "./CatalogImages";
import { NewProductDialog } from "./NewProductDialog";
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
  primaryImagePath: string | null;
  stockPieces: number;
  fieldValues: { option?: { label: string } | null; valueText: string | null }[];
}

interface Props {
  products: ProductWithCategory[];
  categories: CatalogCategory[];
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-primary-foreground/20" : "bg-muted-foreground/15 text-muted-foreground"}`}>{count}</span>
    </button>
  );
}

export function AllProductsPage({ products: initialProducts, categories }: Props) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showNewProduct, setShowNewProduct] = useState(false);

  const countByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) m[p.categoryId] = (m[p.categoryId] ?? 0) + 1;
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) =>
      (categoryFilter === "all" || p.categoryId === categoryFilter) &&
      (q === "" ||
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q))
    );
  }, [products, categoryFilter, search]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAllVisible = () => {
    const next = new Set(selected);
    if (allVisibleSelected) filtered.forEach((p) => next.delete(p.id));
    else filtered.forEach((p) => next.add(p.id));
    setSelected(next);
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
    <div className="space-y-4">
      {/* Header + search */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">{products.length} products across {categories.length} categories</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64 max-w-full">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="h-9 pl-8" />
          </div>
          <Button className="h-9 shrink-0" onClick={() => setShowNewProduct(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add product
          </Button>
        </div>
      </div>

      <NewProductDialog
        open={showNewProduct}
        onOpenChange={setShowNewProduct}
        categories={categories}
        defaultCategoryId={categoryFilter !== "all" ? categoryFilter : undefined}
      />

      {/* Category filter chips with counts */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip label="All" count={products.length} active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")} />
        {categories.map((c) => (
          <FilterChip key={c.id} label={c.name} count={countByCategory[c.id] ?? 0} active={categoryFilter === c.id} onClick={() => setCategoryFilter(c.id)} />
        ))}
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
        <table className="w-full text-sm [&_th]:h-9 [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_td]:px-3 [&_td]:py-1.5">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="w-10"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} /></th>
              <th className="w-12"></th>
              <th>Product</th>
              <th>Category</th>
              <th className="text-center">Variants</th>
              <th className="text-right">Stock</th>
              <th className="text-center">Active</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.id}
                className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                onClick={() => router.push(`/admin/catalog/${p.categoryId}/products/${p.id}`)}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />
                </td>
                <td>
                  {p.primaryImagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={catalogImageUrl(p.primaryImagePath)} alt="" className="h-8 w-8 rounded object-cover border" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded border bg-muted/40 text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" />
                    </div>
                  )}
                </td>
                <td>
                  <div className="font-medium">{p.name}</div>
                  {p.fieldValues && p.fieldValues.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {p.fieldValues.map((fv) => fv.option?.label || fv.valueText).filter(Boolean).join(" · ")}
                    </div>
                  )}
                </td>
                <td className="text-muted-foreground">{p.categoryName}</td>
                <td className="text-center">{p.variantCount ?? 0}</td>
                <td className="text-right tabular-nums">
                  {p.stockPieces > 0
                    ? <span>{p.stockPieces.toLocaleString("en-GB")} <span className="text-xs text-muted-foreground">pcs</span></span>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="text-center">
                  {p.isActive ? <span className="text-green-600">✓</span> : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  {products.length === 0 ? "No products yet. Create products within a category." : "No products match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
