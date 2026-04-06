"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  cn,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Checkbox,
  ColumnHeaderMenu,
  type ColumnSortState,
} from "@timber/ui";
import type { StockProduct } from "@/lib/actions/products";

interface ProductTableProps {
  products: StockProduct[];
  selectedProducts: Set<string>;
  sortBy?: string;
  sortOrder: "asc" | "desc";
  onToggleSelect: (productId: string) => void;
  onSelectAll: () => void;
  onSortChange: (column: string, order: "asc" | "desc") => void;
  isPending: boolean;
}

const NUMERIC_COLS = new Set([
  "thickness", "width", "length", "stock_quantity", "volume_m3",
  "unit_price_piece", "unit_price_m3", "unit_price_m2",
]);

const ALL_COLUMNS = [
  "name", "species", "humidity", "type", "quality_grade",
  "thickness", "width", "length", "stock_quantity", "volume_m3",
  "unit_price_piece", "unit_price_m3", "unit_price_m2",
] as const;

function formatPrice(cents: number | null): string {
  if (!cents) return "";
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPriceNoDecimals(cents: number | null): string {
  if (!cents) return "";
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false });
}

export function ProductTable({
  products,
  selectedProducts,
  onToggleSelect,
  onSelectAll,
  isPending,
}: ProductTableProps) {
  const t = useTranslations("catalog");
  const [columnSort, setColumnSort] = useState<ColumnSortState | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});

  const getDisplayValue = useCallback((item: StockProduct, colKey: string): string => {
    switch (colKey) {
      case "name": return item.name || "";
      case "species": return item.species || "";
      case "humidity": return item.humidity || "";
      case "type": return item.type || "";
      case "quality_grade": return item.quality_grade || "";
      case "thickness": return item.thickness_display || String(item.thickness);
      case "width": return item.width_display || String(item.width);
      case "length": return item.length_display || String(item.length);
      case "stock_quantity": return String(item.stock_quantity);
      case "volume_m3": return item.volume_m3 != null ? item.volume_m3.toFixed(3) : "";
      case "unit_price_piece": return item.unit_price_piece ? formatPrice(item.unit_price_piece) : "";
      case "unit_price_m3": return item.unit_price_m3 ? formatPriceNoDecimals(item.unit_price_m3) : "";
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
      const filteredRows = products.filter((item) => {
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
  }, [products, columnFilters, getDisplayValue]);

  const displayRows = useMemo(() => {
    let result = products.filter((item) => {
      for (const [colKey, allowedValues] of Object.entries(columnFilters)) {
        if (allowedValues.size === 0) continue;
        const val = getDisplayValue(item, colKey);
        if (!allowedValues.has(val)) return false;
      }
      return true;
    });

    if (columnSort) {
      const { column: sortCol, direction } = columnSort;
      const isNum = NUMERIC_COLS.has(sortCol);
      result = [...result].sort((a, b) => {
        if (isNum) {
          const aNum = sortCol === "volume_m3" ? (a.volume_m3 || 0) :
                       sortCol === "stock_quantity" ? a.stock_quantity :
                       sortCol.startsWith("unit_price") ? ((a as unknown as Record<string, number>)[sortCol] || 0) :
                       parseFloat(getDisplayValue(a, sortCol)) || 0;
          const bNum = sortCol === "volume_m3" ? (b.volume_m3 || 0) :
                       sortCol === "stock_quantity" ? b.stock_quantity :
                       sortCol.startsWith("unit_price") ? ((b as unknown as Record<string, number>)[sortCol] || 0) :
                       parseFloat(getDisplayValue(b, sortCol)) || 0;
          return direction === "asc" ? aNum - bNum : bNum - aNum;
        }
        const aVal = getDisplayValue(a, sortCol);
        const bVal = getDisplayValue(b, sortCol);
        const cmp = aVal.localeCompare(bVal);
        return direction === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [products, columnFilters, columnSort, getDisplayValue]);

  const allSelected = displayRows.length > 0 && displayRows.every(p => selectedProducts.has(p.id));
  const someSelected = displayRows.some(p => selectedProducts.has(p.id)) && !allSelected;

  const handleSelectAllChange = () => {
    if (allSelected) {
      displayRows.forEach(p => onToggleSelect(p.id));
    } else {
      onSelectAll();
    }
  };

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

  return (
    <div className={cn(
      "rounded-lg border bg-background flex flex-col h-full overflow-hidden [&_[data-slot=table-container]]:flex-1 [&_[data-slot=table-container]]:overflow-y-auto [&_[data-slot=table-container]]:pr-4",
      isPending && "opacity-50"
    )}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background border-b">
            <TableRow className="hover:bg-transparent [&_th]:text-black [&_th]:whitespace-nowrap [&_th]:px-0.5 [&_th]:py-2 [&_th]:text-sm [&_th]:font-semibold h-12">
              <TableHead className="w-6 bg-background pl-2">
                <Checkbox
                  checked={someSelected ? "indeterminate" : allSelected}
                  onCheckedChange={handleSelectAllChange}
                  aria-label={t("selectAll")}
                />
              </TableHead>
              <TableHead className="bg-background">{headerWithMenu("name", t("product"))}</TableHead>
              <TableHead className="bg-background">{headerWithMenu("species", t("species"))}</TableHead>
              <TableHead className="bg-background">{headerWithMenu("humidity", t("humidity"))}</TableHead>
              <TableHead className="bg-background">{headerWithMenu("type", t("type"))}</TableHead>
              <TableHead className="bg-background">{headerWithMenu("quality_grade", t("quality"))}</TableHead>
              <TableHead className="text-right bg-background">{headerWithMenu("thickness", t("thickness"), true)}</TableHead>
              <TableHead className="text-right bg-background">{headerWithMenu("width", t("width"), true)}</TableHead>
              <TableHead className="text-right bg-background">{headerWithMenu("length", t("length"), true)}</TableHead>
              <TableHead className="text-right bg-background">{headerWithMenu("stock_quantity", t("pieces"), true)}</TableHead>
              <TableHead className="text-right bg-background">{headerWithMenu("volume_m3", t("cubicMeters"), true)}</TableHead>
              <TableHead className="text-right bg-background">{headerWithMenu("unit_price_piece", t("priceEur"), true)}</TableHead>
              <TableHead className="text-right bg-background">{headerWithMenu("unit_price_m3", t("exwM3"), true)}</TableHead>
              <TableHead className="text-right bg-background pr-4">{headerWithMenu("unit_price_m2", t("exwM2"), true)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((product) => (
              <TableRow
                key={product.id}
                data-state={selectedProducts.has(product.id) ? "selected" : undefined}
                className="cursor-pointer text-black [&_td]:whitespace-nowrap [&_td]:px-0.5 [&_td]:py-2"
                onClick={() => onToggleSelect(product.id)}
              >
                <TableCell className="pl-2" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedProducts.has(product.id)}
                    onCheckedChange={() => onToggleSelect(product.id)}
                    aria-label={`Select ${product.sku}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.species}</TableCell>
                <TableCell>{product.humidity}</TableCell>
                <TableCell>
                  {product.type === "FJ" ? t("typeFJ") : t("typeFS")}
                </TableCell>
                <TableCell>{product.quality_grade}</TableCell>
                <TableCell className="text-right">{product.thickness_display || product.thickness}</TableCell>
                <TableCell className="text-right">{product.width_display || product.width}</TableCell>
                <TableCell className="text-right">{product.length_display || product.length}</TableCell>
                <TableCell className="text-right">{product.stock_quantity || "-"}</TableCell>
                <TableCell className="text-right">
                  {product.volume_m3 != null && !isNaN(product.volume_m3)
                    ? product.volume_m3.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {product.unit_price_piece ? (product.unit_price_piece / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : t("onRequest")}
                </TableCell>
                <TableCell className="text-right">
                  {product.unit_price_m3 ? (product.unit_price_m3 / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }) : t("onRequest")}
                </TableCell>
                <TableCell className="text-right pr-4">
                  {product.unit_price_m2 ? (product.unit_price_m2 / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : t("onRequest")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
      </Table>
    </div>
  );
}
