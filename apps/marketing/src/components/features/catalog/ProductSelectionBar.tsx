"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button, cn } from "@timber/ui";
import { Link } from "@/i18n/routing";
import type { StockProduct } from "@/lib/actions/products";

interface ProductSelectionBarProps {
  selectedCount: number;
  selectedIds: string[];
  products: StockProduct[];
  onClearSelection: () => void;
}

export function ProductSelectionBar({
  selectedCount,
  selectedIds,
  products,
  onClearSelection,
}: ProductSelectionBarProps) {
  const t = useTranslations("catalog");

  // Format selected products as readable descriptions
  const productDescriptions = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return products
      .filter(p => selectedSet.has(p.id))
      .map(p => {
        // Format: "Oak Edge Glued Board 40×600×2000mm A/B (5 pcs)"
        const dims = `${p.thickness}×${p.width}×${p.length}mm`;
        const quality = p.quality_grade || "";
        const pieces = p.stock_quantity ? `(${p.stock_quantity} pcs)` : "";
        return `${p.species} ${p.name} ${dims} ${quality} ${pieces}`.trim();
      });
  }, [selectedIds, products]);

  if (selectedCount === 0) {
    return null;
  }

  // Pass readable descriptions to quote page
  const quoteUrl = `/quote?products=${encodeURIComponent(productDescriptions.join("\n"))}`;

  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-40",
      "flex items-center gap-4 px-6 py-3",
      "bg-charcoal text-white rounded-full shadow-lg",
      "animate-in slide-in-from-bottom-4 fade-in duration-300"
    )}>
      <span className="text-sm font-medium">
        {t("selectedProducts", { count: selectedCount })}
      </span>
      <Button
        asChild
        size="sm"
        className="bg-forest-green hover:bg-forest-green/90"
      >
        <Link href={quoteUrl}>
          {t("requestQuote")}
        </Link>
      </Button>
      <button
        onClick={onClearSelection}
        className="p-1 hover:bg-white/10 rounded-full transition-colors"
        aria-label={t("clearSelection")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
