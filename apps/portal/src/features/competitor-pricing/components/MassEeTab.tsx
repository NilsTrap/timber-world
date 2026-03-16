"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ScraperConfigForm } from "./ScraperConfigForm";
import { getScraperScripts } from "../actions";
import type { ScraperScript } from "../actions";

interface MassEeTabProps {
  lastScrapedAt: string | null;
  onRefresh: () => void;
  refreshing: boolean;
}

export function MassEeTab({ lastScrapedAt, onRefresh, refreshing }: MassEeTabProps) {
  const [scripts, setScripts] = useState<ScraperScript[]>([]);
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [scriptsOpen, setScriptsOpen] = useState(false);

  useEffect(() => {
    if (scriptsOpen && scripts.length === 0) {
      getScraperScripts("mass.ee").then((result) => {
        if (result.success) setScripts(result.data);
      });
    }
  }, [scriptsOpen, scripts.length]);

  return (
    <div className="space-y-6">
      <ScraperConfigForm
        source="mass.ee"
        lastScrapedAt={lastScrapedAt}
        onRefresh={onRefresh}
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
          <span className="text-muted-foreground font-normal">— tools/mass-scraper/</span>
        </button>

        {scriptsOpen && (
          <div className="border-t px-4 pb-4 space-y-2">
            <p className="text-xs text-muted-foreground pt-2">
              These are the scripts that power the mass.ee scraper. Click a file to view its source.
            </p>
            {scripts.map((script) => (
              <div key={script.filename} className="border rounded-md">
                <button
                  onClick={() => setExpandedScript(expandedScript === script.filename ? null : script.filename)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm font-mono hover:bg-muted/50 transition-colors"
                >
                  {expandedScript === script.filename ? (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  )}
                  {script.filename}
                </button>
                {expandedScript === script.filename && (
                  <div className="border-t overflow-auto max-h-[60vh]">
                    <pre className="text-xs p-3 bg-muted/30 leading-relaxed">
                      <code>{script.content}</code>
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
