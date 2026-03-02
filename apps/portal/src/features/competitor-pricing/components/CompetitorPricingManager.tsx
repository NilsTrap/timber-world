"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Label } from "@timber/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@timber/ui";
import { RefreshCw, Loader2 } from "lucide-react";
import { PriceTable } from "./PriceTable";
import { ScraperConfigForm } from "./ScraperConfigForm";
import {
  getCompetitorPrices,
  getCompetitorSources,
  getCompetitorThicknesses,
} from "../actions";
import type { CompetitorPriceDb, PricingFilters, PricingSummary } from "../types";
import { calculateSummary, formatPrice, formatRelativeTime } from "../types";

export function CompetitorPricingManager() {
  const [data, setData] = useState<CompetitorPriceDb[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [thicknesses, setThicknesses] = useState<number[]>([]);
  const [filters, setFilters] = useState<PricingFilters>({
    source: null,
    thickness: null,
  });
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

    const result = await getCompetitorPrices(filters);
    if (result.success) {
      setData(result.data);
      setSummary(calculateSummary(result.data));
    } else {
      setError(result.error);
    }

    setLoading(false);
  }, [filters]);

  const loadFilterOptions = useCallback(async () => {
    const [sourcesResult, thicknessesResult] = await Promise.all([
      getCompetitorSources(),
      getCompetitorThicknesses(filters.source || undefined),
    ]);

    if (sourcesResult.success) {
      setSources(sourcesResult.data);
    }
    if (thicknessesResult.success) {
      setThicknesses(thicknessesResult.data);
    }
  }, [filters.source]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  const handleSourceChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      source: value === "all" ? null : value,
      thickness: null, // Reset thickness when source changes
    }));
  };

  const handleThicknessChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      thickness: value === "all" ? null : parseInt(value, 10),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Scraper Configuration */}
      <ScraperConfigForm source="mass.ee" />

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-6">
          {/* Source filter */}
          <div className="space-y-1">
            <Label htmlFor="source" className="text-sm">
              Source
            </Label>
            <Select
              value={filters.source || "all"}
              onValueChange={handleSourceChange}
            >
              <SelectTrigger id="source" className="w-40">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Thickness filter */}
          <div className="space-y-1">
            <Label htmlFor="thickness" className="text-sm">
              Thickness
            </Label>
            <Select
              value={filters.thickness?.toString() || "all"}
              onValueChange={handleThicknessChange}
            >
              <SelectTrigger id="thickness" className="w-32">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {thicknesses.map((t) => (
                  <SelectItem key={t} value={t.toString()}>
                    {t}mm
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Last scraped info */}
          <div className="flex-1 text-right text-sm text-muted-foreground">
            Last scraped: {formatRelativeTime(summary.lastScrapedAt)}
          </div>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

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
