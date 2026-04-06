"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2 } from "lucide-react";
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
import { getMarketingStock, type MarketingStockItem } from "../actions/getMarketingStock";

function formatPrice(cents: number | null): string {
  if (cents === null || cents === 0) return "On Request";
  return (cents / 100).toFixed(2).replace(".", ",");
}

const NUMERIC_COLS = new Set([
  "thickness", "width", "length", "pieces", "volume_m3",
  "unit_price_piece", "unit_price_m3", "unit_price_m2",
]);

const ALL_COLUMNS = [
  "organisation_code", "product_name", "species", "type", "quality",
  "humidity", "processing", "fsc", "thickness", "width", "length",
  "pieces", "volume_m3", "unit_price_piece", "unit_price_m3", "unit_price_m2",
] as const;

export function MarketingStockTable() {
  const [data, setData] = useState<MarketingStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columnSort, setColumnSort] = useState<ColumnSortState | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    getMarketingStock().then((result) => {
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
  }, []);

  const getDisplayValue = useCallback((item: MarketingStockItem, colKey: string): string => {
    switch (colKey) {
      case "organisation_code": return item.organisation_code || "";
      case "product_name": return item.product_name || "";
      case "species": return item.species || "";
      case "type": return item.type || "";
      case "quality": return item.quality || "";
      case "humidity": return item.humidity || "";
      case "processing": return item.processing || "";
      case "fsc": return item.fsc || "";
      case "thickness": return item.thickness || "";
      case "width": return item.width || "";
      case "length": return item.length || "";
      case "pieces": return String(item.pieces);
      case "volume_m3": return item.volume_m3 ? item.volume_m3.toFixed(3) : "";
      case "unit_price_piece": return item.unit_price_piece ? formatPrice(item.unit_price_piece) : "";
      case "unit_price_m3": return item.unit_price_m3 ? formatPrice(item.unit_price_m3) : "";
      case "unit_price_m2": return item.unit_price_m2 ? formatPrice(item.unit_price_m2) : "";
      default: return "";
    }
  }, []);

  const handleFilterChange = useCallback(
    (columnKey: string, values: Set<string>) => {
      setColumnFilters((prev) => ({ ...prev, [columnKey]: values }));
    },
    []
  );

  const columnUniqueValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const colKey of ALL_COLUMNS) {
      // Filter rows by all OTHER active filters (not this column)
      const filteredRows = data.filter((item) => {
        for (const [filterCol, allowedValues] of Object.entries(columnFilters)) {
          if (filterCol === colKey || allowedValues.size === 0) continue;
          const val = getDisplayValue(item, filterCol);
          if (!allowedValues.has(val)) return false;
        }
        return true;
      });
      const valSet = new Set<string>();
      for (const row of filteredRows) {
        const val = getDisplayValue(row, colKey);
        if (val) valSet.add(val);
      }
      map[colKey] = [...valSet];
    }
    return map;
  }, [data, columnFilters, getDisplayValue]);

  const displayRows = useMemo(() => {
    // Apply filters
    let result = data.filter((item) => {
      for (const [colKey, allowedValues] of Object.entries(columnFilters)) {
        if (allowedValues.size === 0) continue;
        const val = getDisplayValue(item, colKey);
        if (!allowedValues.has(val)) return false;
      }
      return true;
    });

    // Apply sort
    if (columnSort) {
      const { column: sortCol, direction } = columnSort;
      const isNum = NUMERIC_COLS.has(sortCol);
      result = [...result].sort((a, b) => {
        const aVal = getDisplayValue(a, sortCol);
        const bVal = getDisplayValue(b, sortCol);
        if (isNum) {
          const aNum = parseFloat(aVal.replace(",", ".")) || 0;
          const bNum = parseFloat(bVal.replace(",", ".")) || 0;
          return direction === "asc" ? aNum - bNum : bNum - aNum;
        }
        const cmp = aVal.localeCompare(bVal);
        return direction === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [data, columnFilters, columnSort, getDisplayValue]);

  const totalPieces = useMemo(() => displayRows.reduce((sum, d) => sum + d.pieces, 0), [displayRows]);
  const totalVolume = useMemo(
    () => displayRows.reduce((sum, d) => sum + (d.volume_m3 || 0), 0),
    [displayRows]
  );

  const headerWithMenu = (colKey: string, label: string, isNumeric = false) => (
    <span className="flex items-center gap-0.5">
      {label}
      <ColumnHeaderMenu
        columnKey={colKey}
        isNumeric={isNumeric}
        uniqueValues={columnUniqueValues[colKey] ?? []}
        activeSort={columnSort}
        activeFilter={columnFilters[colKey] ?? new Set()}
        onSortChange={setColumnSort}
        onFilterChange={handleFilterChange}
      />
    </span>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium">{displayRows.length}</span>{data.length !== displayRows.length ? ` / ${data.length}` : ""} packages |{" "}
        <span className="font-medium">{totalPieces.toLocaleString()}</span> pcs |{" "}
        <span className="font-medium">{totalVolume.toFixed(3).replace(".", ",")}</span> m³
      </div>

      {data.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No marketing stock data. Enable organisations in the Sources tab.
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-auto max-h-[75vh]">
          <Table>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card [&_th]:border-b">
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{headerWithMenu("organisation_code", "Org")}</TableHead>
                <TableHead>{headerWithMenu("product_name", "Product")}</TableHead>
                <TableHead>{headerWithMenu("species", "Species")}</TableHead>
                <TableHead>{headerWithMenu("type", "Type")}</TableHead>
                <TableHead>{headerWithMenu("quality", "Quality")}</TableHead>
                <TableHead>{headerWithMenu("humidity", "Humidity")}</TableHead>
                <TableHead className="text-right">{headerWithMenu("thickness", "Thick", true)}</TableHead>
                <TableHead className="text-right">{headerWithMenu("width", "Width", true)}</TableHead>
                <TableHead className="text-right">{headerWithMenu("length", "Length", true)}</TableHead>
                <TableHead className="text-right">{headerWithMenu("pieces", "Pcs", true)}</TableHead>
                <TableHead className="text-right">{headerWithMenu("volume_m3", "m³", true)}</TableHead>
                <TableHead className="text-right">{headerWithMenu("unit_price_piece", "€/pc", true)}</TableHead>
                <TableHead className="text-right">{headerWithMenu("unit_price_m3", "€/m³", true)}</TableHead>
                <TableHead className="text-right">{headerWithMenu("unit_price_m2", "€/m²", true)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{item.organisation_code}</TableCell>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell>{item.species}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.quality}</TableCell>
                  <TableCell>{item.humidity}</TableCell>
                  <TableCell className="text-right">{item.thickness}</TableCell>
                  <TableCell className="text-right">{item.width}</TableCell>
                  <TableCell className="text-right">{item.length}</TableCell>
                  <TableCell className="text-right">{item.pieces}</TableCell>
                  <TableCell className="text-right">
                    {item.volume_m3 ? item.volume_m3.toFixed(3).replace(".", ",") : "-"}
                  </TableCell>
                  <TableCell className="text-right">{formatPrice(item.unit_price_piece)}</TableCell>
                  <TableCell className="text-right">{formatPrice(item.unit_price_m3)}</TableCell>
                  <TableCell className="text-right">{formatPrice(item.unit_price_m2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
