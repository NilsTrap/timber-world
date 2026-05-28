"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export interface ProductCard {
  id: string;
  name: string;
  variantCount: number;
  fieldValues: Record<string, string>;
  imagePath: string | null;
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
  unitLabel: string;
  supabaseUrl: string;
}

export function CategoryProductsClient({ categoryId, products, filters, unitLabel, supabaseUrl }: Props) {
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
      <div className="text-xs text-[var(--charcoal-light)]">
        {filtered.length} product{filtered.length !== 1 ? "s" : ""}
        {hasActiveFilters && ` (filtered from ${products.length})`}
      </div>

      {/* Product list */}
      <div className="space-y-3">
        {filtered.map((product) => {
          const fieldLabels = Object.values(product.fieldValues);
          return (
            <Link
              key={product.id}
              href={`/catalog/${categoryId}/${product.id}`}
              className="flex gap-3 rounded-xl bg-white p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="w-20 h-20 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
                style={{ background: "linear-gradient(135deg, #E8D5B7, #C4A87C)" }}>
                {product.imagePath ? (
                  <img
                    src={`${supabaseUrl}/storage/v1/object/public/catalog/${product.imagePath}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg viewBox="0 0 40 30" fill="none" className="w-8 opacity-25">
                    <rect x="2" y="2" width="36" height="26" rx="2" stroke="#8B6914" strokeWidth="1"/>
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{product.name}</div>
                <div className="text-xs text-[var(--charcoal-light)] mt-0.5">
                  {fieldLabels.join(" · ")}
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs font-medium text-[var(--forest-green)]">
                    {product.variantCount} variant{product.variantCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-[var(--charcoal-light)]">{unitLabel}</span>
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
