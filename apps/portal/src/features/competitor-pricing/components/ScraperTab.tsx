"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { ScraperConfigForm } from "./ScraperConfigForm";
import { PriceTable } from "./PriceTable";
import { getScraperScripts, getCompetitorPrices } from "../actions";
import type { ScraperScript } from "../actions";
import type { CompetitorPriceDb } from "../types";

/**
 * Source → scraper directory display name mapping
 */
const SCRAPER_DIR_NAMES: Record<string, string> = {
  "mass.ee": "tools/mass-scraper/",
  "slhardwoods.co.uk": "tools/sl-hardwoods-scraper/",
  "uktimber.co.uk": "tools/uk-timber-scraper/",
  "timbersource.co.uk": "tools/timbersource-scraper/",
  "fiximer.co.uk": "tools/fiximer-scraper/",
};

interface ScraperTabProps {
  source: string;
  lastScrapedAt: string | null;
  onRefresh: () => void;
  refreshing: boolean;
  /** Show scraped data table inside this tab (for non-mass.ee sources) */
  showData?: boolean;
}

export function ScraperTab({ source, lastScrapedAt, onRefresh, refreshing, showData = false }: ScraperTabProps) {
  const [scripts, setScripts] = useState<ScraperScript[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [collapsedScripts, setCollapsedScripts] = useState<Set<string>>(new Set());
  const [scriptsOpen, setScriptsOpen] = useState(false);

  // Source-specific data (when showData is true)
  const [data, setData] = useState<CompetitorPriceDb[]>([]);
  const [loadingData, setLoadingData] = useState(false);


  const loadSourceData = useCallback(async () => {
    if (!showData) return;
    setLoadingData(true);
    const result = await getCompetitorPrices({ source, thickness: null });
    if (result.success) {
      setData(result.data);
    }
    setLoadingData(false);
  }, [source, showData]);

  useEffect(() => {
    loadSourceData();
  }, [loadSourceData]);

  // Wrap onRefresh to also reload local data
  const handleRefresh = useCallback(() => {
    onRefresh();
    loadSourceData();
  }, [onRefresh, loadSourceData]);

  useEffect(() => {
    if (scriptsOpen && scripts.length === 0 && !loadingScripts) {
      setLoadingScripts(true);
      getScraperScripts(source).then((result) => {
        if (result.success) setScripts(result.data);
        setLoadingScripts(false);
      });
    }
  }, [scriptsOpen, scripts.length, loadingScripts, source]);

  function toggleScript(filename: string) {
    setCollapsedScripts((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }

  const dirName = SCRAPER_DIR_NAMES[source] || `tools/${source}-scraper/`;

  return (
    <div className="space-y-6">
      <ScraperConfigForm
        source={source}
        lastScrapedAt={lastScrapedAt}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Collapsible Scraper Scripts */}
      <div className="rounded-lg border bg-card shadow-sm">
        <button
          onClick={() => setScriptsOpen(!scriptsOpen)}
          className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          {scriptsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Scraper Scripts
          <span className="text-muted-foreground font-normal">— {dirName}</span>
        </button>

        {scriptsOpen && (
          <div className="border-t px-4 pb-4 space-y-2 pt-2">
            {loadingScripts && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading scripts...
              </div>
            )}
            {!loadingScripts && scripts.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                No scripts found. Check that {dirName} exists in the project root.
              </p>
            )}
            {scripts.map((script) => {
              const isCollapsed = collapsedScripts.has(script.filename);
              return (
                <div key={script.filename} className="border rounded-md">
                  <button
                    onClick={() => toggleScript(script.filename)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-mono hover:bg-muted/50 transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    ) : (
                      <ChevronDown className="h-3 w-3 shrink-0" />
                    )}
                    {script.filename}
                    <span className="text-xs text-muted-foreground font-sans ml-auto">
                      {script.content.split("\n").length} lines
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="border-t overflow-auto max-h-[60vh]">
                      <pre className="text-xs p-3 bg-muted/30 leading-relaxed">
                        <code>{script.content}</code>
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Source-specific scraped data table */}
      {showData && (
        <>
          {loadingData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.length > 0 ? (
            <>
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <span className="font-medium">{data.length}</span> products
                {(() => {
                  const withDiff = data.filter((d) => d.price_diff_percent != null);
                  if (withDiff.length === 0) return null;
                  const avg = withDiff.reduce((sum, d) => sum + d.price_diff_percent!, 0) / withDiff.length;
                  return (
                    <> | avg TIM diff:{" "}
                      <span className={`font-medium ${avg > 0 ? "text-red-600" : avg < 0 ? "text-green-600" : ""}`}>
                        {avg > 0 ? "+" : ""}{avg.toFixed(1)}%
                      </span>
                      <span className="text-xs ml-1">({withDiff.length} compared)</span>
                    </>
                  );
                })()}
              </div>
              <PriceTable data={data} source={source} onDelete={(id) => {
                setData((prev) => prev.filter((d) => d.id !== id));
              }} />
            </>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No scraped data yet. Run Discovery, then Scrape to fetch prices.
            </div>
          )}
        </>
      )}
    </div>
  );
}
