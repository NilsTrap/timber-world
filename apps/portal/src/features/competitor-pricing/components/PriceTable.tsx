"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ColumnHeaderMenu,
  type ColumnSortState,
} from "@timber/ui";
import { ExternalLink, FileDown, Trash2 } from "lucide-react";
import type { CompetitorPriceDb } from "../types";
import { formatPrice, formatStockLocations } from "../types";
import { deleteCompetitorPrice } from "../actions";

type FilterableColumn =
  | "source"
  | "species"
  | "panel_type"
  | "thickness_mm"
  | "width_mm"
  | "length_mm"
  | "quality";

type SortableColumn =
  | FilterableColumn
  | "price_per_piece"
  | "price_per_m2"
  | "price_per_m3"
  | "mass_18_m3"
  | "mass_18_piece"
  | "mass_18_m2"
  | "ti_price_per_piece"
  | "ti_price_per_m2"
  | "ti_price_per_m3"
  | "price_diff_percent"
  | "diff_18_percent"
  | "stock_total"
  | "volume_m3"
  | "scraped_at";

const COMPUTED_COLUMNS = new Set([
  "mass_18_m3", "mass_18_piece", "mass_18_m2", "diff_18_percent", "volume_m3", "scraped_at",
]);

/** All columns that should have filter values in the dropdown */
const ALL_VALUE_COLUMNS: string[] = [
  "source", "species", "panel_type", "thickness_mm", "width_mm", "length_mm", "quality",
  "price_per_m3", "ti_price_per_m3", "price_diff_percent",
  "price_per_piece", "price_per_m2", "ti_price_per_piece", "ti_price_per_m2",
  "stock_total",
];

/** GBP → EUR conversion rate (1 GBP = 1/0.9 EUR) */
const GBP_TO_EUR = 1 / 0.9;

/** Source display labels */
const SOURCE_LABELS: Record<string, string> = {
  "mass.ee": "Mass",
  "slhardwoods.co.uk": "SLH",
  "uktimber.co.uk": "UKT",
  "timbersource.co.uk": "TSrc",
  "fiximer.co.uk": "Fix",
};

interface PriceTableProps {
  data: CompetitorPriceDb[];
  onDelete?: (id: string) => void;
  /** Override source label for column headers (auto-detected from data if not provided) */
  source?: string;
}

function capitalizeFirst(s: string | null): string {
  if (!s) return "-";
  return s.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const SPECIES_ORDER: Record<string, number> = {
  oak: 1,
  ash: 2,
  "ash white": 3,
  pine: 4,
  birch: 5,
};

const FILTERABLE_COLUMNS: FilterableColumn[] = [
  "source",
  "species",
  "panel_type",
  "thickness_mm",
  "width_mm",
  "length_mm",
  "quality",
];

const STORAGE_KEY = "competitor-pricing-filters";

function loadPersistedState(): { sort: ColumnSortState | null; filters: Record<string, Set<string>> } {
  if (typeof window === "undefined") return { sort: null, filters: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sort: null, filters: {} };
    const parsed = JSON.parse(raw);
    const filters: Record<string, Set<string>> = {};
    for (const [key, values] of Object.entries(parsed.filters || {})) {
      filters[key] = new Set(values as string[]);
    }
    return { sort: parsed.sort || null, filters };
  } catch {
    return { sort: null, filters: {} };
  }
}

function persistState(sort: ColumnSortState | null, filters: Record<string, Set<string>>): void {
  const serialized: Record<string, string[]> = {};
  for (const [key, set] of Object.entries(filters)) {
    if (set.size > 0) serialized[key] = [...set];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ sort, filters: serialized }));
}

const SCROLL_KEY = "competitor-pricing-scroll";

export function PriceTable({ data, onDelete, source: sourceProp }: PriceTableProps) {
  // Detect source from data or prop
  const detectedSource = sourceProp || data[0]?.source || "mass.ee";
  const isGbp = detectedSource === "slhardwoods.co.uk" || detectedSource === "uktimber.co.uk" || detectedSource === "timbersource.co.uk" || detectedSource === "fiximer.co.uk";
  const srcLabel = SOURCE_LABELS[detectedSource] || detectedSource;
  // For GBP sources, convert competitor prices to EUR for display
  const toEur = isGbp ? (v: number | null) => (v != null ? Math.round(v * GBP_TO_EUR * 100) / 100 : null) : (v: number | null) => v;
  const [sortState, setSortState] = useState<ColumnSortState | null>(() => loadPersistedState().sort);
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>(() => loadPersistedState().filters);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore scroll position on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    try {
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) {
        const { top, left } = JSON.parse(saved);
        el.scrollTop = top;
        el.scrollLeft = left;
      }
    } catch {}
  }, []);

  // Save scroll position on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ top: el.scrollTop, left: el.scrollLeft }));
      }, 100);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => { el.removeEventListener("scroll", handler); clearTimeout(timer); };
  }, []);

  // Persist on change
  useEffect(() => {
    persistState(sortState, columnFilters);
  }, [sortState, columnFilters]);

  // Helper to compute values for virtual columns
  const computeRowValue = useCallback((row: CompetitorPriceDb, col: string): number | string | null => {
    switch (col) {
      case "mass_18_m3":
        return row.price_per_m3 !== null ? Math.round(row.price_per_m3 * 0.82 * 100) / 100 : null;
      case "mass_18_piece":
        return row.price_per_piece !== null ? Math.round(row.price_per_piece * 0.82 * 100) / 100 : null;
      case "mass_18_m2":
        return row.price_per_m2 !== null ? Math.round(row.price_per_m2 * 0.82 * 100) / 100 : null;
      case "diff_18_percent": {
        if (row.price_per_m3 === null || row.ti_price_per_m3 === null) return null;
        const discounted = row.price_per_m3 * 0.82;
        return Math.round(((discounted - row.ti_price_per_m3) / row.ti_price_per_m3) * 1000) / 10;
      }
      case "volume_m3": {
        if (!row.thickness_mm || !row.width_mm || !row.length_mm || !row.stock_total) return null;
        return Math.round((row.thickness_mm / 1000) * (row.width_mm / 1000) * (row.length_mm / 1000) * row.stock_total * 1000) / 1000;
      }
      case "scraped_at":
        return row.scraped_at ? new Date(row.scraped_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
      default:
        return (row as unknown as Record<string, unknown>)[col] as string | number | null;
    }
  }, []);

  // Compute unique values with cascading filters — each column's options
  // are filtered by all OTHER active filters (not its own)
  const uniqueValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    const allCols = [
      ...ALL_VALUE_COLUMNS,
      "mass_18_m3", "mass_18_piece", "mass_18_m2", "diff_18_percent",
      "volume_m3", "scraped_at",
    ];
    const numericColumns = new Set([
      "thickness_mm", "width_mm", "length_mm",
      "price_per_m3", "price_per_piece", "price_per_m2",
      "ti_price_per_m3", "ti_price_per_piece", "ti_price_per_m2",
      "price_diff_percent", "stock_total",
      "mass_18_m3", "mass_18_piece", "mass_18_m2", "diff_18_percent",
      "volume_m3",
    ]);
    for (const col of allCols) {
      // Apply all filters EXCEPT the current column
      let filtered = data;
      for (const [filterCol, filterSet] of Object.entries(columnFilters)) {
        if (filterCol === col || !filterSet || filterSet.size === 0) continue;
        filtered = filtered.filter((row) => {
          const v = computeRowValue(row, filterCol);
          return v !== null && v !== undefined && filterSet.has(String(v));
        });
      }
      const values = new Set<string>();
      for (const row of filtered) {
        const v = computeRowValue(row, col);
        if (v !== null && v !== undefined) values.add(String(v));
      }
      const arr = [...values];
      if (numericColumns.has(col)) {
        arr.sort((a, b) => Number(a) - Number(b));
      } else {
        arr.sort((a, b) => a.localeCompare(b));
      }
      result[col] = arr;
    }
    return result;
  }, [data, computeRowValue, columnFilters]);

  const handleFilterChange = (columnKey: string, values: Set<string>) => {
    setColumnFilters((prev) => ({ ...prev, [columnKey]: values }));
  };

  const filteredAndSorted = useMemo(() => {
    let result = data;

    // Apply multi-select filters from any column (including computed)
    for (const [col, filterSet] of Object.entries(columnFilters)) {
      if (filterSet && filterSet.size > 0) {
        result = result.filter((row) => {
          const v = computeRowValue(row, col);
          return v !== null && v !== undefined && filterSet.has(String(v));
        });
      }
    }

    // Sort helper
    const compare = (aVal: string | number | null, bVal: string | number | null): number => {
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") return aVal - bVal;
      return String(aVal).localeCompare(String(bVal));
    };

    // Sort
    if (sortState) {
      const key = sortState.column as SortableColumn;
      const dir = sortState.direction;
      result = [...result].sort((a, b) => {
        const aVal = computeRowValue(a, key);
        const bVal = computeRowValue(b, key);
        const cmp = compare(aVal, bVal);
        return dir === "asc" ? cmp : -cmp;
      });
    } else {
      // Default sort: source → species (custom order) → panel_type → quality → thickness → width → length
      result = [...result].sort((a, b) => {
        const speciesA = SPECIES_ORDER[(a.species || "").toLowerCase()] ?? 99;
        const speciesB = SPECIES_ORDER[(b.species || "").toLowerCase()] ?? 99;
        return (
          compare(a.source, b.source) ||
          speciesA - speciesB ||
          compare(a.panel_type, b.panel_type) ||
          compare(a.quality, b.quality) ||
          compare(a.thickness_mm, b.thickness_mm) ||
          compare(a.width_mm, b.width_mm) ||
          compare(a.length_mm, b.length_mm)
        );
      });
    }

    return result;
  }, [data, columnFilters, sortState, computeRowValue]);

  const exportPdf = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(14);
    doc.text("Timber International — Price List", 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`${filteredAndSorted.length} products | ${new Date().toLocaleDateString("de-DE")}`, 14, 21);
    doc.setTextColor(0);

    const head = [["Species", "Type", "Quality", "Thickness", "Width", "Length", "TIM €/m³", "TIM €/pc", "TIM €/m²", "Stock", "m³"]];
    const body = filteredAndSorted.map((row) => {
      const vol =
        row.thickness_mm && row.width_mm && row.length_mm && row.stock_total
          ? ((row.thickness_mm / 1000) * (row.width_mm / 1000) * (row.length_mm / 1000) * row.stock_total)
              .toFixed(3)
              .replace(".", ",")
          : "-";
      return [
        capitalizeFirst(row.species),
        row.panel_type || "-",
        row.quality || "-",
        row.thickness_mm ?? "-",
        row.width_mm ?? "-",
        row.length_mm ?? "-",
        row.ti_price_per_m3 != null ? row.ti_price_per_m3.toFixed(0) : "-",
        row.ti_price_per_piece != null ? row.ti_price_per_piece.toFixed(2) : "-",
        row.ti_price_per_m2 != null ? row.ti_price_per_m2.toFixed(2) : "-",
        row.stock_total ?? "-",
        vol,
      ];
    });

    autoTable(doc, {
      head,
      body,
      startY: 25,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
        9: { halign: "right" },
        10: { halign: "right" },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data: any) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth - 14,
          doc.internal.pageSize.getHeight() - 8,
          { align: "right" }
        );
      },
    });

    doc.save(`timber-prices-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [filteredAndSorted]);

  const activeFilterCount = Object.values(columnFilters).filter((s) => s.size > 0).length;

  const filteredSummary = useMemo(() => {
    const totalStock = filteredAndSorted.reduce((sum, item) => sum + (item.stock_total || 0), 0);
    const totalM3 = filteredAndSorted.reduce((sum, item) => {
      if (item.thickness_mm && item.width_mm && item.length_mm && item.stock_total) {
        return sum + (item.thickness_mm / 1000) * (item.width_mm / 1000) * (item.length_mm / 1000) * item.stock_total;
      }
      return sum;
    }, 0);
    return { totalStock, totalM3 };
  }, [filteredAndSorted]);

  const renderHeader = (
    column: string,
    label: string,
    opts?: { isNumeric?: boolean }
  ) => {
    const values = uniqueValues[column] || [];
    return (
      <TableHead>
        <div className="flex items-center gap-1">
          <span
            className="cursor-pointer select-none"
            onClick={() => {
              if (sortState?.column === column) {
                setSortState(
                  sortState.direction === "asc"
                    ? { column, direction: "desc" }
                    : null
                );
              } else {
                setSortState({ column, direction: "asc" });
              }
            }}
          >
            {label}
          </span>
          <ColumnHeaderMenu
            columnKey={column}
            isNumeric={opts?.isNumeric}
            uniqueValues={values}
            activeSort={sortState}
            activeFilter={columnFilters[column] || new Set()}
            onSortChange={setSortState}
            onFilterChange={handleFilterChange}
          />
        </div>
      </TableHead>
    );
  };

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        No pricing data found. Run the scraper and push results to see data here.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {activeFilterCount > 0 && (
          <span>
            Showing {filteredAndSorted.length} of {data.length} products | {filteredSummary.totalStock} pcs | {filteredSummary.totalM3.toFixed(3).replace(".", ",")} m³ ({activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active)
          </span>
        )}
        {sortState && (
          <button
            onClick={() => setSortState(null)}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear sort ({sortState.column} {sortState.direction === "asc" ? "↑" : "↓"})
          </button>
        )}
        {activeFilterCount > 0 && (
          <button
            onClick={() => setColumnFilters({})}
            className="text-xs text-destructive hover:underline"
          >
            Clear all filters
          </button>
        )}
        <button
          onClick={exportPdf}
          className="ml-auto flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
          title="Export filtered data as PDF"
        >
          <FileDown className="h-3.5 w-3.5" />
          Export PDF
        </button>
      </div>

      <div ref={scrollRef} className="rounded-lg border bg-card shadow-sm relative overflow-auto max-h-[80vh]">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card [&_th]:border-b">
            <TableRow>
              {renderHeader("source", "Source")}
              {renderHeader("species", "Species")}
              {renderHeader("panel_type", "Type")}
              {renderHeader("quality", "Qual")}
              {renderHeader("thickness_mm", "Thick", { isNumeric: true })}
              {renderHeader("width_mm", "Width", { isNumeric: true })}
              {renderHeader("length_mm", "Length", { isNumeric: true })}
              {renderHeader("price_per_m3", `${srcLabel} €/m³`, { isNumeric: true })}
              {!isGbp && renderHeader("mass_18_m3", `${srcLabel} -18% €/m³`, { isNumeric: true })}
              {renderHeader("ti_price_per_m3", "TIM €/m³", { isNumeric: true })}
              {renderHeader("price_diff_percent", "Diff", { isNumeric: true })}
              {!isGbp && renderHeader("diff_18_percent", "Diff -18%", { isNumeric: true })}
              {renderHeader("stock_total", "Stock", { isNumeric: true })}
              {renderHeader("volume_m3", "m³", { isNumeric: true })}
              <TableHead className="w-10">URL</TableHead>
              {renderHeader("scraped_at", "Scraped")}
              {renderHeader("price_per_piece", `${srcLabel} €/pc`, { isNumeric: true })}
              {renderHeader("price_per_m2", `${srcLabel} €/m²`, { isNumeric: true })}
              {!isGbp && renderHeader("mass_18_piece", `${srcLabel} -18% €/pc`, { isNumeric: true })}
              {!isGbp && renderHeader("mass_18_m2", `${srcLabel} -18% €/m²`, { isNumeric: true })}
              {renderHeader("ti_price_per_piece", "TIM €/pc", { isNumeric: true })}
              {renderHeader("ti_price_per_m2", "TIM €/m²", { isNumeric: true })}
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-muted-foreground">{item.source}</TableCell>
                <TableCell className="font-medium">
                  {capitalizeFirst(item.species)}
                </TableCell>
                <TableCell>{item.panel_type || "-"}</TableCell>
                <TableCell>{item.quality || "-"}</TableCell>
                <TableCell>{item.thickness_mm}</TableCell>
                <TableCell>{item.width_mm}</TableCell>
                <TableCell>{item.length_mm}</TableCell>
                <TableCell>{formatPrice(toEur(item.price_per_m3))}</TableCell>
                {!isGbp && <TableCell>{formatPrice(item.price_per_m3 !== null ? item.price_per_m3 * 0.82 : null)}</TableCell>}
                <TableCell>{formatPrice(item.ti_price_per_m3)}</TableCell>
                <TableCell>
                  {(() => {
                    const compEur = toEur(item.price_per_m3);
                    if (compEur == null || item.ti_price_per_m3 == null) return "-";
                    // Mass.ee: (comp - TIM) / TIM → negative = TIM pricier = good (green)
                    // UK sources: (TIM - comp) / comp → negative = TIM cheaper = good (green)
                    const diff = isGbp
                      ? Math.round(((item.ti_price_per_m3 - compEur) / compEur) * 1000) / 10
                      : Math.round(((compEur - item.ti_price_per_m3) / item.ti_price_per_m3) * 1000) / 10;
                    return (
                      <span className={diff > 0 ? "text-red-600" : diff < 0 ? "text-green-600" : ""}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                      </span>
                    );
                  })()}
                </TableCell>
                {!isGbp && <TableCell>
                  {item.price_per_m3 !== null && item.ti_price_per_m3 !== null ? (() => {
                    const discounted = item.price_per_m3 * 0.82;
                    const diff = Math.round(((discounted - item.ti_price_per_m3) / item.ti_price_per_m3) * 1000) / 10;
                    return (
                      <span className={diff > 0 ? "text-red-600" : diff < 0 ? "text-green-600" : ""}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                      </span>
                    );
                  })() : "-"}
                </TableCell>}
                <TableCell className="whitespace-nowrap">
                  <span className="font-medium">{item.stock_total}</span>
                  {item.stock_locations && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (TLN {item.stock_locations.tallinn ?? 0}, TRT {item.stock_locations.tartu ?? 0})
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {item.thickness_mm && item.width_mm && item.length_mm && item.stock_total
                    ? ((item.thickness_mm / 1000) * (item.width_mm / 1000) * (item.length_mm / 1000) * item.stock_total).toFixed(3).replace(".", ",")
                    : "-"}
                </TableCell>
                <TableCell>
                  {item.product_url && (
                    <a
                      href={item.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title="Open product page"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(item.scraped_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}{" "}
                  {new Date(item.scraped_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                </TableCell>
                <TableCell>{formatPrice(toEur(item.price_per_piece))}</TableCell>
                <TableCell>{formatPrice(toEur(item.price_per_m2))}</TableCell>
                {!isGbp && <TableCell>{formatPrice(item.price_per_piece !== null ? item.price_per_piece * 0.82 : null)}</TableCell>}
                {!isGbp && <TableCell>{formatPrice(item.price_per_m2 !== null ? item.price_per_m2 * 0.82 : null)}</TableCell>}
                <TableCell>{formatPrice(item.ti_price_per_piece)}</TableCell>
                <TableCell>{formatPrice(item.ti_price_per_m2)}</TableCell>
                <TableCell>
                  <button
                    onClick={async () => {
                      const res = await deleteCompetitorPrice(item.id);
                      if (res.success && onDelete) onDelete(item.id);
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete row"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
