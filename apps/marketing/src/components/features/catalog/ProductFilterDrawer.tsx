"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import {
  Button,
  Badge,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@timber/ui";
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="lg"
          className="gap-2 bg-forest-green text-white shadow-lg hover:bg-forest-green/90 px-6"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {t("filters")}
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs bg-white text-forest-green">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[320px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b flex-shrink-0">
          <SheetTitle>{t("filters")}</SheetTitle>
        </SheetHeader>
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
      </SheetContent>
    </Sheet>
  );
}
