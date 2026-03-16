"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { ExternalLink, Trash2 } from "lucide-react";
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
  | "ti_price_per_piece"
  | "ti_price_per_m2"
  | "ti_price_per_m3"
  | "price_diff_percent"
  | "stock_total";

interface PriceTableProps {
  data: CompetitorPriceDb[];
  onDelete?: (id: string) => void;
}

function capitalizeFirst(s: string | null): string {
  if (!s) return "-";
  return s.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

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

export function PriceTable({ data, onDelete }: PriceTableProps) {
  const [sortState, setSortState] = useState<ColumnSortState | null>(() => loadPersistedState().sort);
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>(() => loadPersistedState().filters);

  // Persist on change
  useEffect(() => {
    persistState(sortState, columnFilters);
  }, [sortState, columnFilters]);

  // Compute unique values for each filterable column
  const uniqueValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const col of FILTERABLE_COLUMNS) {
      const values = new Set<string>();
      for (const row of data) {
        const v = row[col];
        if (v !== null && v !== undefined) values.add(String(v));
      }
      result[col] = [...values];
    }
    return result;
  }, [data]);

  const handleFilterChange = (columnKey: string, values: Set<string>) => {
    setColumnFilters((prev) => ({ ...prev, [columnKey]: values }));
  };

  const filteredAndSorted = useMemo(() => {
    let result = data;

    // Apply multi-select filters
    for (const col of FILTERABLE_COLUMNS) {
      const filterSet = columnFilters[col];
      if (filterSet && filterSet.size > 0) {
        result = result.filter((row) => {
          const v = row[col];
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
        const cmp = compare(a[key], b[key]);
        return dir === "asc" ? cmp : -cmp;
      });
    } else {
      // Default sort: source → species → panel_type → quality → thickness → width → length
      result = [...result].sort((a, b) => {
        return (
          compare(a.source, b.source) ||
          compare(a.species, b.species) ||
          compare(a.panel_type, b.panel_type) ||
          compare(a.quality, b.quality) ||
          compare(a.thickness_mm, b.thickness_mm) ||
          compare(a.width_mm, b.width_mm) ||
          compare(a.length_mm, b.length_mm)
        );
      });
    }

    return result;
  }, [data, columnFilters, sortState]);

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
    opts?: { isNumeric?: boolean; filterable?: boolean }
  ) => {
    const isFilterable = opts?.filterable !== false && FILTERABLE_COLUMNS.includes(column as FilterableColumn);
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
          {isFilterable ? (
            <ColumnHeaderMenu
              columnKey={column}
              isNumeric={opts?.isNumeric}
              uniqueValues={uniqueValues[column] || []}
              activeSort={sortState}
              activeFilter={columnFilters[column] || new Set()}
              onSortChange={setSortState}
              onFilterChange={handleFilterChange}
            />
          ) : (
            <ColumnHeaderMenu
              columnKey={column}
              isNumeric={opts?.isNumeric}
              uniqueValues={[]}
              activeSort={sortState}
              activeFilter={new Set()}
              onSortChange={setSortState}
              onFilterChange={() => {}}
            />
          )}
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
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing {filteredAndSorted.length} of {data.length} products | {filteredSummary.totalStock} pcs | {filteredSummary.totalM3.toFixed(3).replace(".", ",")} m³ ({activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active)
          </span>
          <button
            onClick={() => setColumnFilters({})}
            className="text-xs text-destructive hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      <div className="rounded-lg border bg-card shadow-sm relative overflow-auto max-h-[80vh]">
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
              {renderHeader("price_per_m3", "Mass €/m³", { isNumeric: true, filterable: false })}
              <TableHead><span className="text-xs">Mass -18% €/m³</span></TableHead>
              {renderHeader("ti_price_per_m3", "TIM €/m³", { isNumeric: true, filterable: false })}
              {renderHeader("price_diff_percent", "Diff", { isNumeric: true, filterable: false })}
              <TableHead><span className="text-xs">Diff -18%</span></TableHead>
              <TableHead className="min-w-[160px]">
                <div className="flex items-center gap-1">
                  <span className="cursor-pointer select-none" onClick={() => {
                    if (sortState?.column === "stock_total") {
                      setSortState(sortState.direction === "asc" ? { column: "stock_total", direction: "desc" } : null);
                    } else {
                      setSortState({ column: "stock_total", direction: "asc" });
                    }
                  }}>Stock</span>
                  <ColumnHeaderMenu columnKey="stock_total" isNumeric uniqueValues={[]} activeSort={sortState} activeFilter={new Set()} onSortChange={setSortState} onFilterChange={() => {}} />
                </div>
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">m³</TableHead>
              <TableHead className="w-10">URL</TableHead>
              <TableHead className="whitespace-nowrap">Scraped</TableHead>
              {renderHeader("price_per_piece", "Mass €/pc", { isNumeric: true, filterable: false })}
              {renderHeader("price_per_m2", "Mass €/m²", { isNumeric: true, filterable: false })}
              <TableHead><span className="text-xs">Mass -18% €/pc</span></TableHead>
              <TableHead><span className="text-xs">Mass -18% €/m²</span></TableHead>
              {renderHeader("ti_price_per_piece", "TIM €/pc", { isNumeric: true, filterable: false })}
              {renderHeader("ti_price_per_m2", "TIM €/m²", { isNumeric: true, filterable: false })}
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
                <TableCell>{formatPrice(item.price_per_m3)}</TableCell>
                <TableCell>{formatPrice(item.price_per_m3 !== null ? item.price_per_m3 * 0.82 : null)}</TableCell>
                <TableCell>{formatPrice(item.ti_price_per_m3)}</TableCell>
                <TableCell>
                  {item.price_diff_percent !== null ? (
                    <span
                      className={
                        item.price_diff_percent > 0
                          ? "text-red-600"
                          : item.price_diff_percent < 0
                            ? "text-green-600"
                            : ""
                      }
                    >
                      {item.price_diff_percent > 0 ? "+" : ""}
                      {item.price_diff_percent.toFixed(1)}%
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {item.price_per_m3 !== null && item.ti_price_per_m3 !== null ? (() => {
                    const discounted = item.price_per_m3 * 0.82;
                    const diff = Math.round(((discounted - item.ti_price_per_m3) / item.ti_price_per_m3) * 1000) / 10;
                    return (
                      <span className={diff > 0 ? "text-red-600" : diff < 0 ? "text-green-600" : ""}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                      </span>
                    );
                  })() : "-"}
                </TableCell>
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
                <TableCell>{formatPrice(item.price_per_piece)}</TableCell>
                <TableCell>{formatPrice(item.price_per_m2)}</TableCell>
                <TableCell>{formatPrice(item.price_per_piece !== null ? item.price_per_piece * 0.82 : null)}</TableCell>
                <TableCell>{formatPrice(item.price_per_m2 !== null ? item.price_per_m2 * 0.82 : null)}</TableCell>
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
