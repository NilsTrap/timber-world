"use client";

import { useState, useMemo } from "react";
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
import { ExternalLink } from "lucide-react";
import type { CompetitorPriceDb } from "../types";
import { formatPrice, formatStockLocations } from "../types";

type FilterableColumn =
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
}

function capitalizeFirst(s: string | null): string {
  if (!s) return "-";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const FILTERABLE_COLUMNS: FilterableColumn[] = [
  "species",
  "panel_type",
  "thickness_mm",
  "width_mm",
  "length_mm",
  "quality",
];

export function PriceTable({ data }: PriceTableProps) {
  const [sortState, setSortState] = useState<ColumnSortState | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});

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
      // Default sort: species → panel_type → quality → thickness → width → length
      result = [...result].sort((a, b) => {
        return (
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
            Showing {filteredAndSorted.length} of {data.length} products ({activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active)
          </span>
          <button
            onClick={() => setColumnFilters({})}
            className="text-xs text-destructive hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {renderHeader("species", "Species")}
              {renderHeader("panel_type", "Type")}
              {renderHeader("quality", "Qual")}
              {renderHeader("thickness_mm", "Thick", { isNumeric: true })}
              {renderHeader("width_mm", "Width", { isNumeric: true })}
              {renderHeader("length_mm", "Length", { isNumeric: true })}
              {renderHeader("price_per_piece", "Mass €/pc", { isNumeric: true, filterable: false })}
              {renderHeader("price_per_m2", "Mass €/m²", { isNumeric: true, filterable: false })}
              {renderHeader("price_per_m3", "Mass €/m³", { isNumeric: true, filterable: false })}
              {renderHeader("ti_price_per_piece", "TI €/pc", { isNumeric: true, filterable: false })}
              {renderHeader("ti_price_per_m2", "TI €/m²", { isNumeric: true, filterable: false })}
              {renderHeader("ti_price_per_m3", "TI €/m³", { isNumeric: true, filterable: false })}
              {renderHeader("price_diff_percent", "Diff", { isNumeric: true, filterable: false })}
              {renderHeader("stock_total", "Stock", { isNumeric: true, filterable: false })}
              <TableHead className="w-10">URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {capitalizeFirst(item.species)}
                </TableCell>
                <TableCell>{item.panel_type || "-"}</TableCell>
                <TableCell>{item.quality || "-"}</TableCell>
                <TableCell>{item.thickness_mm}</TableCell>
                <TableCell>{item.width_mm}</TableCell>
                <TableCell>{item.length_mm}</TableCell>
                <TableCell>{formatPrice(item.price_per_piece)}</TableCell>
                <TableCell>{formatPrice(item.price_per_m2)}</TableCell>
                <TableCell>{formatPrice(item.price_per_m3)}</TableCell>
                <TableCell>{formatPrice(item.ti_price_per_piece)}</TableCell>
                <TableCell>{formatPrice(item.ti_price_per_m2)}</TableCell>
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
                  <div className="flex flex-col">
                    <span className="font-medium">{item.stock_total}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatStockLocations(item.stock_locations)}
                    </span>
                  </div>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
