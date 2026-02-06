"use client";

import { useState, useCallback, useMemo, Fragment, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  ColumnHeaderMenu,
  type ColumnSortState,
} from "@timber/ui";
import type { PackageDetail, ShipmentPallet } from "../types";
import { createPallet, deletePallet, assignPackageToPallet } from "../actions/shipmentPallets";
import { removePackageFromShipment } from "../actions/shipmentPackages";
import { toast } from "sonner";

interface ShipmentPalletTableProps {
  shipmentId: string;
  packages: PackageDetail[];
  pallets: ShipmentPallet[];
  canEdit: boolean;
  onRefresh: () => void;
}

interface PalletGroup {
  pallet: ShipmentPallet | null; // null = loose packages
  packages: PackageDetail[];
  totalPieces: number;
  totalVolume: number;
}

interface ColConfig {
  key: string;
  label: string;
  collapsible?: boolean;
  isNumeric?: boolean;
  getValue: (row: PackageDetail) => string;
}

const COLLAPSE_STORAGE_KEY = "shipment-packages-collapsed";

const COLUMNS: ColConfig[] = [
  { key: "packageNumber", label: "Package", getValue: (r) => r.packageNumber ?? "" },
  { key: "productName", label: "Product", collapsible: true, getValue: (r) => r.productName ?? "" },
  { key: "woodSpecies", label: "Species", collapsible: true, getValue: (r) => r.woodSpecies ?? "" },
  { key: "humidity", label: "Humidity", collapsible: true, getValue: (r) => r.humidity ?? "" },
  { key: "typeName", label: "Type", collapsible: true, getValue: (r) => r.typeName ?? "" },
  { key: "processing", label: "Processing", collapsible: true, getValue: (r) => r.processing ?? "" },
  { key: "fsc", label: "FSC", collapsible: true, getValue: (r) => r.fsc ?? "" },
  { key: "quality", label: "Quality", collapsible: true, getValue: (r) => r.quality ?? "" },
  { key: "thickness", label: "Thickness", isNumeric: true, getValue: (r) => r.thickness ?? "" },
  { key: "width", label: "Width", isNumeric: true, getValue: (r) => r.width ?? "" },
  { key: "length", label: "Length", isNumeric: true, getValue: (r) => r.length ?? "" },
];

function formatVolume(vol: number | null): string {
  if (vol === null || vol === 0) return "-";
  return vol.toLocaleString("de-DE", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export function ShipmentPalletTable({
  shipmentId,
  packages,
  pallets,
  canEdit,
  onRefresh,
}: ShipmentPalletTableProps) {
  const [collapsedPallets, setCollapsedPallets] = useState<Set<string>>(new Set());
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [pendingAssignments, setPendingAssignments] = useState<Set<string>>(new Set());
  const [sortState, setSortState] = useState<ColumnSortState | null>(null);
  const [filterState, setFilterState] = useState<Record<string, Set<string>>>({});

  // Load collapsed columns from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (stored) setCollapsedColumns(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, []);

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

  // Get unique values for filter menus
  const getUniqueValues = useCallback(
    (key: string): string[] => {
      const col = COLUMNS.find((c) => c.key === key);
      if (col) {
        return [...new Set(packages.map((r) => col.getValue(r)))].filter(Boolean);
      }
      if (key === "pieces") {
        return [...new Set(packages.map((r) => r.pieces ?? "-"))];
      }
      if (key === "volumeM3") {
        return [...new Set(packages.map((r) => formatVolume(r.volumeM3)))];
      }
      if (key === "pallet") {
        const values = packages.map((r) => {
          if (!r.palletId) return "-";
          const p = pallets.find((pl) => pl.id === r.palletId);
          return p ? `Pallet ${p.palletNumber}` : "-";
        });
        return [...new Set(values)];
      }
      return [];
    },
    [packages, pallets]
  );

  // Apply filters and sort to packages
  const filteredPackages = useMemo(() => {
    let rows = [...packages];

    // Filter
    for (const [colKey, filterValues] of Object.entries(filterState)) {
      if (filterValues.size === 0) continue;
      const col = COLUMNS.find((c) => c.key === colKey);
      if (col) {
        rows = rows.filter((r) => filterValues.has(col.getValue(r)));
      } else if (colKey === "pieces") {
        rows = rows.filter((r) => filterValues.has(r.pieces ?? "-"));
      } else if (colKey === "volumeM3") {
        rows = rows.filter((r) => filterValues.has(formatVolume(r.volumeM3)));
      } else if (colKey === "pallet") {
        rows = rows.filter((r) => {
          if (!r.palletId) return filterValues.has("-");
          const p = pallets.find((pl) => pl.id === r.palletId);
          return filterValues.has(p ? `Pallet ${p.palletNumber}` : "-");
        });
      }
    }

    // Sort
    if (sortState) {
      const { column, direction } = sortState;
      rows.sort((a, b) => {
        let valA: string;
        let valB: string;
        const col = COLUMNS.find((c) => c.key === column);
        if (col) {
          valA = col.getValue(a);
          valB = col.getValue(b);
        } else if (column === "pieces") {
          valA = a.pieces ?? "";
          valB = b.pieces ?? "";
        } else if (column === "volumeM3") {
          valA = String(a.volumeM3 ?? 0);
          valB = String(b.volumeM3 ?? 0);
        } else if (column === "pallet") {
          const pa = a.palletId ? pallets.find((p) => p.id === a.palletId)?.palletNumber ?? 999 : 999;
          const pb = b.palletId ? pallets.find((p) => p.id === b.palletId)?.palletNumber ?? 999 : 999;
          valA = String(pa);
          valB = String(pb);
        } else {
          return 0;
        }
        const cmp = valA.localeCompare(valB, undefined, { numeric: true });
        return direction === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [packages, filterState, sortState, pallets]);

  // Group packages by pallet
  const palletGroups = useMemo(() => {
    const groups: PalletGroup[] = [];
    const palletPackages = new Map<string | null, PackageDetail[]>();

    for (const pkg of filteredPackages) {
      const key = pkg.palletId;
      if (!palletPackages.has(key)) {
        palletPackages.set(key, []);
      }
      palletPackages.get(key)!.push(pkg);
    }

    // Create groups for existing pallets (in order)
    for (const pallet of pallets) {
      const pkgs = palletPackages.get(pallet.id) ?? [];
      const totalPieces = pkgs.reduce((sum, p) => sum + (parseInt(p.pieces ?? "0") || 0), 0);
      const totalVolume = pkgs.reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0);
      groups.push({ pallet, packages: pkgs, totalPieces, totalVolume });
    }

    // Add loose packages group (pallet = null)
    const loosePackages = palletPackages.get(null) ?? [];
    if (loosePackages.length > 0 || groups.length === 0) {
      const totalPieces = loosePackages.reduce((sum, p) => sum + (parseInt(p.pieces ?? "0") || 0), 0);
      const totalVolume = loosePackages.reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0);
      groups.push({ pallet: null, packages: loosePackages, totalPieces, totalVolume });
    }

    return groups;
  }, [filteredPackages, pallets]);

  // Grand totals
  const grandTotals = useMemo(() => {
    const totalPackages = filteredPackages.length;
    const totalPieces = filteredPackages.reduce((sum, p) => sum + (parseInt(p.pieces ?? "0") || 0), 0);
    const totalVolume = filteredPackages.reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0);
    return { totalPackages, totalPieces, totalVolume };
  }, [filteredPackages]);

  const togglePalletCollapse = useCallback((palletId: string | null) => {
    const key = palletId ?? "loose";
    setCollapsedPallets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleCreatePallet = async () => {
    const result = await createPallet(shipmentId);
    if (result.success) {
      toast.success(`Pallet ${result.data.palletNumber} created`);
      onRefresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleDeletePallet = async (palletId: string, palletNumber: number) => {
    const result = await deletePallet(palletId);
    if (result.success) {
      toast.success(`Pallet ${palletNumber} deleted`);
      onRefresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleAssignPackage = async (packageId: string, newPalletId: string | null) => {
    setPendingAssignments((prev) => new Set(prev).add(packageId));

    // Check if user selected "+ New Pallet"
    if (newPalletId === "__new__") {
      const createResult = await createPallet(shipmentId);
      if (!createResult.success) {
        toast.error(createResult.error);
        setPendingAssignments((prev) => {
          const next = new Set(prev);
          next.delete(packageId);
          return next;
        });
        return;
      }
      newPalletId = createResult.data.id;
      toast.success(`Pallet ${createResult.data.palletNumber} created`);
    }

    const result = await assignPackageToPallet(packageId, newPalletId);

    setPendingAssignments((prev) => {
      const next = new Set(prev);
      next.delete(packageId);
      return next;
    });

    if (result.success) {
      onRefresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleRemovePackage = async (packageId: string) => {
    const result = await removePackageFromShipment(shipmentId, packageId);
    if (result.success) {
      toast.success("Package removed");
      onRefresh();
    } else {
      toast.error(result.error);
    }
  };

  // Calculate column span for group headers
  const baseColCount = COLUMNS.length + 2; // columns + pieces + volume
  const editColCount = canEdit ? 2 : 0; // pallet dropdown + delete button
  const totalCols = 1 + baseColCount + editColCount; // expand icon + base + edit

  return (
    <div className="space-y-2">
      {/* Header with Add Pallet button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleCreatePallet}>
            <Plus className="h-4 w-4 mr-1" />
            Add Pallet
          </Button>
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto w-fit max-w-full">
        <Table className="w-auto">
          <TableHeader>
            <TableRow>
              {/* Expand/collapse icon column */}
              <TableHead className="w-[30px] px-1" />

              {/* Pallet column first (edit mode only) */}
              {canEdit && (
                <TableHead className="px-1 text-xs whitespace-nowrap">
                  <span className="flex items-center gap-0.5">
                    Pallet
                    <ColumnHeaderMenu
                      columnKey="pallet"
                      uniqueValues={getUniqueValues("pallet")}
                      activeSort={sortState}
                      activeFilter={filterState["pallet"] ?? new Set()}
                      onSortChange={handleSortChange}
                      onFilterChange={handleFilterChange}
                    />
                  </span>
                </TableHead>
              )}

              {/* Standard columns with ColumnHeaderMenu */}
              {COLUMNS.map((col) => {
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

              {/* Pieces column */}
              <TableHead className="px-1 text-xs whitespace-nowrap">
                <span className="flex items-center gap-0.5">
                  Pieces
                  <ColumnHeaderMenu
                    columnKey="pieces"
                    isNumeric
                    uniqueValues={getUniqueValues("pieces")}
                    activeSort={sortState}
                    activeFilter={filterState["pieces"] ?? new Set()}
                    onSortChange={handleSortChange}
                    onFilterChange={handleFilterChange}
                  />
                </span>
              </TableHead>

              {/* Volume column */}
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

              {/* Delete column (edit mode only) */}
              {canEdit && <TableHead className="px-1 w-[40px]" />}
            </TableRow>
          </TableHeader>

          <TableBody>
            {palletGroups.map((group) => {
              const key = group.pallet?.id ?? "loose";
              const isCollapsed = collapsedPallets.has(key);
              const groupLabel = group.pallet
                ? `Pallet ${group.pallet.palletNumber}`
                : "Without Pallet";

              return (
                <Fragment key={key}>
                  {/* Pallet Group Header */}
                  <TableRow
                    className="bg-muted/50 hover:bg-muted/70 cursor-pointer"
                    onClick={() => togglePalletCollapse(group.pallet?.id ?? null)}
                  >
                    <TableCell className="py-2 px-1">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell colSpan={totalCols - 2} className="py-2 px-1">
                      <span className="font-medium text-xs">{groupLabel}</span>
                    </TableCell>
                    <TableCell className="py-2 px-1" onClick={(e) => e.stopPropagation()}>
                      {canEdit && group.pallet && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeletePallet(group.pallet!.id, group.pallet!.palletNumber)}
                          title="Delete pallet"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Package Rows (when not collapsed) */}
                  {!isCollapsed && group.packages.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="px-1" />

                      {/* Pallet dropdown first (edit mode only) */}
                      {canEdit && (
                        <TableCell className="px-1">
                          <select
                            value={pkg.palletId ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleAssignPackage(pkg.id, value === "" ? null : value);
                            }}
                            disabled={pendingAssignments.has(pkg.id)}
                            className="h-7 text-xs rounded-md border border-input bg-transparent px-1 py-0.5 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                          >
                            <option value="">-</option>
                            {pallets.map((p) => (
                              <option key={p.id} value={p.id}>
                                Pallet {p.palletNumber}
                              </option>
                            ))}
                            <option value="__new__">+ New Pallet</option>
                          </select>
                        </TableCell>
                      )}

                      {/* Standard columns */}
                      {COLUMNS.map((col) => {
                        const isColCollapsed = col.collapsible && collapsedColumns.has(col.key);
                        const value = col.getValue(pkg);

                        if (isColCollapsed) {
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
                            {value || "-"}
                          </TableCell>
                        );
                      })}

                      {/* Pieces */}
                      <TableCell className="px-1 text-xs whitespace-nowrap">
                        {pkg.pieces ?? "-"}
                      </TableCell>

                      {/* Volume */}
                      <TableCell className="px-1 text-xs whitespace-nowrap">
                        {formatVolume(pkg.volumeM3)}
                      </TableCell>

                      {/* Delete button (edit mode only) */}
                      {canEdit && (
                        <TableCell className="px-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRemovePackage(pkg.id)}
                            title="Remove package"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}

                  {/* Empty group message */}
                  {!isCollapsed && group.packages.length === 0 && (
                    <TableRow>
                      <TableCell className="px-1" />
                      <TableCell
                        colSpan={totalCols - 1}
                        className="text-center text-xs text-muted-foreground py-4 px-1"
                      >
                        No packages in this {group.pallet ? "pallet" : "group"}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>

          {/* Totals Footer */}
          {filteredPackages.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="px-1" />
                {/* Empty cell for pallet column (edit mode only) */}
                {canEdit && <TableCell className="px-1" />}
                {/* Package count in first standard column */}
                <TableCell className="px-1 font-mono text-xs font-semibold">
                  {grandTotals.totalPackages}
                </TableCell>
                {/* Empty cells for other columns */}
                {COLUMNS.slice(1).map((col) => (
                  <TableCell key={col.key} className="px-1" />
                ))}
                {/* Pieces sum */}
                <TableCell className="px-1 font-mono text-xs font-semibold">
                  {grandTotals.totalPieces > 0 ? grandTotals.totalPieces : ""}
                </TableCell>
                {/* Volume sum */}
                <TableCell className="px-1 font-mono text-xs font-semibold">
                  {grandTotals.totalVolume > 0 ? formatVolume(grandTotals.totalVolume) : ""}
                </TableCell>
                {canEdit && <TableCell className="px-1" />}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
