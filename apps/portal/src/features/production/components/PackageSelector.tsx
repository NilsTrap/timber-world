"use client";

import { useMemo, useState, useCallback, useTransition, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  ColumnHeaderMenu,
  type ColumnSortState,
} from "@timber/ui";
import { toast } from "sonner";
import type { PackageListItem } from "@/features/shipments/types";
import { addProductionInput } from "../actions";

interface PackageSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productionEntryId: string;
  packages: PackageListItem[];
  onInputAdded: () => void;
}

interface SelectedPackage {
  packageId: string;
  piecesUsed: string;
  volumeM3: string;
}

interface ColConfig {
  key: string;
  label: string;
  collapsible?: boolean;
  isNumeric?: boolean;
  getValue: (row: PackageListItem) => string;
}

const COLLAPSE_STORAGE_KEY = "production-input-selector-collapsed";

// --- Volume formatting helpers (same as PackageEntryTable) ---

function normalizeDecimalInput(value: string): string {
  return value.replace(",", ".");
}

function formatVolumeInput(value: string): string {
  if (!value) return "";
  return value.replace(".", ",");
}

function normalizeVolumePrecision(value: string): string {
  if (!value) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toFixed(3);
}

/** Check if a dimension string is a single number (not a range like "20-25") */
function isSingleNumber(dim: string | null): boolean {
  if (!dim) return false;
  return /^\d+([.,]\d+)?$/.test(dim.trim());
}

/** Calculate volume from dimensions × pieces (returns formatted string with comma, or null if not calculable) */
function calculateVolume(pkg: PackageListItem, piecesUsed: number): string | null {
  if (!isSingleNumber(pkg.thickness) || !isSingleNumber(pkg.width) || !isSingleNumber(pkg.length)) {
    return null;
  }
  const t = parseFloat(pkg.thickness!.replace(",", "."));
  const w = parseFloat(pkg.width!.replace(",", "."));
  const l = parseFloat(pkg.length!.replace(",", "."));
  if (isNaN(t) || isNaN(w) || isNaN(l)) return null;
  const vol = (t * w * l * piecesUsed) / 1_000_000_000;
  return vol.toFixed(3).replace(".", ",");
}

/**
 * Package Selector Dialog (Multi-Select)
 *
 * Large near-full-screen dialog showing available packages in a 14-column table.
 * Users can check multiple rows, enter pieces/volume for each, then confirm all at once.
 */
export function PackageSelector({
  open,
  onOpenChange,
  productionEntryId,
  packages,
  onInputAdded,
}: PackageSelectorProps) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Map<string, SelectedPackage>>(new Map());
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
      { key: "thickness", label: "Thick.", isNumeric: true, getValue: (r) => r.thickness ?? "" },
      { key: "width", label: "Width", isNumeric: true, getValue: (r) => r.width ?? "" },
      { key: "length", label: "Length", isNumeric: true, getValue: (r) => r.length ?? "" },
      { key: "pieces", label: "Pieces", isNumeric: true, getValue: (r) => r.pieces ?? "" },
      { key: "volumeM3", label: "Vol m³", isNumeric: true, getValue: (r) => r.volumeM3 != null ? r.volumeM3.toFixed(3).replace(".", ",") : "" },
    ],
    []
  );

  const toggleColumn = useCallback((key: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
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
    let rows = [...packages];
    for (const [colKey, filterValues] of Object.entries(filterState)) {
      if (filterValues.size === 0) continue;
      const col = columns.find((c) => c.key === colKey);
      if (col) {
        rows = rows.filter((r) => filterValues.has(col.getValue(r)));
      }
    }
    if (sortState) {
      const col = columns.find((c) => c.key === sortState.column);
      if (col) {
        rows.sort((a, b) => {
          const cmp = col.getValue(a).localeCompare(col.getValue(b), undefined, { numeric: true });
          return sortState.direction === "asc" ? cmp : -cmp;
        });
      }
    }
    return rows;
  }, [packages, filterState, sortState, columns]);

  const getUniqueValues = useCallback(
    (key: string): string[] => {
      const col = columns.find((c) => c.key === key);
      if (!col) return [];
      return [...new Set(packages.map((r) => col.getValue(r)))].filter(Boolean);
    },
    [packages, columns]
  );

  const handleToggleSelect = useCallback((pkg: PackageListItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(pkg.id)) {
        next.delete(pkg.id);
      } else {
        const pieces = pkg.pieces ? pkg.pieces : "";
        const volume = pkg.volumeM3 != null ? pkg.volumeM3.toFixed(3).replace(".", ",") : "";
        next.set(pkg.id, {
          packageId: pkg.id,
          piecesUsed: pieces,
          volumeM3: volume,
        });
      }
      return next;
    });
  }, []);

  const handleUpdateField = useCallback((packageId: string, field: "piecesUsed" | "volumeM3", value: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const item = next.get(packageId);
      if (!item) return prev;

      if (field === "piecesUsed") {
        const pkg = packages.find((p) => p.id === packageId);
        const piecesNum = parseInt(value, 10);
        let volumeM3 = item.volumeM3;
        if (pkg && !isNaN(piecesNum) && piecesNum > 0) {
          const calculated = calculateVolume(pkg, piecesNum);
          if (calculated !== null) {
            volumeM3 = calculated;
          }
        }
        next.set(packageId, { ...item, piecesUsed: value, volumeM3 });
      } else {
        next.set(packageId, { ...item, [field]: value });
      }
      return next;
    });
  }, [packages]);

  // --- Focus management for keyboard navigation ---

  const focusInput = useCallback((rowIndex: number, field: "piecesUsed" | "volumeM3") => {
    const el = document.getElementById(`pkg-sel-${rowIndex}-${field}`);
    if (el) (el as HTMLInputElement).focus();
  }, []);

  const getSelectedRowIndices = useCallback((): number[] => {
    const indices: number[] = [];
    for (let i = 0; i < displayRows.length; i++) {
      const row = displayRows[i];
      if (row && selected.has(row.id)) indices.push(i);
    }
    return indices;
  }, [displayRows, selected]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, field: "piecesUsed" | "volumeM3", hasPieces: boolean, volumeIsCalc: boolean) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (field === "piecesUsed" && !volumeIsCalc) {
          // Move to volume field in same row (only if volume is editable)
          focusInput(rowIndex, "volumeM3");
        } else {
          // Blur when on volume or when volume is auto-calculated
          (e.currentTarget as HTMLElement).blur();
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const indices = getSelectedRowIndices();
        const myPos = indices.indexOf(rowIndex);
        if (myPos > 0) {
          const targetRow = indices[myPos - 1]!;
          const targetPkg = displayRows[targetRow];
          if (!targetPkg) return;
          const targetHasPieces = targetPkg.pieces && targetPkg.pieces !== "-" && targetPkg.pieces !== "";
          const targetVolCalc = !!targetHasPieces && isSingleNumber(targetPkg.thickness) && isSingleNumber(targetPkg.width) && isSingleNumber(targetPkg.length);
          if (field === "volumeM3" && targetVolCalc) {
            focusInput(targetRow, "piecesUsed");
          } else if (field === "piecesUsed" && !targetHasPieces) {
            if (!targetVolCalc) focusInput(targetRow, "volumeM3");
          } else {
            focusInput(targetRow, field);
          }
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const indices = getSelectedRowIndices();
        const myPos = indices.indexOf(rowIndex);
        if (myPos < indices.length - 1) {
          const targetRow = indices[myPos + 1]!;
          const targetPkg = displayRows[targetRow];
          if (!targetPkg) return;
          const targetHasPieces = targetPkg.pieces && targetPkg.pieces !== "-" && targetPkg.pieces !== "";
          const targetVolCalc = !!targetHasPieces && isSingleNumber(targetPkg.thickness) && isSingleNumber(targetPkg.width) && isSingleNumber(targetPkg.length);
          if (field === "volumeM3" && targetVolCalc) {
            focusInput(targetRow, "piecesUsed");
          } else if (field === "piecesUsed" && !targetHasPieces) {
            if (!targetVolCalc) focusInput(targetRow, "volumeM3");
          } else {
            focusInput(targetRow, field);
          }
        }
        return;
      }

      const input = e.currentTarget as HTMLInputElement;
      const len = input.value.length;

      if (e.key === "ArrowRight" && input.selectionStart === len && input.selectionEnd === len) {
        if (field === "piecesUsed" && !volumeIsCalc) {
          e.preventDefault();
          focusInput(rowIndex, "volumeM3");
        }
        return;
      }

      if (e.key === "ArrowLeft" && input.selectionStart === 0 && input.selectionEnd === 0) {
        if (field === "volumeM3" && hasPieces) {
          e.preventDefault();
          focusInput(rowIndex, "piecesUsed");
        }
        return;
      }
    },
    [displayRows, focusInput, getSelectedRowIndices]
  );

  const handlePiecesBlur = useCallback((packageId: string, value: string) => {
    if (!value) return;
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) return;
    const available = parseInt(pkg.pieces ?? "", 10);
    if (!isNaN(available) && num > available) {
      toast.error(`Pieces cannot exceed available (${available})`);
      setSelected((prev) => {
        const next = new Map(prev);
        const item = next.get(packageId);
        if (item) {
          next.set(packageId, { ...item, piecesUsed: String(available) });
        }
        return next;
      });
    }
  }, [packages]);

  const handleVolumeBlur = useCallback((packageId: string, value: string) => {
    const raw = normalizeDecimalInput(value);
    if (!raw) return;
    const num = parseFloat(raw);
    if (isNaN(num) || num <= 0) return;
    const pkg = packages.find((p) => p.id === packageId);
    const maxVolume = pkg?.volumeM3;
    let capped = num;
    if (maxVolume != null && num > maxVolume) {
      toast.error(`Volume cannot exceed available (${maxVolume.toFixed(3).replace(".", ",")} m³)`);
      capped = maxVolume;
    }
    const formatted = normalizeVolumePrecision(String(capped));
    setSelected((prev) => {
      const next = new Map(prev);
      const item = next.get(packageId);
      if (item) {
        next.set(packageId, { ...item, volumeM3: formatVolumeInput(formatted) });
      }
      return next;
    });
  }, [packages]);

  const handleAddSelected = useCallback(() => {
    if (selected.size === 0) return;

    // Validate all selected entries
    for (const [pkgId, entry] of selected) {
      const pkg = packages.find((p) => p.id === pkgId);
      if (!pkg) continue;

      const volumeNum = parseFloat(entry.volumeM3.replace(",", "."));
      if (isNaN(volumeNum) || volumeNum <= 0) {
        toast.error(`Package ${pkg.packageNumber}: Volume must be a positive number`);
        return;
      }

      if (pkg.volumeM3 != null && volumeNum > pkg.volumeM3) {
        toast.error(`Package ${pkg.packageNumber}: Volume exceeds available inventory`);
        return;
      }

      const hasPieces = pkg.pieces && pkg.pieces !== "-" && pkg.pieces !== "";
      if (hasPieces) {
        const piecesNum = parseInt(entry.piecesUsed, 10);
        if (isNaN(piecesNum) || piecesNum <= 0) {
          toast.error(`Package ${pkg.packageNumber}: Pieces must be a positive number`);
          return;
        }
        const available = parseInt(pkg.pieces!, 10);
        if (!isNaN(available) && piecesNum > available) {
          toast.error(`Package ${pkg.packageNumber}: Pieces exceeds available inventory`);
          return;
        }
      }
    }

    startTransition(async () => {
      let successCount = 0;
      const errors: string[] = [];

      for (const [pkgId, entry] of selected) {
        const pkg = packages.find((p) => p.id === pkgId);
        if (!pkg) continue;

        const hasPieces = pkg.pieces && pkg.pieces !== "-" && pkg.pieces !== "";
        const piecesUsed = hasPieces ? parseInt(entry.piecesUsed, 10) : null;
        const volumeM3 = parseFloat(entry.volumeM3.replace(",", "."));

        const result = await addProductionInput({
          productionEntryId,
          packageId: pkgId,
          piecesUsed: piecesUsed && !isNaN(piecesUsed) ? piecesUsed : null,
          volumeM3,
        });

        if (result.success) {
          successCount++;
        } else {
          errors.push(`${pkg.packageNumber}: ${result.error}`);
        }
      }

      if (errors.length > 0) {
        for (const err of errors) {
          toast.error(err);
        }
        if (successCount > 0) {
          toast.success(`${successCount} package${successCount > 1 ? "s" : ""} added, ${errors.length} failed`);
        }
      } else {
        toast.success(`${successCount} package${successCount > 1 ? "s" : ""} added as input`);
      }

      if (successCount > 0) {
        onInputAdded();
      }
      setSelected(new Map());
      onOpenChange(false);
    });
  }, [selected, packages, productionEntryId, onInputAdded, onOpenChange]);

  // Reset selection when dialog closes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setSelected(new Map());
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  // Compute totals for selected packages
  const selectedTotals = useMemo(() => {
    let pieces = 0;
    let volume = 0;
    for (const [, entry] of selected) {
      const p = parseInt(entry.piecesUsed, 10);
      if (!isNaN(p) && p > 0) pieces += p;
      const v = parseFloat(entry.volumeM3.replace(",", "."));
      if (!isNaN(v) && v > 0) volume += v;
    }
    return { count: selected.size, pieces, volume };
  }, [selected]);

  const hasActiveFilters = Object.values(filterState).some((s) => s.size > 0) || sortState !== null;

  const handleClearAll = useCallback(() => {
    setFilterState({});
    setSortState(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] sm:max-w-[98vw] max-h-[92vh] h-[92vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Select Packages</DialogTitle>
          <DialogDescription>
            Check packages to select them, enter amounts, then click &quot;Add Selected&quot;
          </DialogDescription>
        </DialogHeader>

        {packages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No available packages in your inventory.
          </p>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {hasActiveFilters && (
              <div className="flex justify-end shrink-0 mb-1">
                <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-xs h-7">
                  <span className="mr-1">×</span>
                  Clear Filters
                </Button>
              </div>
            )}

            <div className="flex-1 overflow-auto rounded-lg border">
              <Table className="w-max min-w-full">
                <TableHeader>
                  <TableRow>
                    {/* Checkbox header */}
                    <TableHead className="px-1 w-[40px] sticky left-0 bg-background z-10" />
                    {columns.map((col) => {
                      const isCollapsed = col.collapsible && collapsedColumns.has(col.key);
                      return (
                        <TableHead
                          key={col.key}
                          className={`px-1 text-xs whitespace-nowrap ${col.collapsible ? "cursor-pointer select-none hover:bg-accent/50 transition-colors" : ""} ${isCollapsed ? "w-[30px]" : ""}`}
                          onClick={col.collapsible ? () => toggleColumn(col.key) : undefined}
                        >
                          <span className="flex items-center gap-0.5">
                            {col.collapsible && (
                              <span className="text-muted-foreground text-[10px]">
                                {isCollapsed ? "▸" : "▾"}
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
                    {/* Editable pieces header */}
                    <TableHead className="px-1 text-xs whitespace-nowrap w-[4.5rem]">Use Pcs</TableHead>
                    {/* Editable volume header */}
                    <TableHead className="px-1 text-xs whitespace-nowrap w-[5rem]">Use m³</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayRows.map((pkg, rowIndex) => {
                    const isSelected = selected.has(pkg.id);
                    const entry = selected.get(pkg.id);
                    const hasPieces = pkg.pieces && pkg.pieces !== "-" && pkg.pieces !== "";
                    const volumeIsCalculated = !!hasPieces && isSingleNumber(pkg.thickness) && isSingleNumber(pkg.width) && isSingleNumber(pkg.length);

                    return (
                      <TableRow
                        key={pkg.id}
                        className={isSelected ? "bg-accent/30" : "hover:bg-accent/10 cursor-pointer"}
                        onClick={() => handleToggleSelect(pkg)}
                      >
                        {/* Checkbox */}
                        <TableCell className="px-2 sticky left-0 bg-background z-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(pkg)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-input"
                          />
                        </TableCell>

                        {columns.map((col) => {
                          const isCollapsed = col.collapsible && collapsedColumns.has(col.key);
                          const value = col.getValue(pkg);

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

                          return (
                            <TableCell key={col.key} className="px-1 text-xs whitespace-nowrap">
                              {value || "—"}
                            </TableCell>
                          );
                        })}

                        {/* Editable pieces — wrapper div locks cell height */}
                        <TableCell className="px-1 py-1" onClick={isSelected ? (e) => e.stopPropagation() : undefined}>
                          <div className="h-7 w-[4.5rem]">
                            {isSelected && hasPieces ? (
                              <Input
                                id={`pkg-sel-${rowIndex}-piecesUsed`}
                                className="h-7 text-xs px-1 w-[4.5rem]"
                                value={entry?.piecesUsed ?? ""}
                                onChange={(e) => handleUpdateField(pkg.id, "piecesUsed", e.target.value)}
                                onKeyDown={(e) => handleInputKeyDown(e, rowIndex, "piecesUsed", !!hasPieces, volumeIsCalculated)}
                                onBlur={(e) => handlePiecesBlur(pkg.id, e.target.value)}
                                placeholder="pcs"
                                disabled={isPending}
                              />
                            ) : isSelected ? (
                              <span className="flex items-center h-7 text-xs text-muted-foreground px-1">-</span>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* Volume — read-only when auto-calculated, editable otherwise */}
                        <TableCell className="px-1 py-1" onClick={isSelected && !volumeIsCalculated ? (e) => e.stopPropagation() : undefined}>
                          <div className="h-7 w-[5rem]">
                            {isSelected && volumeIsCalculated ? (
                              <span className="flex items-center h-7 text-xs px-1 whitespace-nowrap" title="Auto-calculated from pieces × dimensions">
                                {entry?.volumeM3 ?? ""}
                              </span>
                            ) : isSelected ? (
                              <Input
                                id={`pkg-sel-${rowIndex}-volumeM3`}
                                className="h-7 text-xs px-1 w-[5rem]"
                                value={entry?.volumeM3 ?? ""}
                                onChange={(e) => handleUpdateField(pkg.id, "volumeM3", e.target.value)}
                                onKeyDown={(e) => handleInputKeyDown(e, rowIndex, "volumeM3", !!hasPieces, volumeIsCalculated)}
                                onBlur={(e) => handleVolumeBlur(pkg.id, e.target.value)}
                                placeholder="0,000"
                                disabled={isPending}
                              />
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Footer with totals and Add button */}
            <div className="flex items-center justify-end gap-4 pt-3 shrink-0">
              {selectedTotals.count > 0 && (
                <span className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{selectedTotals.count} pkg{selectedTotals.count > 1 ? "s" : ""}</span>
                  {selectedTotals.pieces > 0 && (
                    <span>{selectedTotals.pieces} pcs</span>
                  )}
                  <span>{selectedTotals.volume > 0 ? selectedTotals.volume.toFixed(3).replace(".", ",") : "0,000"} m³</span>
                </span>
              )}
              <Button
                onClick={handleAddSelected}
                disabled={selected.size === 0 || isPending}
              >
                {isPending ? "Adding..." : `Add Selected (${selected.size})`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
