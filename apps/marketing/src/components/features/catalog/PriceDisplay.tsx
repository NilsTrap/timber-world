"use client";

interface PriceDisplayProps {
  cents: number;
  currency?: string;
}

export function PriceDisplay({ cents, currency = "EUR" }: PriceDisplayProps) {
  const euros = cents / 100;

  const formatted = new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);

  return <span className="tabular-nums">{formatted}</span>;
}
