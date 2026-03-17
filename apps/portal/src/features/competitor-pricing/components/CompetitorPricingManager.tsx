"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@timber/ui";
import { PriceTable } from "./PriceTable";
import { ScraperTab } from "./ScraperTab";
import { StockPricesTable } from "./StockPricesTable";
import { getCompetitorPrices, exportToMasInventory } from "../actions";
import type { CompetitorPriceDb, PricingSummary } from "../types";
import { calculateSummary } from "../types";

const TABS = ["scraped-data", "stock-prices", "mass-ee", "sl-hardwoods", "uk-timber", "timbersource", "fiximer"] as const;
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
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await getCompetitorPrices({ source: "mass.ee", thickness: null });
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
        <TabsTrigger value="sl-hardwoods">SL Hardwoods</TabsTrigger>
        <TabsTrigger value="uk-timber">UK Timber</TabsTrigger>
        <TabsTrigger value="timbersource">Timber Source</TabsTrigger>
        <TabsTrigger value="fiximer">Fiximer</TabsTrigger>
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
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground flex items-center gap-4">
            <div>
              <span className="font-medium">{summary.totalProducts}</span> products |{" "}
              <span className="font-medium">{summary.totalStock}</span> pcs total stock |{" "}
              <span className="font-medium">{summary.totalM3.toFixed(3).replace(".", ",")}</span> m³
            </div>
            <div className="ml-auto flex items-center gap-2">
              {exportResult && (
                <span className={`text-xs ${exportResult.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
                  {exportResult}
                </span>
              )}
              <button
                onClick={async () => {
                  if (!confirm(`Replace all MAS inventory with ${data.length} scraped products?\n\nThis will delete all existing MAS inventory packages and insert these products with TIM prices.`)) return;
                  setExporting(true);
                  setExportResult(null);
                  const result = await exportToMasInventory();
                  if (result.success) {
                    setExportResult(`Exported ${result.data.packagesCreated} packages (deleted ${result.data.packagesDeleted} old)`);
                  } else {
                    setExportResult(`Error: ${result.error}`);
                  }
                  setExporting(false);
                }}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Export to MAS Inventory
              </button>
            </div>
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
        <ScraperTab
          source="mass.ee"
          lastScrapedAt={summary.lastScrapedAt}
          onRefresh={loadData}
          refreshing={loading}
        />
      </TabsContent>

      <TabsContent value="sl-hardwoods" className="space-y-6">
        <ScraperTab
          source="slhardwoods.co.uk"
          lastScrapedAt={summary.lastScrapedAt}
          onRefresh={loadData}
          refreshing={loading}
          showData
        />
      </TabsContent>

      <TabsContent value="uk-timber" className="space-y-6">
        <ScraperTab
          source="uktimber.co.uk"
          lastScrapedAt={summary.lastScrapedAt}
          onRefresh={loadData}
          refreshing={loading}
          showData
        />
      </TabsContent>

      <TabsContent value="timbersource" className="space-y-6">
        <ScraperTab
          source="timbersource.co.uk"
          lastScrapedAt={summary.lastScrapedAt}
          onRefresh={loadData}
          refreshing={loading}
          showData
        />
      </TabsContent>

      <TabsContent value="fiximer" className="space-y-6">
        <ScraperTab
          source="fiximer.co.uk"
          lastScrapedAt={summary.lastScrapedAt}
          onRefresh={loadData}
          refreshing={loading}
          showData
        />
      </TabsContent>
    </Tabs>
  );
}
