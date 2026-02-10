"use client";

import { useTranslations } from "next-intl";

interface PriceDisplayProps {
  cents: number;
  currency?: string;
}

export function PriceDisplay({ cents, currency = "EUR" }: PriceDisplayProps) {
  const t = useTranslations("catalog");

  // Show "On Request" for zero or missing prices
  if (!cents || cents === 0) {
    return <span className="text-muted-foreground">{t("onRequest")}</span>;
  }

  const euros = cents / 100;

  const formatted = new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);

  return <span className="tabular-nums">{formatted}</span>;
}
