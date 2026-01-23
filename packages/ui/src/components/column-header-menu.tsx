"use client";

import { useMemo } from "react";
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

  const sortedUniqueValues = useMemo(
    () => [...uniqueValues].sort((a, b) => a.localeCompare(b)),
    [uniqueValues]
  );

  const ascLabel = isNumeric ? "Small → Large" : "A → Z";
  const descLabel = isNumeric ? "Large → Small" : "Z → A";

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
  };

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
