"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { gbp } from "@/lib/pricing";
import { thumbUrl } from "@/lib/images";

export interface ProductCard {
  id: string;
  name: string;
  variantCount: number;
  fieldValues: Record<string, string>;
  imagePath: string | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
}

export interface FilterableField {
  fieldKey: string;
  fieldLabel: string;
  options: string[];
}

interface Props {
  categoryId: string;
  products: ProductCard[];
  filters: FilterableField[];
  unitSymbol: string;
  supabaseUrl: string;
}

export function CategoryProductsClient({ categoryId, products, filters, unitSymbol }: Props) {
  const [active, setActive] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    return products.filter((p) =>
      Object.entries(active).every(([key, val]) => !val || p.fieldValues[key] === val)
    );
  }, [products, active]);

  const setFilter = (key: string, value: string) => {
    setActive((prev) => {
      const next = { ...prev };
      if (!value || next[key] === value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const hasActiveFilters = Object.keys(active).length > 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      {filters.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--charcoal-light)]">Filter</span>
            {hasActiveFilters && (
              <button
                onClick={() => setActive({})}
                className="text-xs font-medium text-[var(--forest-green)]"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-2">
            {filters.map((field) => (
              <div key={field.fieldKey}>
                <div className="text-xs text-[var(--charcoal-light)] mb-1">{field.fieldLabel}</div>
                <div className="flex gap-1.5 flex-wrap">
                  {field.options.map((opt) => {
                    const isActive = active[field.fieldKey] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => setFilter(field.fieldKey, opt)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          isActive
                            ? "bg-[var(--forest-green)] text-white border-[var(--forest-green)]"
                            : "bg-white text-[var(--charcoal)] border-gray-200"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-[var(--charcoal-light)]">
        {filtered.length} product{filtered.length !== 1 ? "s" : ""}
        {hasActiveFilters && ` (filtered from ${products.length})`}
      </div>

      {/* Product list */}
      <div className="space-y-3">
        {filtered.map((product) => {
          const chips = Object.values(product.fieldValues);
          const thumb = product.imagePath ? thumbUrl(product.imagePath, 160) : null;
          const range = product.priceMinCents != null
            ? (product.priceMaxCents !== product.priceMinCents
                ? `${gbp(product.priceMinCents)} – ${gbp(product.priceMaxCents)}`
                : gbp(product.priceMinCents))
            : null;
          return (
            <Link
              key={product.id}
              href={`/catalog/${categoryId}/${product.id}`}
              className="flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              {thumb && (
                <img src={thumb} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base">{product.name}</div>
                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {chips.map((c, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[var(--warm-cream-dark)] text-[var(--charcoal)]">{c}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2 text-sm">
                  {range ? (
                    <span className="font-semibold text-[var(--forest-green)]">
                      {range}<span className="text-xs font-normal text-[var(--charcoal-light)]"> /{unitSymbol}</span>
                    </span>
                  ) : (
                    <span className="text-[var(--charcoal-light)]">Price on request</span>
                  )}
                  <span className="text-[var(--charcoal-light)]">· {product.variantCount} variant{product.variantCount !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <svg viewBox="0 0 24 24" fill="none" stroke="var(--charcoal-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 self-center flex-shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-[var(--charcoal-light)]">
            {products.length === 0 ? "No products available in this category yet." : "No products match the selected filters."}
          </div>
        )}
      </div>
    </div>
  );
}
