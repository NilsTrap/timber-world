"use client";

import { useMemo, useState, useCallback, useTransition, useEffect, forwardRef, useImperativeHandle } from "react";
import { Trash2, MessageSquare } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  ColumnHeaderMenu,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type ColumnSortState,
} from "@timber/ui";
import { toast } from "sonner";
import type { ProductionInput } from "../types";
import { updateProductionInput, removeProductionInput } from "../actions";

export interface ProductionInputsTableHandle {
  clearFilters: () => void;
}

interface ProductionInputsTableProps {
  inputs: ProductionInput[];
  onInputsChanged: () => void;
  onFilterActiveChange?: (active: boolean) => void;
  readOnly?: boolean;
}

interface ColConfig {
  key: string;
  label: string;
  collapsible?: boolean;
  isNumeric?: boolean;
  getValue: (row: ProductionInput) => string;
  width?: string;
}

const COLLAPSE_STORAGE_KEY = "production-inputs-collapsed";

function calculateVolume(
  thickness: string | null,
  width: string | null,
  length: string | null,
  pieces: number
): number | null {
  if (!thickness || !width || !length || pieces <= 0) return null;
  // Normalize comma decimal separators to dots for parsing
  const t = parseFloat(thickness.replace(",", "."));
  const w = parseFloat(width.replace(",", "."));
  const l = parseFloat(length.replace(",", "."));
  if (isNaN(t) || isNaN(w) || isNaN(l)) return null;
  // Check for ranges (e.g. "40-50")
  if (thickness.includes("-") || width.includes("-") || length.includes("-")) return null;
  return (t * w * l * pieces) / 1_000_000_000;
}

export const ProductionInputsTable = forwardRef<ProductionInputsTableHandle, ProductionInputsTableProps>(function ProductionInputsTable({
  inputs,
  onInputsChanged,
  onFilterActiveChange,
  readOnly,
}, ref) {
  const [isPending, startTransition] = useTransition();
  const [editingCell, setEditingCell] = useState<{ id: string; field: "pieces" | "volume" } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [sortState, setSortState] = useState<ColumnSortState | null>(null);
  const [filterState, setFilterState] = useState<Record<string, Set<string>>>({});

  // Load collapsed columns from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (stored) setCollapsedColumns(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, []);

  const columns: ColConfig[] = useMemo(
    () => [
      { key: "shipmentCode", label: "Shipment", getValue: (r) => r.shipmentCode },
      { key: "packageNumber", label: "Package", getValue: (r) => r.packageNumber },
      { key: "productName", label: "Product", collapsible: true, getValue: (r) => r.productName ?? "" },
      { key: "woodSpecies", label: "Species", collapsible: true, getValue: (r) => r.woodSpecies ?? "" },
      { key: "humidity", label: "Humidity", collapsible: true, getValue: (r) => r.humidity ?? "" },
      { key: "typeName", label: "Type", collapsible: true, getValue: (r) => r.typeName ?? "" },
      { key: "processing", label: "Processing", collapsible: true, getValue: (r) => r.processing ?? "" },
      { key: "fsc", label: "FSC", collapsible: true, getValue: (r) => r.fsc ?? "" },
      { key: "quality", label: "Quality", collapsible: true, getValue: (r) => r.quality ?? "" },
      { key: "thickness", label: "Thickness", isNumeric: true, getValue: (r) => r.thickness ?? "", width: "w-[4.5rem]" },
      { key: "width", label: "Width", isNumeric: true, getValue: (r) => r.width ?? "", width: "w-[4.5rem]" },
      { key: "length", label: "Length", isNumeric: true, getValue: (r) => r.length ?? "", width: "w-[4.5rem]" },
    ],
    []
  );

  const toggleColumn = useCallback((key: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleSortChange = useCallback((sort: ColumnSortState | null) => {
    setSortState(sort);
  }, []);

  const handleFilterChange = useCallback((columnKey: string, values: Set<string>) => {
    setFilterState((prev) => ({ ...prev, [columnKey]: values }));
  }, []);

  // Apply filters and sort
  const displayRows = useMemo(() => {
    let rows = [...inputs];

    // Filter
    for (const [colKey, filterValues] of Object.entries(filterState)) {
      if (filterValues.size === 0) continue;
      const col = columns.find((c) => c.key === colKey);
      if (!col) {
        // Check pieces/volume
        if (colKey === "piecesUsed") {
          rows = rows.filter((r) => filterValues.has(r.piecesUsed != null ? String(r.piecesUsed) : "-"));
        } else if (colKey === "volumeM3") {
          rows = rows.filter((r) => filterValues.has(r.volumeM3.toFixed(3).replace(".", ",")));
        }
        continue;
      }
      rows = rows.filter((r) => filterValues.has(col.getValue(r)));
    }

    // Sort
    if (sortState) {
      const { column, direction } = sortState;
      rows.sort((a, b) => {
        let valA: string;
        let valB: string;
        const col = columns.find((c) => c.key === column);
        if (col) {
          valA = col.getValue(a);
          valB = col.getValue(b);
        } else if (column === "piecesUsed") {
          valA = a.piecesUsed != null ? String(a.piecesUsed) : "";
          valB = b.piecesUsed != null ? String(b.piecesUsed) : "";
        } else if (column === "volumeM3") {
          valA = String(a.volumeM3);
          valB = String(b.volumeM3);
        } else {
          return 0;
        }
        const cmp = valA.localeCompare(valB, undefined, { numeric: true });
        return direction === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [inputs, filterState, sortState, columns]);

  // Unique values for filter menus
  const getUniqueValues = useCallback(
    (key: string): string[] => {
      const col = columns.find((c) => c.key === key);
      if (col) {
        return [...new Set(inputs.map((r) => col.getValue(r)))].filter(Boolean);
      }
      if (key === "piecesUsed") {
        return [...new Set(inputs.map((r) => r.piecesUsed != null ? String(r.piecesUsed) : "-"))];
      }
      if (key === "volumeM3") {
        return [...new Set(inputs.map((r) => r.volumeM3.toFixed(3).replace(".", ",")))];
      }
      return [];
    },
    [inputs, columns]
  );

  const handleStartEdit = useCallback((id: string, field: "pieces" | "volume", currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  }, []);

  const handleBlurEdit = useCallback(() => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const input = inputs.find((i) => i.id === id);
    if (!input) {
      setEditingCell(null);
      return;
    }

    const numValue = parseFloat(editValue.replace(",", "."));
    if (isNaN(numValue) || numValue <= 0) {
      toast.error("Value must be a positive number");
      setEditingCell(null);
      return;
    }

    let newPiecesUsed: number | null;
    let newVolumeM3: number;

    if (field === "pieces") {
      const intPieces = Math.round(numValue);
      // Validate against available
      if (input.availablePieces) {
        const available = parseInt(input.availablePieces, 10);
        if (!isNaN(available) && intPieces > available) {
          toast.error("Pieces exceeds available inventory");
          setEditingCell(null);
          return;
        }
      }
      newPiecesUsed = intPieces;
      // Auto-calculate volume if dimensions are single numbers
      const calcVolume = calculateVolume(input.thickness, input.width, input.length, intPieces);
      newVolumeM3 = calcVolume ?? input.volumeM3;
    } else {
      // volume field
      if (input.totalVolumeM3 != null && numValue > input.totalVolumeM3) {
        toast.error("Volume exceeds available inventory");
        setEditingCell(null);
        return;
      }
      newPiecesUsed = input.piecesUsed;
      newVolumeM3 = numValue;
    }

    startTransition(async () => {
      const result = await updateProductionInput({
        inputId: id,
        piecesUsed: newPiecesUsed,
        volumeM3: newVolumeM3,
      });
      if (!result.success) {
        toast.error(result.error);
      } else {
        onInputsChanged();
      }
      setEditingCell(null);
    });
  }, [editingCell, editValue, inputs, onInputsChanged]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  }, []);

  const handleDelete = useCallback(
    (inputId: string) => {
      startTransition(async () => {
        const result = await removeProductionInput(inputId);
        if (!result.success) {
          toast.error(result.error);
        } else {
          onInputsChanged();
        }
      });
    },
    [onInputsChanged]
  );

  // Totals
  const totals = useMemo(() => {
    const count = displayRows.length;
    const pieces = displayRows.reduce((sum, r) => sum + (r.piecesUsed ?? 0), 0);
    const volume = displayRows.reduce((sum, r) => sum + r.volumeM3, 0);
    return { count, pieces, volume };
  }, [displayRows]);

  const hasActiveFilters = Object.values(filterState).some((s) => s.size > 0) || sortState !== null;

  const handleClearAll = useCallback(() => {
    setFilterState({});
    setSortState(null);
  }, []);

  useImperativeHandle(ref, () => ({
    clearFilters: handleClearAll,
  }), [handleClearAll]);

  useEffect(() => {
    onFilterActiveChange?.(hasActiveFilters);
  }, [hasActiveFilters, onFilterActiveChange]);

  return (
    <div>
      <div className="rounded-lg border overflow-x-auto w-fit max-w-full">
        <Table className="w-auto">
          <TableHeader>
            <TableRow>
              {columns.map((col) => {
                const isCollapsed = col.collapsible && collapsedColumns.has(col.key);
                return (
                  <TableHead
                    key={col.key}
                    className={`px-1 text-xs whitespace-nowrap ${col.collapsible ? "cursor-pointer select-none hover:bg-accent/50 transition-colors" : ""} ${isCollapsed ? "w-[30px]" : ""}`}
                    onClick={col.collapsible ? () => toggleColumn(col.key) : undefined}
                    title={col.collapsible ? (isCollapsed ? `Expand ${col.label}` : `Collapse ${col.label}`) : undefined}
                  >
                    <span className="flex items-center gap-0.5">
                      {col.collapsible && (
                        <span className="text-muted-foreground text-[10px]">
                          {isCollapsed ? "›" : "‹"}
                        </span>
                      )}
                      {isCollapsed ? col.label.slice(0, 3) : col.label}
                      <ColumnHeaderMenu
                        columnKey={col.key}
                        isNumeric={col.isNumeric}
                        uniqueValues={getUniqueValues(col.key)}
                        activeSort={sortState}
                        activeFilter={filterState[col.key] ?? new Set()}
                        onSortChange={handleSortChange}
                        onFilterChange={handleFilterChange}
                      />
                    </span>
                  </TableHead>
                );
              })}
              {/* Pieces header */}
              <TableHead className="px-1 text-xs whitespace-nowrap">
                <span className="flex items-center gap-0.5">
                  Pieces
                  <ColumnHeaderMenu
                    columnKey="piecesUsed"
                    isNumeric
                    uniqueValues={getUniqueValues("piecesUsed")}
                    activeSort={sortState}
                    activeFilter={filterState["piecesUsed"] ?? new Set()}
                    onSortChange={handleSortChange}
                    onFilterChange={handleFilterChange}
                  />
                </span>
              </TableHead>
              {/* Volume header */}
              <TableHead className="px-1 text-xs whitespace-nowrap">
                <span className="flex items-center gap-0.5">
                  Vol m³
                  <ColumnHeaderMenu
                    columnKey="volumeM3"
                    isNumeric
                    uniqueValues={getUniqueValues("volumeM3")}
                    activeSort={sortState}
                    activeFilter={filterState["volumeM3"] ?? new Set()}
                    onSortChange={handleSortChange}
                    onFilterChange={handleFilterChange}
                  />
                </span>
              </TableHead>
              {/* Delete header */}
              {!readOnly && <TableHead className="px-1 w-[40px]" />}
            </TableRow>
          </TableHeader>

          <TableBody>
            {displayRows.map((row) => {
              const hasPieces = row.availablePieces != null && row.availablePieces !== "-" && row.availablePieces !== "";
              const volumeIsCalculated = !!hasPieces &&
                !!row.thickness && !row.thickness.includes("-") &&
                !!row.width && !row.width.includes("-") &&
                !!row.length && !row.length.includes("-");
              const isEditingPieces = editingCell?.id === row.id && editingCell?.field === "pieces";
              const isEditingVolume = editingCell?.id === row.id && editingCell?.field === "volume";

              return (
                <TableRow key={row.id}>
                  {columns.map((col) => {
                    const isCollapsed = col.collapsible && collapsedColumns.has(col.key);
                    const value = col.getValue(row);

                    if (isCollapsed) {
                      const abbrev = value ? value.slice(0, 3) : "-";
                      return (
                        <TableCell
                          key={col.key}
                          className="px-1 text-xs whitespace-nowrap w-[30px] text-muted-foreground"
                          title={value ? `${col.label}: ${value}` : `${col.label}: (empty)`}
                        >
                          {abbrev}
                        </TableCell>
                      );
                    }

                    // Special rendering for packageNumber to show notes icon
                    if (col.key === "packageNumber" && row.notes) {
                      return (
                        <TableCell key={col.key} className="px-1 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span>{value || "-"}</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <MessageSquare className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <p className="whitespace-pre-wrap text-sm">{row.notes}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      );
                    }

                    return (
                      <TableCell key={col.key} className="px-1 text-xs whitespace-nowrap">
                        {value || "-"}
                      </TableCell>
                    );
                  })}

                  {/* Pieces cell */}
                  <TableCell className="px-1">
                    {hasPieces ? (
                      readOnly ? (
                        <span className="text-xs px-1">{row.piecesUsed != null ? row.piecesUsed : "-"}</span>
                      ) : isEditingPieces ? (
                        <Input
                          className="h-7 text-xs px-1 w-[4.5rem]"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleBlurEdit}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          disabled={isPending}
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-xs px-1 py-0.5 w-[4.5rem] text-left rounded hover:bg-accent/50 cursor-text"
                          onClick={() => handleStartEdit(row.id, "pieces", row.piecesUsed != null ? String(row.piecesUsed) : "")}
                        >
                          {row.piecesUsed != null ? row.piecesUsed : "-"}
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground px-1">-</span>
                    )}
                  </TableCell>

                  {/* Volume cell */}
                  <TableCell className="px-1">
                    {readOnly || volumeIsCalculated ? (
                      <span className="text-xs px-1 py-0.5 w-[5rem] inline-block">
                        {row.volumeM3.toFixed(3).replace(".", ",")}
                      </span>
                    ) : isEditingVolume ? (
                      <Input
                        className="h-7 text-xs px-1 w-[5rem]"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleBlurEdit}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        disabled={isPending}
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-xs px-1 py-0.5 w-[5rem] text-left rounded hover:bg-accent/50 cursor-text"
                        onClick={() => handleStartEdit(row.id, "volume", row.volumeM3.toFixed(3).replace(".", ","))}
                      >
                        {row.volumeM3.toFixed(3).replace(".", ",")}
                      </button>
                    )}
                  </TableCell>

                  {/* Delete button */}
                  {!readOnly && (
                    <TableCell className="px-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(row.id)}
                        disabled={isPending}
                        aria-label="Remove input"
                        title="Remove input"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>

          {/* Totals Footer */}
          {inputs.length > 0 && (
            <TableFooter>
              <TableRow>
                {/* Shipment */}
                <TableCell className="px-1" />
                {/* Package count */}
                <TableCell className="px-1 font-mono text-xs font-semibold">{totals.count}</TableCell>
                {/* 7 collapsible + 3 dimension columns */}
                {columns.slice(2).map((col) => (
                  <TableCell key={col.key} className="px-1" />
                ))}
                {/* Pieces sum */}
                <TableCell className="px-1 font-mono text-xs font-semibold">
                  {totals.pieces > 0 ? totals.pieces : ""}
                </TableCell>
                {/* Volume sum */}
                <TableCell className="px-1 font-mono text-xs font-semibold">
                  {totals.volume > 0 ? totals.volume.toFixed(3).replace(".", ",") : ""}
                </TableCell>
                {/* Delete column */}
                {!readOnly && <TableCell className="px-1" />}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
});
