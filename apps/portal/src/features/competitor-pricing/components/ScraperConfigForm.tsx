"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { Button, Checkbox, Label } from "@timber/ui";
import { ChevronDown, Loader2, Play, RefreshCw, Search, Settings } from "lucide-react";

/** Collapsible multi-select dropdown used for each config category */
function MultiSelectDropdown({
  label,
  selectedCount,
  totalCount,
  isOpen,
  onToggle,
  onAll,
  onNone,
  children,
}: {
  label: string;
  selectedCount: number;
  totalCount: number;
  isOpen: boolean;
  onToggle: () => void;
  onAll: () => void;
  onNone: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">
            {selectedCount}/{totalCount}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="border-t px-3 py-2 space-y-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onAll}>
              All
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onNone}>
              None
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
import { getScraperConfig, getDiscoveredOptions, getSavedUrlCount, getSavedUrls, updateScraperConfig } from "../actions";
import type { SavedUrl } from "../actions";
import type { DiscoveredOptions } from "../actions";
import type { ScraperConfig } from "../types";
import { SCRAPER_OPTIONS, formatRelativeTime } from "../types";

/** Species label lookup */
const SPECIES_LABELS: Record<string, string> = {};
for (const s of SCRAPER_OPTIONS.species) SPECIES_LABELS[s.value] = s.label;
/** Panel type label lookup */
const PANEL_TYPE_LABELS: Record<string, string> = {};
for (const pt of SCRAPER_OPTIONS.panelTypes) PANEL_TYPE_LABELS[pt.value] = pt.label;

const SCRAPER_UI_KEY_PREFIX = "scraper-config-ui";

interface ScraperUIState {
  isOpen: boolean;
  openSections: Record<string, boolean>;
  species: string[];
  panelTypes: string[];
  qualities: string[];
  thicknesses: number[];
  widths: number[];
  lengths: number[];
}

function loadScraperUIState(source: string): Partial<ScraperUIState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${SCRAPER_UI_KEY_PREFIX}:${source}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveScraperUIState(source: string, state: ScraperUIState): void {
  localStorage.setItem(`${SCRAPER_UI_KEY_PREFIX}:${source}`, JSON.stringify(state));
}

interface ScraperConfigFormProps {
  source?: string;
  lastScrapedAt?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function ScraperConfigForm({
  source = "mass.ee",
  lastScrapedAt,
  onRefresh,
  refreshing,
}: ScraperConfigFormProps) {
  const savedUI = useRef(loadScraperUIState(source)).current;
  const [config, setConfig] = useState<ScraperConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(savedUI.isOpen ?? false);
  const [savedUrlCount, setSavedUrlCount] = useState<number>(0);
  const [scraperRunning, setScraperRunning] = useState<"discover" | "scrape" | null>(null);
  const [scraperLogs, setScraperLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(savedUI.openSections ?? {});
  const [discovered, setDiscovered] = useState<DiscoveredOptions | null>(null);
  const [showUrls, setShowUrls] = useState(false);
  const [savedUrls, setSavedUrls] = useState<SavedUrl[] | null>(null);
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [filteredUrlCount, setFilteredUrlCount] = useState<number | null>(null);
  const [loadingFilteredCount, setLoadingFilteredCount] = useState(false);

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Use discovered options when available, fall back to hardcoded SCRAPER_OPTIONS
  const availableSpecies = discovered && discovered.species.length > 0
    ? discovered.species
    : SCRAPER_OPTIONS.species.map((s) => s.value);
  const availablePanelTypes = discovered && discovered.panelTypes.length > 0
    ? discovered.panelTypes
    : SCRAPER_OPTIONS.panelTypes.map((pt) => pt.value);
  const availableQualities = discovered && discovered.qualities.length > 0
    ? discovered.qualities
    : [...SCRAPER_OPTIONS.qualities];
  const availableThicknesses = discovered && discovered.thicknesses.length > 0
    ? discovered.thicknesses
    : [...SCRAPER_OPTIONS.thicknesses];
  const availableWidths = discovered && discovered.widths.length > 0
    ? discovered.widths
    : [...SCRAPER_OPTIONS.widths];
  const availableLengths = discovered && discovered.lengths.length > 0
    ? discovered.lengths
    : [...SCRAPER_OPTIONS.lengths];

  // Local form state — restore from localStorage
  const [isEnabled, setIsEnabled] = useState(true);
  const [species, setSpecies] = useState<string[]>(savedUI.species ?? []);
  const [thicknesses, setThicknesses] = useState<number[]>(savedUI.thicknesses ?? []);
  const [widths, setWidths] = useState<number[]>(savedUI.widths ?? []);
  const [lengths, setLengths] = useState<number[]>(savedUI.lengths ?? []);
  const [panelTypes, setPanelTypes] = useState<string[]>(savedUI.panelTypes ?? []);
  const [qualities, setQualities] = useState<string[]>(savedUI.qualities ?? []);

  // Persist UI state on change
  useEffect(() => {
    saveScraperUIState(source, { isOpen, openSections, species, panelTypes, qualities, thicknesses, widths, lengths });
  }, [isOpen, openSections, species, panelTypes, qualities, thicknesses, widths, lengths]);

  useEffect(() => {
    loadConfig();
  }, [source]);

  // Update filtered URL count when selections change
  useEffect(() => {
    const hasAnyFilter = species.length > 0 || panelTypes.length > 0 || qualities.length > 0 ||
      thicknesses.length > 0 || widths.length > 0 || lengths.length > 0;

    if (!hasAnyFilter) {
      setFilteredUrlCount(null); // null = show total count
      return;
    }

    setLoadingFilteredCount(true);
    const timeout = setTimeout(async () => {
      const result = await getSavedUrlCount(source, {
        species: species.length > 0 ? species : undefined,
        panelTypes: panelTypes.length > 0 ? panelTypes : undefined,
        qualities: qualities.length > 0 ? qualities : undefined,
        thicknesses: thicknesses.length > 0 ? thicknesses : undefined,
        widths: widths.length > 0 ? widths : undefined,
        lengths: lengths.length > 0 ? lengths : undefined,
      });
      if (result.success) setFilteredUrlCount(result.data);
      setLoadingFilteredCount(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [source, species, panelTypes, qualities, thicknesses, widths, lengths]);

  async function loadConfig() {
    setLoading(true);
    setError(null);

    const [configResult, urlCountResult, discoveredResult] = await Promise.all([
      getScraperConfig(source),
      getSavedUrlCount(source),
      getDiscoveredOptions(source),
    ]);

    if (configResult.success) {
      setConfig(configResult.data);
      setIsEnabled(configResult.data.isEnabled);
      // Keep persisted selections — don't reset on load
    } else {
      setError(configResult.error);
    }

    if (urlCountResult.success) {
      setSavedUrlCount(urlCountResult.data);
    }

    if (discoveredResult.success) {
      setDiscovered(discoveredResult.data);
    }

    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const result = await updateScraperConfig({
      source,
      isEnabled,
      species,
      thicknesses,
      widths,
      lengths,
      panelTypes,
      qualities,
    });

    if (result.success) {
      setConfig(result.data);
    } else {
      setError(result.error);
    }

    setSaving(false);
  }

  function toggleSpecies(value: string) {
    setSpecies((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  function toggleThickness(value: number) {
    setThicknesses((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value].sort((a, b) => a - b)
    );
  }

  function toggleWidth(value: number) {
    setWidths((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value].sort((a, b) => a - b)
    );
  }

  function toggleLength(value: number) {
    setLengths((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value].sort((a, b) => a - b)
    );
  }

  function togglePanelType(value: string) {
    setPanelTypes((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  function toggleQuality(value: string) {
    setQualities((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  const runScraper = async (mode: "discover" | "scrape") => {
    setScraperRunning(mode);
    setScraperLogs([]);

    try {
      const response = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          mode,
          // Pass current filter selections for scrape mode
          ...(mode === "scrape" ? {
            filter: {
              species: species.length > 0 ? species : undefined,
              panelTypes: panelTypes.length > 0 ? panelTypes : undefined,
              qualities: qualities.length > 0 ? qualities : undefined,
              thicknesses: thicknesses.length > 0 ? thicknesses : undefined,
              widths: widths.length > 0 ? widths : undefined,
              lengths: lengths.length > 0 ? lengths : undefined,
            }
          } : {}),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setScraperLogs((prev) => [...prev, `Error: ${err.error || response.statusText}`]);
        setScraperRunning(null);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setScraperLogs((prev) => [...prev, "Error: No response stream"]);
        setScraperRunning(null);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            setScraperLogs((prev) => [...prev, msg.message]);
            setTimeout(() => {
              const c = logContainerRef.current;
              if (c) c.scrollTop = c.scrollHeight;
            }, 50);
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      setScraperLogs((prev) => [...prev, `Error: ${err}`]);
    }

    setScraperRunning(null);
    // Refresh data, URL count, and discovered options
    onRefresh?.();
    const [urlCountResult, discoveredResult] = await Promise.all([
      getSavedUrlCount(source),
      getDiscoveredOptions(source),
    ]);
    if (urlCountResult.success) {
      setSavedUrlCount(urlCountResult.data);
    }
    if (discoveredResult.success) {
      setDiscovered(discoveredResult.data);
      // Reset selections to empty after discovery — user picks what to include
      setSpecies([]);
      setPanelTypes([]);
      setQualities([]);
      setThicknesses([]);
      setWidths([]);
      setLengths([]);
    }
    // Reset cached saved URLs so they reload with fresh data
    setSavedUrls(null);
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading configuration...</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-left hover:opacity-80"
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Scraper Configuration</span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-4"
            onClick={async (e) => {
              e.stopPropagation();
              if (showUrls) {
                setShowUrls(false);
                return;
              }
              if (!savedUrls) {
                setLoadingUrls(true);
                const result = await getSavedUrls(source);
                if (result.success) setSavedUrls(result.data);
                setLoadingUrls(false);
              }
              setShowUrls(true);
            }}
          >
            Saved URLs: {savedUrlCount}
          </button>
          <span className="text-sm text-muted-foreground">|</span>
          <span className="text-sm text-muted-foreground">
            Last scraped: {formatRelativeTime(lastScrapedAt ?? null)}
          </span>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Saved URLs list */}
      {showUrls && (
        <div className="border-t px-4 py-3">
          {loadingUrls ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading URLs...
            </div>
          ) : savedUrls && savedUrls.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">{savedUrls.length} saved product URLs</div>
              <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="text-left px-2 py-1 font-medium">Species</th>
                      <th className="text-left px-2 py-1 font-medium">Type</th>
                      <th className="text-left px-2 py-1 font-medium">Qual</th>
                      <th className="text-right px-2 py-1 font-medium">Thick</th>
                      <th className="text-right px-2 py-1 font-medium">Width</th>
                      <th className="text-right px-2 py-1 font-medium">Length</th>
                      <th className="text-left px-2 py-1 font-medium">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedUrls.map((u, i) => (
                      <tr key={i} className="border-t border-muted hover:bg-muted/50">
                        <td className="px-2 py-1">{u.species || "-"}</td>
                        <td className="px-2 py-1">{u.panel_type || "-"}</td>
                        <td className="px-2 py-1">{u.quality || "-"}</td>
                        <td className="px-2 py-1 text-right">{u.thickness_mm ?? "-"}</td>
                        <td className="px-2 py-1 text-right">{u.width_mm ?? "-"}</td>
                        <td className="px-2 py-1 text-right">{u.length_mm ?? "-"}</td>
                        <td className="px-2 py-1">
                          <a
                            href={u.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate block max-w-[300px]"
                          >
                            {u.url.replace(/^https?:\/\/[^/]+\//, "")}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No saved URLs yet. Run Discovery to find product URLs.</div>
          )}
        </div>
      )}

      {isOpen && (
        <div className="border-t p-4 space-y-6">
          {/* Config dropdowns */}
          {!discovered && savedUrlCount === 0 && (
            <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3 text-sm text-blue-700 dark:text-blue-300">
              Options below are defaults. Run Discovery to load actual values from {source}.
            </div>
          )}

          <div className="space-y-2">
            {/* Species */}
            <MultiSelectDropdown
              label="Species"
              selectedCount={species.length}
              totalCount={availableSpecies.length}
              isOpen={!!openSections.species}
              onToggle={() => toggleSection("species")}
              onAll={() => setSpecies([...availableSpecies])}
              onNone={() => setSpecies([])}
            >
              {availableSpecies.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <Checkbox
                    id={`species-${s}`}
                    checked={species.includes(s)}
                    onCheckedChange={() => toggleSpecies(s)}
                  />
                  <Label htmlFor={`species-${s}`} className="text-sm">
                    {SPECIES_LABELS[s] || s.charAt(0).toUpperCase() + s.slice(1)}
                  </Label>
                </div>
              ))}
            </MultiSelectDropdown>

            {/* Panel Types */}
            <MultiSelectDropdown
              label="Panel Types"
              selectedCount={panelTypes.length}
              totalCount={availablePanelTypes.length}
              isOpen={!!openSections.panelTypes}
              onToggle={() => toggleSection("panelTypes")}
              onAll={() => setPanelTypes([...availablePanelTypes])}
              onNone={() => setPanelTypes([])}
            >
              {availablePanelTypes.map((pt) => (
                <div key={pt} className="flex items-center gap-2">
                  <Checkbox
                    id={`panel-${pt}`}
                    checked={panelTypes.includes(pt)}
                    onCheckedChange={() => togglePanelType(pt)}
                  />
                  <Label htmlFor={`panel-${pt}`} className="text-sm">
                    {PANEL_TYPE_LABELS[pt] || pt}
                  </Label>
                </div>
              ))}
            </MultiSelectDropdown>

            {/* Qualities */}
            <MultiSelectDropdown
              label="Qualities"
              selectedCount={qualities.length}
              totalCount={availableQualities.length}
              isOpen={!!openSections.qualities}
              onToggle={() => toggleSection("qualities")}
              onAll={() => setQualities([...availableQualities])}
              onNone={() => setQualities([])}
            >
              {availableQualities.map((q) => (
                <div key={q} className="flex items-center gap-2">
                  <Checkbox
                    id={`quality-${q}`}
                    checked={qualities.includes(q)}
                    onCheckedChange={() => toggleQuality(q)}
                  />
                  <Label htmlFor={`quality-${q}`} className="text-sm">
                    {q}
                  </Label>
                </div>
              ))}
            </MultiSelectDropdown>

            {/* Thicknesses */}
            <MultiSelectDropdown
              label="Thicknesses"
              selectedCount={thicknesses.length}
              totalCount={availableThicknesses.length}
              isOpen={!!openSections.thicknesses}
              onToggle={() => toggleSection("thicknesses")}
              onAll={() => setThicknesses([...availableThicknesses])}
              onNone={() => setThicknesses([])}
            >
              {availableThicknesses.map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <Checkbox
                    id={`thickness-${t}`}
                    checked={thicknesses.includes(t)}
                    onCheckedChange={() => toggleThickness(t)}
                  />
                  <Label htmlFor={`thickness-${t}`} className="text-sm">
                    {t}mm
                  </Label>
                </div>
              ))}
            </MultiSelectDropdown>

            {/* Widths */}
            <MultiSelectDropdown
              label="Widths"
              selectedCount={widths.length}
              totalCount={availableWidths.length}
              isOpen={!!openSections.widths}
              onToggle={() => toggleSection("widths")}
              onAll={() => setWidths([...availableWidths])}
              onNone={() => setWidths([])}
            >
              {availableWidths.map((w) => (
                <div key={w} className="flex items-center gap-2">
                  <Checkbox
                    id={`width-${w}`}
                    checked={widths.includes(w)}
                    onCheckedChange={() => toggleWidth(w)}
                  />
                  <Label htmlFor={`width-${w}`} className="text-sm">
                    {w}mm
                  </Label>
                </div>
              ))}
            </MultiSelectDropdown>

            {/* Lengths */}
            <MultiSelectDropdown
              label="Lengths"
              selectedCount={lengths.length}
              totalCount={availableLengths.length}
              isOpen={!!openSections.lengths}
              onToggle={() => toggleSection("lengths")}
              onAll={() => setLengths([...availableLengths])}
              onNone={() => setLengths([])}
            >
              {availableLengths.map((l) => (
                <div key={l} className="flex items-center gap-2">
                  <Checkbox
                    id={`length-${l}`}
                    checked={lengths.includes(l)}
                    onCheckedChange={() => toggleLength(l)}
                  />
                  <Label htmlFor={`length-${l}`} className="text-sm">
                    {l}mm
                  </Label>
                </div>
              ))}
            </MultiSelectDropdown>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => runScraper("discover")}
                disabled={scraperRunning !== null || saving}
              >
                {scraperRunning === "discover" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Discover URLs
              </Button>
              <Button
                onClick={() => runScraper("scrape")}
                disabled={scraperRunning !== null || saving || savedUrlCount === 0}
              >
                {scraperRunning === "scrape" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Scrape Prices
              </Button>
              {savedUrlCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  {loadingFilteredCount ? "..." : (
                    filteredUrlCount !== null
                      ? `${filteredUrlCount} / ${savedUrlCount} URLs`
                      : `${savedUrlCount} URLs (all)`
                  )}
                </span>
              )}
              {savedUrlCount === 0 && (
                <span className="text-xs text-muted-foreground">
                  Run Discover first to find product URLs
                </span>
              )}
            </div>

          </div>

          {/* Scraper log output */}
          {scraperLogs.length > 0 && (
            <div ref={logContainerRef} className="rounded-md border bg-muted/30 p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-0.5">
              {scraperLogs.map((log, i) => (
                <div key={i} className={log.startsWith("Error") ? "text-destructive" : "text-muted-foreground"}>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
