"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { Plus, Copy, Trash2 } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { ColumnHeaderMenu, type ColumnSortState } from "./column-header-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DropdownOption {
  id: string;
  value: string;
}

export type ColumnType = "readonly" | "dropdown" | "text" | "numeric" | "custom";

export interface ColumnDef<TRow> {
  /** Unique key for this column */
  key: string;
  /** Column header label */
  label: string;
  /** Column type determines rendering behavior */
  type: ColumnType;

  // ─── Data Access ──────────────────────────────────────────────────────
  /** Get raw value from row (used for inputs, dropdowns) */
  getValue: (row: TRow) => string;
  /** Get display value for sort/filter (e.g. resolve UUID → label). Defaults to getValue. */
  getDisplayValue?: (row: TRow) => string;

  // ─── Dropdown Config ──────────────────────────────────────────────────
  /** Options for dropdown type */
  options?: DropdownOption[];
  /** Whether this column can be collapsed (dropdown columns) */
  collapsible?: boolean;

  // ─── Input Config ─────────────────────────────────────────────────────
  /** Placeholder text for input */
  placeholder?: string;
  /** Tailwind width class (e.g. "w-[4.5rem]") */
  width?: string;

  // ─── Custom Rendering ─────────────────────────────────────────────────
  /** Custom cell renderer. Receives row, render index, original index, and change handler. */
  renderCell?: (
    row: TRow,
    renderIndex: number,
    originalIndex: number,
    onChange: (value: string) => void,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void
  ) => React.ReactNode;

  // ─── Sort/Filter ──────────────────────────────────────────────────────
  /** Whether this column has sort/filter menu (default: true for all except "custom" without getDisplayValue) */
  filterable?: boolean;
  /** Whether to use numeric sort labels */
  isNumeric?: boolean;

  // ─── Totals ───────────────────────────────────────────────────────────
  /** "count" shows row count, "sum" sums numeric values */
  totalType?: "count" | "sum";
  /** Format the total value for display */
  formatTotal?: (value: number) => string;

  // ─── Keyboard Navigation ──────────────────────────────────────────────
  /** Whether this column participates in keyboard navigation (default: true for text/numeric) */
  navigable?: boolean;
}

export interface DataEntryTableProps<TRow> {
  /** Column definitions */
  columns: ColumnDef<TRow>[];
  /** Current rows */
  rows: TRow[];
  /** Callback when rows change */
  onRowsChange: (rows: TRow[]) => void;

  // ─── Row Identity ─────────────────────────────────────────────────────
  /** Get unique key for a row (for React keys) */
  getRowKey: (row: TRow) => string;

  // ─── Row Operations ───────────────────────────────────────────────────
  /** Create a new empty row at given index */
  createRow: (index: number) => TRow;
  /** Create a copy of a row for the given new index */
  copyRow: (source: TRow, newIndex: number) => TRow;
  /** Called after any reordering to renumber rows. Receives all rows, returns updated rows. */
  renumberRows?: (rows: TRow[]) => TRow[];
  /** Called when a cell value changes. Receives row, column key, new value. Returns updated row. */
  onCellChange?: (row: TRow, columnKey: string, value: string) => TRow;

  // ─── UI Config ────────────────────────────────────────────────────────
  /** Title shown above the table */
  title?: string;
  /** Add row button label (default: "Add Row") */
  addRowLabel?: string;
  /** LocalStorage key for persisting collapsed columns state */
  collapseStorageKey?: string;
  /** ID prefix for input elements (default: "det") */
  idPrefix?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOptionLabel(options: DropdownOption[], id: string): string {
  if (!id) return "";
  return options.find((o) => o.id === id)?.value ?? "";
}

// ─── Component ────────────────────────────────────────────────────────────────

function DataEntryTable<TRow>({
  columns,
  rows,
  onRowsChange,
  getRowKey,
  createRow,
  copyRow,
  renumberRows,
  onCellChange,
  title = "Data",
  addRowLabel = "Add Row",
  collapseStorageKey = "det-collapsed-columns",
  idPrefix = "det",
}: DataEntryTableProps<TRow>) {
  // ─── Collapsed Columns ──────────────────────────────────────────────────
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(collapseStorageKey);
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch {}
    return new Set();
  });

  useEffect(() => {
    try {
      localStorage.setItem(collapseStorageKey, JSON.stringify([...collapsedColumns]));
    } catch {}
  }, [collapsedColumns, collapseStorageKey]);

  const toggleColumn = useCallback((key: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ─── Sort & Filter ──────────────────────────────────────────────────────
  const [sortState, setSortState] = useState<ColumnSortState | null>(null);
  const [filterState, setFilterState] = useState<Record<string, Set<string>>>({});

  /** Get display value for a column, resolving dropdowns */
  const getColDisplayValue = useCallback(
    (row: TRow, col: ColumnDef<TRow>): string => {
      if (col.getDisplayValue) return col.getDisplayValue(row);
      if (col.type === "dropdown" && col.options) {
        return getOptionLabel(col.options, col.getValue(row));
      }
      return col.getValue(row);
    },
    []
  );

  /** Filterable columns */
  const filterableColumns = useMemo(
    () => columns.filter((col) => col.filterable !== false && col.type !== "custom"),
    [columns]
  );

  /** Compute unique display values per column */
  const uniqueValuesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of filterableColumns) {
      const valSet = new Set<string>();
      for (const row of rows) {
        const val = getColDisplayValue(row, col);
        if (val) valSet.add(val);
      }
      map[col.key] = [...valSet];
    }
    return map;
  }, [rows, filterableColumns, getColDisplayValue]);

  /** Display rows: filtered subset with original index */
  const displayRows = useMemo(() => {
    return rows
      .map((row, idx) => ({ row, originalIndex: idx }))
      .filter(({ row }) => {
        for (const [colKey, allowedValues] of Object.entries(filterState)) {
          if (allowedValues.size === 0) continue;
          const col = columns.find((c) => c.key === colKey);
          if (!col) continue;
          const displayVal = getColDisplayValue(row, col);
          if (!allowedValues.has(displayVal)) return false;
        }
        return true;
      });
  }, [rows, filterState, columns, getColDisplayValue]);

  /** Totals */
  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    for (const col of columns) {
      if (!col.totalType) continue;
      if (col.totalType === "count") {
        result[col.key] = displayRows.length;
      } else if (col.totalType === "sum") {
        let sum = 0;
        for (const { row } of displayRows) {
          const val = parseFloat(col.getValue(row));
          if (!isNaN(val)) sum += val;
        }
        result[col.key] = sum;
      }
    }
    return result;
  }, [displayRows, columns]);

  /** Apply sort */
  const handleSortChange = useCallback(
    (sort: ColumnSortState | null) => {
      setSortState(sort);
      if (!sort) return;

      const col = columns.find((c) => c.key === sort.column);
      if (!col) return;

      const sorted = [...rows].sort((a, b) => {
        const aVal = getColDisplayValue(a, col);
        const bVal = getColDisplayValue(b, col);

        if (col.isNumeric || col.type === "numeric") {
          const aNum = parseFloat(aVal);
          const bNum = parseFloat(bVal);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return sort.direction === "asc" ? aNum - bNum : bNum - aNum;
          }
        }

        const cmp = aVal.localeCompare(bVal);
        return sort.direction === "asc" ? cmp : -cmp;
      });

      const result = renumberRows ? renumberRows(sorted) : sorted;
      onRowsChange(result);
    },
    [rows, columns, onRowsChange, renumberRows, getColDisplayValue]
  );

  const handleFilterChange = useCallback(
    (columnKey: string, values: Set<string>) => {
      setFilterState((prev) => ({ ...prev, [columnKey]: values }));
    },
    []
  );

  // ─── Row Operations ─────────────────────────────────────────────────────
  const updateCell = useCallback(
    (originalIndex: number, columnKey: string, value: string) => {
      const newRows = [...rows];
      const row = newRows[originalIndex]!;
      if (onCellChange) {
        newRows[originalIndex] = onCellChange(row, columnKey, value);
      } else {
        // Default: set the field directly
        newRows[originalIndex] = { ...row, [columnKey]: value } as TRow;
      }
      onRowsChange(newRows);
    },
    [rows, onRowsChange, onCellChange]
  );

  const handleAddRow = useCallback(() => {
    setFilterState({});
    const newRow = createRow(rows.length);
    onRowsChange([...rows, newRow]);
  }, [rows, onRowsChange, createRow]);

  const handleCopyRow = useCallback(
    (originalIndex: number) => {
      const source = rows[originalIndex]!;
      const newRow = copyRow(source, originalIndex + 1);
      const newRows = [...rows];
      newRows.splice(originalIndex + 1, 0, newRow);
      const result = renumberRows ? renumberRows(newRows) : newRows;
      onRowsChange(result);
    },
    [rows, onRowsChange, copyRow, renumberRows]
  );

  const handleRemoveRow = useCallback(
    (originalIndex: number) => {
      if (rows.length <= 1) return;
      const newRows = rows.filter((_, i) => i !== originalIndex);
      const result = renumberRows ? renumberRows(newRows) : newRows;
      onRowsChange(result);
    },
    [rows, onRowsChange, renumberRows]
  );

  // ─── Keyboard Navigation ────────────────────────────────────────────────
  const navigableColumns = useMemo(
    () =>
      columns.filter(
        (col) =>
          col.navigable === true ||
          (col.navigable === undefined && (col.type === "text" || col.type === "numeric"))
      ),
    [columns]
  );

  const navFieldOrder = useMemo(() => navigableColumns.map((c) => c.key), [navigableColumns]);

  const focusField = useCallback(
    (rowIndex: number, field: string) => {
      const el = document.getElementById(`${idPrefix}-${rowIndex}-${field}`);
      if (el) {
        el.focus();
        return true;
      }
      return false;
    },
    [idPrefix]
  );

  const focusNextField = useCallback(
    (rowIndex: number, currentField: string, totalRows: number) => {
      const currentIdx = navFieldOrder.indexOf(currentField);
      if (currentIdx === -1) return;

      let nextRow = rowIndex;
      let nextFieldIdx = currentIdx + 1;

      if (nextFieldIdx >= navFieldOrder.length) {
        nextFieldIdx = 0;
        nextRow = rowIndex + 1;
      }

      if (nextRow >= totalRows) {
        (document.activeElement as HTMLElement)?.blur();
        return;
      }

      const nextField = navFieldOrder[nextFieldIdx]!;
      if (!focusField(nextRow, nextField)) {
        // Field doesn't exist (e.g. computed), try next
        if (nextFieldIdx + 1 < navFieldOrder.length) {
          focusField(nextRow, navFieldOrder[nextFieldIdx + 1]!);
        } else if (nextRow + 1 < totalRows) {
          focusField(nextRow + 1, navFieldOrder[0]!);
        } else {
          (document.activeElement as HTMLElement)?.blur();
        }
      }
    },
    [navFieldOrder, focusField]
  );

  const focusPrevField = useCallback(
    (rowIndex: number, currentField: string) => {
      const currentIdx = navFieldOrder.indexOf(currentField);
      if (currentIdx === -1) return;

      let prevRow = rowIndex;
      let prevFieldIdx = currentIdx - 1;

      if (prevFieldIdx < 0) {
        prevFieldIdx = navFieldOrder.length - 1;
        prevRow = rowIndex - 1;
      }

      if (prevRow < 0) return;

      const prevField = navFieldOrder[prevFieldIdx]!;
      if (!focusField(prevRow, prevField)) {
        // Try previous field
        if (prevFieldIdx - 1 >= 0) {
          focusField(prevRow, navFieldOrder[prevFieldIdx - 1]!);
        }
      }
    },
    [navFieldOrder, focusField]
  );

  const handleFieldKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
      renderIndex: number,
      field: string,
      totalRows: number
    ) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const isLastNav = navFieldOrder.indexOf(field) === navFieldOrder.length - 1;
        if (isLastNav && renderIndex === totalRows - 1) {
          (e.currentTarget as HTMLElement).blur();
        } else {
          focusNextField(renderIndex, field, totalRows);
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        focusField(renderIndex - 1, field);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusField(renderIndex + 1, field);
        return;
      }

      const input = e.currentTarget as HTMLInputElement;
      if (!input.value && input.value !== "") return;
      const len = input.value.length;

      if (e.key === "ArrowRight" && input.selectionStart === len && input.selectionEnd === len) {
        e.preventDefault();
        focusNextField(renderIndex, field, totalRows);
      } else if (e.key === "ArrowLeft" && input.selectionStart === 0 && input.selectionEnd === 0) {
        e.preventDefault();
        focusPrevField(renderIndex, field);
      }
    },
    [navFieldOrder, focusNextField, focusPrevField, focusField]
  );

  // ─── Rendering Helpers ──────────────────────────────────────────────────
  const renderDropdown = (
    col: ColumnDef<TRow>,
    originalIndex: number,
    currentValue: string
  ) => (
    <select
      value={currentValue}
      onChange={(e) => updateCell(originalIndex, col.key, e.target.value)}
      className="h-7 text-xs rounded-md border border-input bg-transparent px-1 py-0.5 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <option value="">-</option>
      {(col.options ?? []).map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.value}
        </option>
      ))}
    </select>
  );

  const renderCollapsedCell = (col: ColumnDef<TRow>, currentValue: string) => {
    const label = getOptionLabel(col.options ?? [], currentValue);
    const abbrev = label ? label.slice(0, 3) : "-";
    const tooltip = label ? `${col.label}: ${label}` : `${col.label}: (empty)`;
    return (
      <span
        className="inline-flex items-center justify-center h-7 w-full text-xs text-muted-foreground cursor-default"
        title={tooltip}
      >
        {abbrev}
      </span>
    );
  };

  const renderInput = (
    col: ColumnDef<TRow>,
    row: TRow,
    renderIndex: number,
    originalIndex: number
  ) => (
    <Input
      id={`${idPrefix}-${renderIndex}-${col.key}`}
      className={`h-7 text-xs px-1 ${col.width ?? "w-[4.5rem]"}`}
      placeholder={col.placeholder}
      value={col.getValue(row)}
      onChange={(e) => updateCell(originalIndex, col.key, e.target.value)}
      onKeyDown={(e) =>
        handleFieldKeyDown(e, renderIndex, col.key, displayRows.length)
      }
    />
  );

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button onClick={handleAddRow} variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          {addRowLabel}
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table className="w-auto">
          <TableHeader>
            <TableRow>
              {columns.map((col) => {
                const isCollapsed = col.collapsible && collapsedColumns.has(col.key);
                const showFilter =
                  col.filterable !== false && col.type !== "custom";

                if (col.collapsible) {
                  return (
                    <TableHead
                      key={col.key}
                      className={`px-1 text-xs cursor-pointer select-none hover:bg-accent/50 transition-colors whitespace-nowrap ${isCollapsed ? "w-[30px]" : ""}`}
                      onClick={() => toggleColumn(col.key)}
                      title={isCollapsed ? `Expand ${col.label}` : `Collapse ${col.label}`}
                    >
                      <span className="flex items-center gap-0.5">
                        <span className="text-muted-foreground text-[10px]">
                          {isCollapsed ? "›" : "‹"}
                        </span>
                        {isCollapsed ? col.label.slice(0, 3) : col.label}
                        {!isCollapsed && showFilter && (
                          <ColumnHeaderMenu
                            columnKey={col.key}
                            isNumeric={col.isNumeric}
                            uniqueValues={uniqueValuesMap[col.key] ?? []}
                            activeSort={sortState}
                            activeFilter={filterState[col.key] ?? new Set()}
                            onSortChange={handleSortChange}
                            onFilterChange={handleFilterChange}
                          />
                        )}
                      </span>
                    </TableHead>
                  );
                }

                return (
                  <TableHead key={col.key} className="px-1 text-xs whitespace-nowrap">
                    {showFilter ? (
                      <span className="flex items-center gap-0.5">
                        {col.label}
                        <ColumnHeaderMenu
                          columnKey={col.key}
                          isNumeric={col.isNumeric || col.type === "numeric"}
                          uniqueValues={uniqueValuesMap[col.key] ?? []}
                          activeSort={sortState}
                          activeFilter={filterState[col.key] ?? new Set()}
                          onSortChange={handleSortChange}
                          onFilterChange={handleFilterChange}
                        />
                      </span>
                    ) : (
                      col.label
                    )}
                  </TableHead>
                );
              })}
              {/* Actions column */}
              <TableHead className="px-1 text-xs" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {displayRows.map(({ row, originalIndex }, renderIndex) => (
              <TableRow key={getRowKey(row)}>
                {columns.map((col) => {
                  const isCollapsed = col.collapsible && collapsedColumns.has(col.key);
                  const currentValue = col.getValue(row);

                  if (col.type === "custom" && col.renderCell) {
                    return (
                      <TableCell key={col.key} className="px-1">
                        {col.renderCell(
                          row,
                          renderIndex,
                          originalIndex,
                          (value) => updateCell(originalIndex, col.key, value),
                          (e) => handleFieldKeyDown(e, renderIndex, col.key, displayRows.length)
                        )}
                      </TableCell>
                    );
                  }

                  if (col.type === "readonly") {
                    return (
                      <TableCell
                        key={col.key}
                        className="px-1 font-mono text-xs text-muted-foreground whitespace-nowrap"
                      >
                        {currentValue || "—"}
                      </TableCell>
                    );
                  }

                  if (col.type === "dropdown") {
                    return (
                      <TableCell
                        key={col.key}
                        className={`px-1 ${isCollapsed ? "w-[30px]" : ""}`}
                      >
                        {isCollapsed
                          ? renderCollapsedCell(col, currentValue)
                          : renderDropdown(col, originalIndex, currentValue)}
                      </TableCell>
                    );
                  }

                  // text or numeric
                  return (
                    <TableCell key={col.key} className="px-1">
                      {renderInput(col, row, renderIndex, originalIndex)}
                    </TableCell>
                  );
                })}

                {/* Actions */}
                <TableCell className="px-1">
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleCopyRow(originalIndex)}
                      aria-label="Copy row"
                      title="Copy row"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveRow(originalIndex)}
                      disabled={rows.length <= 1}
                      aria-label="Remove row"
                      title="Remove row"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          {/* Totals Footer */}
          {columns.some((col) => col.totalType) && (
            <TableFooter>
              <TableRow>
                {columns.map((col) => {
                  if (!col.totalType) {
                    return <TableCell key={col.key} className="px-1" />;
                  }
                  const value = totals[col.key] ?? 0;
                  const display =
                    value === 0
                      ? ""
                      : col.formatTotal
                        ? col.formatTotal(value)
                        : String(value);
                  return (
                    <TableCell
                      key={col.key}
                      className="px-1 font-mono text-xs font-semibold whitespace-nowrap"
                    >
                      {display}
                    </TableCell>
                  );
                })}
                <TableCell className="px-1" />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}

export { DataEntryTable };
