"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X } from "lucide-react";
import { Button, Badge, cn } from "@timber/ui";
import type { ProductFilters, FilterOptions } from "@/lib/actions/products";
import { ProductFilter } from "./ProductFilter";

interface ProductFilterDrawerProps {
  filters: ProductFilters;
  filterOptions: FilterOptions;
  activeFilterCount: number;
  onFilterChange: (key: keyof ProductFilters, values: string[]) => void;
  onFscChange: (value: boolean | undefined) => void;
  onClearFilters: () => void;
}

export function ProductFilterDrawer({
  filters,
  filterOptions,
  activeFilterCount,
  onFilterChange,
  onFscChange,
  onClearFilters,
}: ProductFilterDrawerProps) {
  const t = useTranslations("catalog");
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="default"
        size="lg"
        className="gap-2 bg-forest-green text-white shadow-lg hover:bg-forest-green/90 px-6"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="h-5 w-5" />
        {t("filters")}
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs bg-white text-forest-green">
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      {/* Full-screen Filter Overlay */}
      {open && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <h2 className="text-lg font-semibold">{t("filters")}</h2>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-full hover:bg-muted"
              aria-label="Close filters"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Filter Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <ProductFilter
              filters={filters}
              filterOptions={filterOptions}
              activeFilterCount={activeFilterCount}
              onFilterChange={(key, values) => {
                onFilterChange(key, values);
              }}
              onFscChange={onFscChange}
              onClearFilters={onClearFilters}
            />
          </div>

          {/* Apply Button */}
          <div className="p-4 border-t bg-background">
            <Button
              variant="default"
              className="w-full bg-forest-green text-white"
              onClick={() => setOpen(false)}
            >
              {t("showFilters", { defaultValue: "Apply Filters" })}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
