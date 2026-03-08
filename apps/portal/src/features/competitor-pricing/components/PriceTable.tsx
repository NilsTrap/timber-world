"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import type { CompetitorPriceDb } from "../types";
import { formatPrice, formatStockLocations } from "../types";

type SortKey =
  | "thickness_mm"
  | "width_mm"
  | "length_mm"
  | "quality"
  | "price_per_piece"
  | "price_per_m2"
  | "price_per_m3"
  | "ti_price_per_piece"
  | "ti_price_per_m2"
  | "ti_price_per_m3"
  | "price_diff_percent"
  | "stock_total";
type SortDirection = "asc" | "desc";

interface PriceTableProps {
  data: CompetitorPriceDb[];
}

export function PriceTable({ data }: PriceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("thickness_mm");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      // Handle nulls
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      // Compare
      let comparison = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  const SortableHeader = ({
    column,
    label,
  }: {
    column: SortKey;
    label: string;
  }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${sortKey === column ? "opacity-100" : "opacity-30"}`}
        />
      </div>
    </TableHead>
  );

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        No pricing data found. Run the scraper and push results to see data here.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader column="thickness_mm" label="Thick" />
            <SortableHeader column="width_mm" label="Width" />
            <SortableHeader column="length_mm" label="Length" />
            <SortableHeader column="quality" label="Qual" />
            <SortableHeader column="price_per_piece" label="Mass €/pc" />
            <SortableHeader column="price_per_m2" label="Mass €/m²" />
            <SortableHeader column="price_per_m3" label="Mass €/m³" />
            <SortableHeader column="ti_price_per_piece" label="TI €/pc" />
            <SortableHeader column="ti_price_per_m2" label="TI €/m²" />
            <SortableHeader column="ti_price_per_m3" label="TI €/m³" />
            <SortableHeader column="price_diff_percent" label="Diff" />
            <SortableHeader column="stock_total" label="Stock" />
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {item.thickness_mm}
              </TableCell>
              <TableCell>{item.width_mm}</TableCell>
              <TableCell>{item.length_mm}</TableCell>
              <TableCell>{item.quality || "-"}</TableCell>
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
  );
}
