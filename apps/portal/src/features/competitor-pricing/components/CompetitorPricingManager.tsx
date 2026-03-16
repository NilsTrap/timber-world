"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@timber/ui";
import { PriceTable } from "./PriceTable";
import { MassEeTab } from "./MassEeTab";
import { StockPricesTable } from "./StockPricesTable";
import { getCompetitorPrices } from "../actions";
import type { CompetitorPriceDb, PricingSummary } from "../types";
import { calculateSummary } from "../types";

const TABS = ["scraped-data", "stock-prices", "mass-ee"] as const;
type TabValue = (typeof TABS)[number];

function getInitialTab(): TabValue {
  if (typeof window === "undefined") return "scraped-data";
  const hash = window.location.hash.replace("#", "") as TabValue;
  return TABS.includes(hash) ? hash : "scraped-data";
}

export function CompetitorPricingManager() {
  const [data, setData] = useState<CompetitorPriceDb[]>([]);
  const [summary, setSummary] = useState<PricingSummary>({
    totalProducts: 0,
    totalStock: 0,
    totalM3: 0,
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
    <Tabs
      defaultValue={getInitialTab()}
      className="space-y-6"
      onValueChange={(v) => { window.location.hash = v; }}
    >
      <TabsList>
        <TabsTrigger value="scraped-data">Scraped Data</TabsTrigger>
        <TabsTrigger value="stock-prices">Stock Prices</TabsTrigger>
        <TabsTrigger value="mass-ee">Mass.ee</TabsTrigger>
      </TabsList>

      <TabsContent value="scraped-data" className="space-y-6">
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

        {/* Summary */}
        {!loading && data.length > 0 && (
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium">{summary.totalProducts}</span> products |{" "}
            <span className="font-medium">{summary.totalStock}</span> pcs total stock |{" "}
            <span className="font-medium">{summary.totalM3.toFixed(3).replace(".", ",")}</span> m³
          </div>
        )}

        {/* Table */}
        {!loading && <PriceTable data={data} onDelete={(id) => {
          const newData = data.filter((d) => d.id !== id);
          setData(newData);
          setSummary(calculateSummary(newData));
        }} />}
      </TabsContent>

      <TabsContent value="stock-prices" className="space-y-6">
        <StockPricesTable />
      </TabsContent>

      <TabsContent value="mass-ee" className="space-y-6">
        <MassEeTab
          lastScrapedAt={summary.lastScrapedAt}
          onRefresh={loadData}
          refreshing={loading}
        />
      </TabsContent>
    </Tabs>
  );
}
