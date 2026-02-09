"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@timber/ui";
import type { StockStatus } from "@timber/database";

interface StockStatusBadgeProps {
  status: StockStatus;
}

export function StockStatusBadge({ status }: StockStatusBadgeProps) {
  const t = useTranslations("catalog");

  const variants: Record<StockStatus, { className: string; label: string }> = {
    in_stock: {
      className: "bg-emerald-100 text-emerald-700 border-emerald-200",
      label: t("inStock"),
    },
    low_stock: {
      className: "bg-amber-100 text-amber-700 border-amber-200",
      label: t("lowStock"),
    },
    out_of_stock: {
      className: "bg-red-100 text-red-700 border-red-200",
      label: t("outOfStock"),
    },
  };

  const { className, label } = variants[status];

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
