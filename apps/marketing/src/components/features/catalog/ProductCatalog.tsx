"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@timber/ui";
import type { Product, ProductType } from "@timber/database";
import { ProductFilter } from "./ProductFilter";
import { ProductFilterDrawer } from "./ProductFilterDrawer";
import { ProductTable } from "./ProductTable";
import { ProductGrid } from "./ProductGrid";
import { ProductSelectionBar } from "./ProductSelectionBar";
import { getProducts, type ProductFilters, type ProductsResponse, type FilterOptions } from "@/lib/actions/products";

interface ProductCatalogProps {
  initialProducts: ProductsResponse;
  initialFilters: ProductFilters;
  initialPage: number;
  initialSortBy?: string;
  initialSortOrder: "asc" | "desc";
  filterOptions: FilterOptions;
}

export function ProductCatalog({
  initialProducts,
  initialFilters,
  initialPage,
  initialSortBy,
  initialSortOrder,
  filterOptions,
}: ProductCatalogProps) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // State
  const [products, setProducts] = useState<Product[]>(initialProducts.products);
  const [total, setTotal] = useState(initialProducts.total);
  const [page, setPage] = useState(initialPage);
  const [filters, setFilters] = useState<ProductFilters>(initialFilters);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortOrder);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const pageSize = initialProducts.pageSize;
  const totalPages = Math.ceil(total / pageSize);

  // Sync URL with state
  const updateUrl = useCallback((newFilters: ProductFilters, newPage: number, newSortBy?: string, newSortOrder?: "asc" | "desc") => {
    const params = new URLSearchParams();

    // Add filters to URL
    if (newFilters.species?.length) newFilters.species.forEach(v => params.append("species", v));
    if (newFilters.width?.length) newFilters.width.forEach(v => params.append("width", v));
    if (newFilters.length?.length) newFilters.length.forEach(v => params.append("length", v));
    if (newFilters.thickness?.length) newFilters.thickness.forEach(v => params.append("thickness", v));
    if (newFilters.qualityGrade?.length) newFilters.qualityGrade.forEach(v => params.append("qualityGrade", v));
    if (newFilters.type?.length) newFilters.type.forEach(v => params.append("type", v));
    if (newFilters.humidity?.length) newFilters.humidity.forEach(v => params.append("humidity", v));
    if (newFilters.processing?.length) newFilters.processing.forEach(v => params.append("processing", v));
    if (newFilters.fscCertified !== undefined) params.set("fscCertified", String(newFilters.fscCertified));

    // Add pagination and sorting
    if (newPage > 1) params.set("page", String(newPage));
    if (newSortBy) params.set("sortBy", newSortBy);
    if (newSortOrder && newSortOrder !== "asc") params.set("sortOrder", newSortOrder);

    const queryString = params.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [pathname, router]);

  // Fetch products with current filters
  const fetchProducts = useCallback(async (newFilters: ProductFilters, newPage: number, newSortBy?: string, newSortOrder?: "asc" | "desc") => {
    startTransition(async () => {
      const result = await getProducts(newFilters, newPage, newSortBy, newSortOrder);
      if (result.success) {
        setProducts(result.data.products);
        setTotal(result.data.total);
        setPage(result.data.page);
      }
      updateUrl(newFilters, newPage, newSortBy, newSortOrder);
    });
  }, [updateUrl]);

  // Filter handlers
  const handleFilterChange = useCallback((key: keyof ProductFilters, values: string[]) => {
    const newFilters = { ...filters, [key]: values.length > 0 ? values : undefined };
    setFilters(newFilters);
    fetchProducts(newFilters, 1, sortBy, sortOrder);
  }, [filters, sortBy, sortOrder, fetchProducts]);

  const handleFscChange = useCallback((value: boolean | undefined) => {
    const newFilters = { ...filters, fscCertified: value };
    setFilters(newFilters);
    fetchProducts(newFilters, 1, sortBy, sortOrder);
  }, [filters, sortBy, sortOrder, fetchProducts]);

  const handleClearFilters = useCallback(() => {
    const newFilters: ProductFilters = {};
    setFilters(newFilters);
    fetchProducts(newFilters, 1, sortBy, sortOrder);
  }, [sortBy, sortOrder, fetchProducts]);

  // Sorting handlers
  const handleSortChange = useCallback((column: string, order: "asc" | "desc") => {
    setSortBy(column);
    setSortOrder(order);
    fetchProducts(filters, 1, column, order);
  }, [filters, fetchProducts]);

  // Pagination handlers
  const handlePageChange = useCallback((newPage: number) => {
    fetchProducts(filters, newPage, sortBy, sortOrder);
  }, [filters, sortBy, sortOrder, fetchProducts]);

  // Selection handlers
  const handleToggleSelect = useCallback((productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedProducts(new Set(products.map(p => p.id)));
  }, [products]);

  const handleClearSelection = useCallback(() => {
    setSelectedProducts(new Set());
  }, []);

  // Count active filters
  const activeFilterCount = Object.values(filters).filter(v =>
    v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  return (
    <div className="container mx-auto pl-0 pr-4">
      {/* Header */}
      <div className="py-1 flex items-baseline gap-6">
        <h1 className="text-3xl font-semibold tracking-tight text-charcoal">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">
          {t("subtitleShort")}
        </p>
      </div>

      <div className="flex gap-8 mt-4" style={{ height: 'calc(100vh - 13rem)' }}>
        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:block w-[220px] flex-shrink-0 overflow-y-auto pr-2">
          <ProductFilter
            filters={filters}
            filterOptions={filterOptions}
            activeFilterCount={activeFilterCount}
            onFilterChange={handleFilterChange}
            onFscChange={handleFscChange}
            onClearFilters={handleClearFilters}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {/* Mobile Filter Button + Results Count */}
          <div className="flex items-center justify-between mb-4">
            <div className="lg:hidden">
              <ProductFilterDrawer
                filters={filters}
                filterOptions={filterOptions}
                activeFilterCount={activeFilterCount}
                onFilterChange={handleFilterChange}
                onFscChange={handleFscChange}
                onClearFilters={handleClearFilters}
              />
            </div>
            <p className={cn(
              "text-sm text-muted-foreground",
              isPending && "opacity-50"
            )}>
              {t("productCount", { count: total })}
            </p>
          </div>

          {/* Products Display */}
          {products.length > 0 ? (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block">
                <ProductTable
                  products={products}
                  selectedProducts={selectedProducts}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onToggleSelect={handleToggleSelect}
                  onSelectAll={handleSelectAll}
                  onSortChange={handleSortChange}
                  isPending={isPending}
                />
              </div>

              {/* Mobile/Tablet Cards */}
              <div className="lg:hidden">
                <ProductGrid
                  products={products}
                  selectedProducts={selectedProducts}
                  onToggleSelect={handleToggleSelect}
                  isPending={isPending}
                />
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t("pagination.showing", {
                      from: (page - 1) * pageSize + 1,
                      to: Math.min(page * pageSize, total),
                      total,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1 || isPending}
                      className="px-3 py-1.5 text-sm rounded-md border border-input bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t("pagination.previous")}
                    </button>
                    <span className="text-sm">
                      {t("pagination.page", { current: page, total: totalPages })}
                    </span>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages || isPending}
                      className="px-3 py-1.5 text-sm rounded-md border border-input bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t("pagination.next")}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 bg-background rounded-lg border">
              <p className="text-lg font-medium text-charcoal">{t("noResults")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("noResultsHint")}</p>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="mt-4 text-sm text-forest-green hover:underline"
                >
                  {t("clearFilters")}
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Selection Bar */}
      <ProductSelectionBar
        selectedCount={selectedProducts.size}
        selectedIds={Array.from(selectedProducts)}
        onClearSelection={handleClearSelection}
      />
    </div>
  );
}
