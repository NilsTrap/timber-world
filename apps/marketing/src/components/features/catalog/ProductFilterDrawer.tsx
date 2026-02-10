"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X } from "lucide-react";
import { Button, Badge } from "@timber/ui";
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
  const [mounted, setMounted] = useState(false);

  // Ensure we only render portal on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const overlay = open ? (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        backgroundColor: "#FAF6F1",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px",
          borderBottom: "1px solid #E5DFD7",
          backgroundColor: "#FAF6F1",
          flexShrink: 0,
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>{t("filters")}</h2>
        <button
          onClick={() => setOpen(false)}
          style={{
            padding: "8px",
            borderRadius: "50%",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
          }}
          aria-label="Close filters"
        >
          <X style={{ width: "24px", height: "24px" }} />
        </button>
      </div>

      {/* Filter Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
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
      <div style={{ padding: "16px", borderTop: "1px solid #E5DFD7", backgroundColor: "#FAF6F1", flexShrink: 0 }}>
        <Button
          variant="default"
          className="w-full bg-forest-green text-white"
          onClick={() => setOpen(false)}
        >
          Apply Filters
        </Button>
      </div>
    </div>
  ) : null;

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

      {/* Render overlay via Portal to document.body */}
      {mounted && overlay && createPortal(overlay, document.body)}
    </>
  );
}
