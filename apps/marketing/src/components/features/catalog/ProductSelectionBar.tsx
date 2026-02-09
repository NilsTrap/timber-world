"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button, cn } from "@timber/ui";
import { Link } from "@/i18n/routing";

interface ProductSelectionBarProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
}

export function ProductSelectionBar({
  selectedCount,
  selectedIds,
  onClearSelection,
}: ProductSelectionBarProps) {
  const t = useTranslations("catalog");

  if (selectedCount === 0) {
    return null;
  }

  const quoteUrl = `/quote?products=${selectedIds.join(",")}`;

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
