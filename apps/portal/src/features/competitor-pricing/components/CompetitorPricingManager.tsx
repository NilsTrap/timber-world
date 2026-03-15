"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { PriceTable } from "./PriceTable";
import { ScraperConfigForm } from "./ScraperConfigForm";
import { getCompetitorPrices } from "../actions";
import type { CompetitorPriceDb, PricingSummary } from "../types";
import { calculateSummary, formatPrice } from "../types";

export function CompetitorPricingManager() {
  const [data, setData] = useState<CompetitorPriceDb[]>([]);
  const [summary, setSummary] = useState<PricingSummary>({
    totalProducts: 0,
    totalStock: 0,
    averagePrice: 0,
    lastScrapedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await getCompetitorPrices({ source: null, thickness: null });
    if (result.success) {
      setData(result.data);
      setSummary(calculateSummary(result.data));
    } else {
      setError(result.error);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      {/* Scraper Configuration */}
      <ScraperConfigForm
        source="mass.ee"
        lastScrapedAt={summary.lastScrapedAt}
        onRefresh={loadData}
        refreshing={loading}
      />

      {/* Error message */}
      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Table */}
      {!loading && <PriceTable data={data} />}

      {/* Summary */}
      {!loading && data.length > 0 && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium">{summary.totalProducts}</span> products |{" "}
          <span className="font-medium">{summary.totalStock}</span> pcs total
          stock | Avg:{" "}
          <span className="font-medium">
            {formatPrice(summary.averagePrice)}
          </span>
          /piece
        </div>
      )}
    </div>
  );
}
