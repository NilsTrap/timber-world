"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { Button } from "@timber/ui";
import { formatDate } from "@/lib/utils";

/** Format number with comma decimal separator */
function fmt3(n: number): string {
  return n.toFixed(3).replace(".", ",");
}
function fmt1(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

/** Convert DD.MM.YYYY to YYYY-MM-DD for internal filtering */
function parseEuropeanDate(value: string): string {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return "";
}

import type { ProductionHistoryItem } from "../types";

interface ProductionHistoryTableProps {
  entries: ProductionHistoryItem[];
}

type SortColumn = keyof Pick<
  ProductionHistoryItem,
  | "productionDate"
  | "processName"
  | "totalInputM3"
  | "totalOutputM3"
  | "outcomePercentage"
  | "wastePercentage"
>;

/**
 * Production History Table
 *
 * Displays validated production entries with sortable columns
 * and client-side filters for process type and date range.
 */
export function ProductionHistoryTable({
  entries,
}: ProductionHistoryTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("productionDate");
  const [sortAsc, setSortAsc] = useState(false);
  const [processFilter, setProcessFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Unique process names for filter dropdown
  const processNames = useMemo(() => {
    const names = new Set(entries.map((e) => e.processName));
    return Array.from(names).sort();
  }, [entries]);

  const hasActiveFilters = processFilter !== "" || dateFrom !== "" || dateTo !== "";

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Process filter
    if (processFilter) {
      result = result.filter((e) => e.processName === processFilter);
    }

    // Date range filter (convert DD.MM.YYYY inputs to ISO for comparison)
    const isoFrom = parseEuropeanDate(dateFrom);
    const isoTo = parseEuropeanDate(dateTo);
    if (isoFrom) {
      result = result.filter((e) => e.productionDate >= isoFrom);
    }
    if (isoTo) {
      result = result.filter((e) => e.productionDate <= isoTo);
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortAsc ? aNum - bNum : bNum - aNum;
    });

    return result;
  }, [entries, processFilter, dateFrom, dateTo, sortColumn, sortAsc]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(column);
      setSortAsc(false);
    }
  };

  const clearFilters = () => {
    setProcessFilter("");
    setDateFrom("");
    setDateTo("");
  };

  // Empty state — no entries at all
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No production history yet</p>
      </div>
    );
  }

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return sortAsc ? (
      <ChevronUp className="h-3 w-3 inline ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-1" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={processFilter}
          onChange={(e) => setProcessFilter(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          aria-label="Filter by process"
        >
          <option value="">All Processes</option>
          {processNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="DD.MM.YYYY"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-[120px] rounded-md border bg-background px-3 text-sm"
            aria-label="Date from"
            maxLength={10}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="text"
            placeholder="DD.MM.YYYY"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-[120px] rounded-md border bg-background px-3 text-sm"
            aria-label="Date to"
            maxLength={10}
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs h-7"
          >
            <X className="h-3 w-3 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th
                className="px-4 py-3 text-left font-medium cursor-pointer select-none hover:bg-muted/80"
                onClick={() => handleSort("productionDate")}
              >
                Date
                <SortIcon column="productionDate" />
              </th>
              <th
                className="px-4 py-3 text-left font-medium cursor-pointer select-none hover:bg-muted/80"
                onClick={() => handleSort("processName")}
              >
                Process
                <SortIcon column="processName" />
              </th>
              <th
                className="px-4 py-3 text-right font-medium cursor-pointer select-none hover:bg-muted/80"
                onClick={() => handleSort("totalInputM3")}
              >
                Input m³
                <SortIcon column="totalInputM3" />
              </th>
              <th
                className="px-4 py-3 text-right font-medium cursor-pointer select-none hover:bg-muted/80"
                onClick={() => handleSort("totalOutputM3")}
              >
                Output m³
                <SortIcon column="totalOutputM3" />
              </th>
              <th
                className="px-4 py-3 text-right font-medium cursor-pointer select-none hover:bg-muted/80"
                onClick={() => handleSort("outcomePercentage")}
              >
                Outcome %
                <SortIcon column="outcomePercentage" />
              </th>
              <th
                className="px-4 py-3 text-right font-medium cursor-pointer select-none hover:bg-muted/80"
                onClick={() => handleSort("wastePercentage")}
              >
                Waste %
                <SortIcon column="wastePercentage" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No entries match your filters
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/production/${entry.id}`}
                      className="hover:underline"
                    >
                      {formatDate(entry.productionDate)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/production/${entry.id}`}
                      className="hover:underline"
                    >
                      {entry.processName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmt3(entry.totalInputM3)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmt3(entry.totalOutputM3)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmt1(entry.outcomePercentage)}%
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmt1(entry.wastePercentage)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
