"use client";

import { useMemo, useState, useCallback } from "react";
import { ListFilter, ArrowUpNarrowWide, ArrowDownWideNarrow, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";

export type SortDirection = "asc" | "desc";

export interface ColumnSortState {
  column: string;
  direction: SortDirection;
}

interface ColumnHeaderMenuProps {
  columnKey: string;
  isNumeric?: boolean;
  uniqueValues: string[];
  activeSort: ColumnSortState | null;
  activeFilter: Set<string>;
  onSortChange: (sort: ColumnSortState | null) => void;
  onFilterChange: (columnKey: string, values: Set<string>) => void;
}

const DATE_REGEX = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/** Parse DD.MM.YYYY → YYYY-MM-DD for date input and comparison */
function ddmmyyyyToIso(val: string): string {
  const m = val.match(DATE_REGEX);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Parse DD.MM.YYYY → sortable YYYYMMDD number */
function ddmmyyyyToNum(val: string): number {
  const m = val.match(DATE_REGEX);
  if (!m) return 0;
  return parseInt(`${m[3]}${m[2]}${m[1]}`, 10);
}

function ColumnHeaderMenu({
  columnKey,
  isNumeric = false,
  uniqueValues,
  activeSort,
  activeFilter,
  onSortChange,
  onFilterChange,
}: ColumnHeaderMenuProps) {
  const isActive =
    (activeSort?.column === columnKey) || activeFilter.size > 0;

  // Detect if values are DD.MM.YYYY dates
  const isDate = useMemo(
    () => uniqueValues.length > 0 && uniqueValues.every((v) => DATE_REGEX.test(v)),
    [uniqueValues]
  );

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const sortedUniqueValues = useMemo(
    () => {
      return [...uniqueValues].sort((a, b) => {
        if (isDate) {
          return ddmmyyyyToNum(b) - ddmmyyyyToNum(a);
        }
        if (isNumeric) {
          const aNum = parseFloat(a.replace(",", "."));
          const bNum = parseFloat(b.replace(",", "."));
          const aValid = !isNaN(aNum);
          const bValid = !isNaN(bNum);
          if (aValid && bValid) return aNum - bNum;
          if (aValid) return -1;
          if (bValid) return 1;
        }
        // Natural sort: compare prefix alphabetically, then trailing number numerically
        const aPrefix = a.replace(/\d+$/, "");
        const bPrefix = b.replace(/\d+$/, "");
        const prefCmp = aPrefix.localeCompare(bPrefix);
        if (prefCmp !== 0) return prefCmp;
        const aTrail = parseInt(a.match(/\d+$/)?.[0] || "0", 10);
        const bTrail = parseInt(b.match(/\d+$/)?.[0] || "0", 10);
        if (aTrail !== bTrail) return aTrail - bTrail;
        return a.localeCompare(b);
      });
    },
    [uniqueValues, isNumeric, isDate]
  );

  const ascLabel = isDate ? "Oldest → Newest" : isNumeric ? "Small → Large" : "A → Z";
  const descLabel = isDate ? "Newest → Oldest" : isNumeric ? "Large → Small" : "Z → A";

  const handleSort = (direction: SortDirection) => {
    if (activeSort?.column === columnKey && activeSort.direction === direction) {
      onSortChange(null);
    } else {
      onSortChange({ column: columnKey, direction });
    }
  };

  const handleClearSort = () => {
    onSortChange(null);
  };

  const handleToggleValue = (value: string) => {
    const next = new Set(activeFilter);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onFilterChange(columnKey, next);
  };

  const handleSelectAll = () => {
    onFilterChange(columnKey, new Set(sortedUniqueValues));
  };

  const handleClearFilter = () => {
    onFilterChange(columnKey, new Set());
    setRangeFrom("");
    setRangeTo("");
  };

  // Apply date range: select all dates within from-to
  const handleApplyRange = useCallback(() => {
    if (!rangeFrom && !rangeTo) return;
    const fromNum = rangeFrom ? parseInt(rangeFrom.replace(/-/g, ""), 10) : 0;
    const toNum = rangeTo ? parseInt(rangeTo.replace(/-/g, ""), 10) : 99999999;
    const matching = new Set<string>();
    for (const val of uniqueValues) {
      const num = ddmmyyyyToNum(val);
      if (num >= fromNum && num <= toNum) {
        matching.add(val);
      }
    }
    onFilterChange(columnKey, matching);
  }, [rangeFrom, rangeTo, uniqueValues, columnKey, onFilterChange]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`relative inline-flex items-center justify-center h-4 w-4 rounded-sm hover:bg-accent/80 transition-colors ${
            isActive ? "text-primary" : "text-muted-foreground/60"
          }`}
          aria-label="Sort and filter"
        >
          <ListFilter className="h-3 w-3" />
          {activeFilter.size > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-48 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sort Section */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-1">Sort</p>
          <button
            type="button"
            onClick={() => handleSort("asc")}
            className={`flex items-center gap-2 w-full text-left text-xs px-1 py-1 rounded-sm hover:bg-accent ${
              activeSort?.column === columnKey && activeSort.direction === "asc"
                ? "bg-accent font-medium"
                : ""
            }`}
          >
            <ArrowUpNarrowWide className="h-3 w-3" />
            {ascLabel}
          </button>
          <button
            type="button"
            onClick={() => handleSort("desc")}
            className={`flex items-center gap-2 w-full text-left text-xs px-1 py-1 rounded-sm hover:bg-accent ${
              activeSort?.column === columnKey && activeSort.direction === "desc"
                ? "bg-accent font-medium"
                : ""
            }`}
          >
            <ArrowDownWideNarrow className="h-3 w-3" />
            {descLabel}
          </button>
          {activeSort?.column === columnKey && (
            <button
              type="button"
              onClick={handleClearSort}
              className="flex items-center gap-2 w-full text-left text-xs px-1 py-1 rounded-sm hover:bg-accent text-muted-foreground"
            >
              <X className="h-3 w-3" />
              Clear sort
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="border-t my-2" />

        {/* Date Range Filter (only for date columns) */}
        {isDate && (
          <>
            <div className="space-y-1.5 px-1">
              <p className="text-xs font-medium text-muted-foreground">Date Range</p>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="h-6 w-full rounded border border-input bg-transparent px-1 text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="From"
                />
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="h-6 w-full rounded border border-input bg-transparent px-1 text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="To"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-full text-[11px]"
                onClick={handleApplyRange}
                disabled={!rangeFrom && !rangeTo}
              >
                Apply Range
              </Button>
            </div>
            <div className="border-t my-2" />
          </>
        )}

        {/* Filter Section */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-muted-foreground">Filter</p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[10px]"
                onClick={handleSelectAll}
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[10px]"
                onClick={handleClearFilter}
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {sortedUniqueValues.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-1 italic">
                No values
              </p>
            ) : (
              sortedUniqueValues.map((value) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-xs px-1 py-0.5 rounded-sm hover:bg-accent cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={activeFilter.has(value)}
                    onChange={() => handleToggleValue(value)}
                    className="h-3 w-3 rounded border-input"
                  />
                  <span className="truncate">{value || "(empty)"}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { ColumnHeaderMenu };
