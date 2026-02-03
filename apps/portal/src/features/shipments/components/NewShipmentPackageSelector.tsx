"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
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
  ColumnHeaderMenu,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type ColumnSortState,
} from "@timber/ui";
import { MessageSquare } from "lucide-react";
import type { ShipmentAvailablePackage } from "../actions/getShipmentAvailablePackages";

interface NewShipmentPackageSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packages: ShipmentAvailablePackage[];
  /** IDs of packages already in the shipment form (to exclude from selection) */
  excludePackageIds?: Set<string>;
  onPackagesSelected: (packages: ShipmentAvailablePackage[]) => void;
}

interface ColConfig {
  key: string;
  label: string;
  collapsible?: boolean;
  isNumeric?: boolean;
  getValue: (row: ShipmentAvailablePackage) => string;
}

const COLLAPSE_STORAGE_KEY = "new-shipment-package-selector-collapsed";

/**
 * New Shipment Package Selector Dialog
 *
 * Shows available inventory packages for selection when creating a new shipment.
 * Users can select multiple packages to add to the shipment form.
 * Unlike production inputs, entire packages are selected (no partial quantities).
 */
export function NewShipmentPackageSelector({
  open,
  onOpenChange,
  packages,
  excludePackageIds = new Set(),
  onPackagesSelected,
}: NewShipmentPackageSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [sortState, setSortState] = useState<ColumnSortState | null>(null);
  const [filterState, setFilterState] = useState<Record<string, Set<string>>>({});

  // Filter out already-added packages
  const availablePackages = useMemo(
    () => packages.filter((pkg) => !excludePackageIds.has(pkg.id)),
    [packages, excludePackageIds]
  );

  // Load collapsed columns from localStorage
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
    let rows = [...availablePackages];
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
    } else {
      rows.sort((a, b) => (a.packageNumber ?? "").localeCompare(b.packageNumber ?? "", undefined, { numeric: true }));
    }
    return rows;
  }, [availablePackages, filterState, sortState, columns]);

  const getUniqueValues = useCallback(
    (key: string): string[] => {
      const col = columns.find((c) => c.key === key);
      if (!col) return [];
      return [...new Set(availablePackages.map((r) => col.getValue(r)))].filter(Boolean);
    },
    [availablePackages, columns]
  );

  const handleToggleSelect = useCallback((pkgId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkgId)) {
        next.delete(pkgId);
      } else {
        next.add(pkgId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selected.size === displayRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayRows.map((r) => r.id)));
    }
  }, [displayRows, selected.size]);

  const handleAddSelected = useCallback(() => {
    const selectedPackages = availablePackages.filter((pkg) => selected.has(pkg.id));
    onPackagesSelected(selectedPackages);
    setSelected(new Set());
    onOpenChange(false);
  }, [selected, availablePackages, onPackagesSelected, onOpenChange]);

  // Reset selection when dialog closes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setSelected(new Set());
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  // Compute totals for selected packages
  const selectedTotals = useMemo(() => {
    let pieces = 0;
    let volume = 0;
    for (const pkg of availablePackages) {
      if (!selected.has(pkg.id)) continue;
      const p = parseInt(pkg.pieces ?? "", 10);
      if (!isNaN(p) && p > 0) pieces += p;
      if (pkg.volumeM3 != null && pkg.volumeM3 > 0) volume += pkg.volumeM3;
    }
    return { count: selected.size, pieces, volume };
  }, [selected, availablePackages]);

  const hasActiveFilters = Object.values(filterState).some((s) => s.size > 0) || sortState !== null;

  const handleClearAll = useCallback(() => {
    setFilterState({});
    setSortState(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] sm:max-w-[98vw] max-h-[92vh] h-[92vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Select Packages from Inventory</DialogTitle>
          <DialogDescription>
            Select packages to add to this shipment. Entire packages will be shipped.
          </DialogDescription>
        </DialogHeader>

        {availablePackages.length === 0 ? (
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
                    <TableHead className="px-1 w-[40px] sticky left-0 bg-background z-10">
                      <input
                        type="checkbox"
                        checked={selected.size === displayRows.length && displayRows.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 rounded border-input"
                        title="Select all"
                      />
                    </TableHead>
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
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayRows.map((pkg) => {
                    const isSelected = selected.has(pkg.id);

                    return (
                      <TableRow
                        key={pkg.id}
                        className={
                          isSelected
                            ? "bg-accent/30 hover:bg-accent/40 cursor-pointer"
                            : "hover:bg-accent/10 cursor-pointer"
                        }
                        onClick={() => handleToggleSelect(pkg.id)}
                      >
                        {/* Checkbox */}
                        <TableCell className="px-2 sticky left-0 bg-background z-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(pkg.id)}
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

                          // Special rendering for packageNumber to show notes icon
                          if (col.key === "packageNumber") {
                            const hasNote = !!pkg.notes;
                            if (hasNote) {
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
                                          <p className="whitespace-pre-wrap text-sm">{pkg.notes}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </TableCell>
                              );
                            }
                          }

                          return (
                            <TableCell key={col.key} className="px-1 text-xs whitespace-nowrap">
                              {value || "-"}
                            </TableCell>
                          );
                        })}
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
                  <span>{selectedTotals.count} package{selectedTotals.count > 1 ? "s" : ""}</span>
                  {selectedTotals.pieces > 0 && (
                    <span>{selectedTotals.pieces} pcs</span>
                  )}
                  <span>{selectedTotals.volume > 0 ? selectedTotals.volume.toFixed(3).replace(".", ",") : "0,000"} m³</span>
                </span>
              )}
              <Button
                onClick={handleAddSelected}
                disabled={selected.size === 0}
              >
                Add Selected ({selected.size})
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
