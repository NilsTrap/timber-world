"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Search, ImageIcon, Plus, Power, PowerOff, Eye, FolderInput, X } from "lucide-react";
import {
  Button,
  Input,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@timber/ui";
import { toast } from "sonner";
import {
  bulkDeleteProducts,
  bulkSetProductsActive,
  bulkSetProductsVisibility,
  bulkMoveProductsToCategory,
} from "../actions/products";
import { catalogImageUrl } from "./CatalogImages";
import { NewProductDialog } from "./NewProductDialog";
import type { CatalogCategory } from "../types";

/** Tri-state per-surface visibility choice used by the "Set visibility" dialog. */
type VisChoice = "keep" | "show" | "hide";

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
  const [busy, setBusy] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showNewProduct, setShowNewProduct] = useState(false);

  // Bulk-delete is a two-step confirm: 0 = closed, 1 = review, 2 = final "sure?".
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  // Set-visibility dialog (tri-state per surface).
  const [visOpen, setVisOpen] = useState(false);
  const [visAgents, setVisAgents] = useState<VisChoice>("keep");
  const [visInternal, setVisInternal] = useState<VisChoice>("keep");
  const [visMarketing, setVisMarketing] = useState<VisChoice>("keep");
  // Move-to-category dialog.
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveCategoryId, setMoveCategoryId] = useState("");

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

  // Selected products (in table order) + roll-up of variants they carry.
  const selectedProducts = useMemo(() => products.filter((p) => selected.has(p.id)), [products, selected]);
  const selectedVariantCount = useMemo(
    () => selectedProducts.reduce((s, p) => s + (p.variantCount ?? 0), 0),
    [selectedProducts]
  );
  const n = selected.size;
  const s = (count: number) => (count === 1 ? "" : "s");

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    const result = await bulkDeleteProducts(ids);
    setBusy(false);
    setDeleteStep(0);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setProducts(products.filter((p) => !selected.has(p.id)));
    setSelected(new Set());
    toast.success(`Deleted ${result.data.deleted} product${s(result.data.deleted)}`);
    router.refresh();
  };

  const handleSetActive = async (isActive: boolean) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    const result = await bulkSetProductsActive(ids, isActive);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setProducts(products.map((p) => (selected.has(p.id) ? { ...p, isActive } : p)));
    toast.success(`${isActive ? "Activated" : "Deactivated"} ${result.data.updated} product${s(result.data.updated)}`);
    router.refresh();
  };

  const openVisibility = () => {
    setVisAgents("keep");
    setVisInternal("keep");
    setVisMarketing("keep");
    setVisOpen(true);
  };

  const handleVisibilityApply = async () => {
    const patch: { visibleAgents?: boolean; visibleInternal?: boolean; visibleMarketing?: boolean } = {};
    if (visAgents !== "keep") patch.visibleAgents = visAgents === "show";
    if (visInternal !== "keep") patch.visibleInternal = visInternal === "show";
    if (visMarketing !== "keep") patch.visibleMarketing = visMarketing === "show";
    if (Object.keys(patch).length === 0) {
      toast.error("Pick at least one surface to change");
      return;
    }
    const ids = Array.from(selected);
    setBusy(true);
    const result = await bulkSetProductsVisibility(ids, patch);
    setBusy(false);
    setVisOpen(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Updated visibility on ${result.data.updated} product${s(result.data.updated)}`);
    router.refresh();
  };

  const openMove = () => {
    setMoveCategoryId("");
    setMoveOpen(true);
  };

  const handleMoveApply = async () => {
    if (!moveCategoryId) {
      toast.error("Pick a target category");
      return;
    }
    const ids = Array.from(selected);
    setBusy(true);
    const result = await bulkMoveProductsToCategory(ids, moveCategoryId);
    setBusy(false);
    setMoveOpen(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const cat = categories.find((c) => c.id === moveCategoryId);
    setProducts(
      products.map((p) =>
        selected.has(p.id)
          ? { ...p, categoryId: moveCategoryId, categoryName: cat?.name ?? p.categoryName, categorySlug: cat?.slug ?? p.categorySlug }
          : p
      )
    );
    setSelected(new Set());
    toast.success(`Moved ${result.data.updated} product${s(result.data.updated)} to ${cat?.name ?? "category"}`);
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium mr-1">{n} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleSetActive(true)} disabled={busy}>
            <Power className="h-3.5 w-3.5 mr-1" /> Activate
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleSetActive(false)} disabled={busy}>
            <PowerOff className="h-3.5 w-3.5 mr-1" /> Deactivate
          </Button>
          <Button size="sm" variant="outline" onClick={openVisibility} disabled={busy}>
            <Eye className="h-3.5 w-3.5 mr-1" /> Visibility
          </Button>
          <Button size="sm" variant="outline" onClick={openMove} disabled={busy}>
            <FolderInput className="h-3.5 w-3.5 mr-1" /> Move to category
          </Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteStep(1)} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={busy}>Clear</Button>
        </div>
      )}

      {/* ── Bulk delete: two-step confirmation ── */}
      <AlertDialog open={deleteStep > 0} onOpenChange={(o) => { if (!o && !busy) setDeleteStep(0); }}>
        <AlertDialogContent>
          {deleteStep === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {n} product{s(n)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to delete the following product{s(n)}. Review the list before continuing.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="max-h-44 overflow-y-auto rounded border bg-muted/40 p-2 text-sm">
                <ul className="space-y-0.5">
                  {selectedProducts.slice(0, 10).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{p.categoryName}</span>
                    </li>
                  ))}
                  {n > 10 && <li className="text-xs text-muted-foreground">+{n - 10} more…</li>}
                </ul>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                <Button variant="destructive" onClick={() => setDeleteStep(2)}>
                  Delete {n} product{s(n)}
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes {n} product{s(n)}
                  {selectedVariantCount > 0
                    ? ` and their ${selectedVariantCount} variant${s(selectedVariantCount)} (with all variant images, stock and packaging)`
                    : ""}
                  , plus product images and all field values. Any deals, inventory packages or agent orders that
                  referenced them keep their rows but lose the catalog link. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                <Button variant="destructive" onClick={handleBulkDelete} disabled={busy}>
                  {busy ? "Deleting…" : `Yes, delete ${n} product${s(n)} permanently`}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Set visibility ── */}
      {visOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setVisOpen(false)}
        >
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-lg">Set visibility</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Applies to {n} selected product{s(n)}. Leave a surface “Unchanged” to keep its current value.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mr-2 -mt-2" onClick={() => setVisOpen(false)} disabled={busy}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              {([
                ["Agents storefront", visAgents, setVisAgents],
                ["Internal portal", visInternal, setVisInternal],
                ["Marketing site", visMarketing, setVisMarketing],
              ] as [string, VisChoice, (v: VisChoice) => void][]).map(([label, value, setter]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{label}</span>
                  <select
                    className="flex h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={value}
                    onChange={(e) => setter(e.target.value as VisChoice)}
                  >
                    <option value="keep">Unchanged</option>
                    <option value="show">Show</option>
                    <option value="hide">Hide</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setVisOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={handleVisibilityApply} disabled={busy}>{busy ? "Applying…" : "Apply"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Move to category ── */}
      {moveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setMoveOpen(false)}
        >
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-lg">Move to category</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Moves {n} selected product{s(n)} to another category.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mr-2 -mt-2" onClick={() => setMoveOpen(false)} disabled={busy}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Target category</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={moveCategoryId}
                onChange={(e) => setMoveCategoryId(e.target.value)}
              >
                <option value="">— pick a category —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <p className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-muted-foreground">
              A category defines the product’s field set. Field values whose fields the target category does not use are
              <strong> kept but hidden</strong> — they stay in the database and reappear if you move the product back, but
              they are dropped the next time the product is saved. Nothing is deleted by the move itself.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={handleMoveApply} disabled={busy || !moveCategoryId}>{busy ? "Moving…" : "Move"}</Button>
            </div>
          </div>
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
