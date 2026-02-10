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
        backgroundColor: "red",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h1 style={{ color: "white", fontSize: "32px", marginBottom: "20px" }}>
        FILTER OVERLAY IS OPEN
      </h1>
      <button
        onClick={() => setOpen(false)}
        style={{
          padding: "20px 40px",
          fontSize: "20px",
          backgroundColor: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        CLOSE THIS
      </button>
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
