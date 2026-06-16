"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
import { MessageSquare, Truck, FileText, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPlanAvailablePackages, addPackagesToPlan } from "../actions";
import type { PlanAvailablePackage } from "../actions";

interface PlanPackageSelectorProps {
  planId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPackagesAdded: () => void;
}

interface ColConfig {
  key: string;
  label: string;
  collapsible?: boolean;
  isNumeric?: boolean;
  getValue: (row: PlanAvailablePackage) => string;
}

/**
 * PlanPackageSelector — modal for picking inventory packages to add to a plan.
 * Same shape as ShipmentPackageSelector but no package is ever "disabled":
 * plans are informational so adding a package that's already in another plan,
 * production draft, or outgoing shipment is allowed. Markers are shown so the
 * user sees the package's current state.
 */
export function PlanPackageSelector({
  planId,
  open,
  onOpenChange,
  onPackagesAdded,
}: PlanPackageSelectorProps) {
  const [allPackages, setAllPackages] = useState<PlanAvailablePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortState, setSortState] = useState<ColumnSortState | null>(null);
  const [filterState, setFilterState] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getPlanAvailablePackages(planId).then((r) => {
      if (cancelled) return;
      if (r.success) setAllPackages(r.data);
      else toast.error(r.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, planId]);

  const columns: ColConfig[] = useMemo(() => [
    { key: "shipmentCode", label: "Shipment", getValue: (r) => r.shipmentCode ?? "" },
    { key: "packageNumber", label: "Package", getValue: (r) => r.packageNumber ?? "" },
    { key: "productName", label: "Product", getValue: (r) => r.productName ?? "" },
    { key: "woodSpecies", label: "Species", getValue: (r) => r.woodSpecies ?? "" },
    { key: "humidity", label: "Humidity", getValue: (r) => r.humidity ?? "" },
    { key: "typeName", label: "Type", getValue: (r) => r.typeName ?? "" },
    { key: "processing", label: "Processing", getValue: (r) => r.processing ?? "" },
    { key: "fsc", label: "FSC", getValue: (r) => r.fsc ?? "" },
    { key: "quality", label: "Quality", getValue: (r) => r.quality ?? "" },
    { key: "thickness", label: "Thickness", isNumeric: true, getValue: (r) => r.thickness ?? "" },
    { key: "width", label: "Width", isNumeric: true, getValue: (r) => r.width ?? "" },
    { key: "length", label: "Length", isNumeric: true, getValue: (r) => r.length ?? "" },
    { key: "pieces", label: "Pieces", isNumeric: true, getValue: (r) => r.pieces ?? "" },
    { key: "volumeM3", label: "Vol m³", isNumeric: true, getValue: (r) => r.volumeM3 != null ? r.volumeM3.toFixed(3) : "" },
  ], []);

  const displayRows = useMemo(() => {
    let rows = [...allPackages];
    for (const [colKey, allowed] of Object.entries(filterState)) {
      if (allowed.size === 0) continue;
      const col = columns.find((c) => c.key === colKey);
      if (!col) continue;
      rows = rows.filter((r) => allowed.has(col.getValue(r)));
    }
    if (sortState) {
      const col = columns.find((c) => c.key === sortState.column);
      if (col) {
        rows.sort((a, b) => {
          const av = col.getValue(a);
          const bv = col.getValue(b);
          const cmp = col.isNumeric
            ? (parseFloat(av) || 0) - (parseFloat(bv) || 0)
            : av.localeCompare(bv);
          return sortState.direction === "asc" ? cmp : -cmp;
        });
      }
    }
    return rows;
  }, [allPackages, filterState, sortState, columns]);

  const uniqueValuesFor = useCallback((key: string): string[] => {
    let pool = [...allPackages];
    for (const [colKey, allowed] of Object.entries(filterState)) {
      if (colKey === key || allowed.size === 0) continue;
      const col = columns.find((c) => c.key === colKey);
      if (col) pool = pool.filter((r) => allowed.has(col.getValue(r)));
    }
    const col = columns.find((c) => c.key === key);
    if (!col) return [];
    return [...new Set(pool.map((r) => col.getValue(r)))].filter(Boolean);
  }, [allPackages, filterState, columns]);

  const handleSortChange = useCallback((s: ColumnSortState | null) => setSortState(s), []);
  const handleFilterChange = useCallback((key: string, vals: Set<string>) => {
    setFilterState((prev) => ({ ...prev, [key]: vals }));
  }, []);

  const toggleSelect = useCallback((pkgId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkgId)) next.delete(pkgId);
      else next.add(pkgId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selected.size === displayRows.length && displayRows.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayRows.map((r) => r.id)));
    }
  }, [displayRows, selected.size]);

  const handleAdd = useCallback(async () => {
    if (selected.size === 0) {
      toast.error("Select at least one package");
      return;
    }
    setAdding(true);
    const result = await addPackagesToPlan(planId, Array.from(selected));
    setAdding(false);
    if (result.success) {
      toast.success(`Added ${result.data.added} package${result.data.added !== 1 ? "s" : ""}`);
      setSelected(new Set());
      onPackagesAdded();
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }, [planId, selected, onPackagesAdded, onOpenChange]);

  const totals = useMemo(() => {
    let pieces = 0, volume = 0;
    for (const pkg of allPackages) {
      if (!selected.has(pkg.id)) continue;
      const p = parseInt(pkg.pieces ?? "0", 10);
      if (!isNaN(p)) pieces += p;
      if (pkg.volumeM3 != null) volume += pkg.volumeM3;
    }
    return { count: selected.size, pieces, volume };
  }, [selected, allPackages]);

  // Totals across whatever rows are currently visible (after filter).
  const visibleTotals = useMemo(() => {
    let pieces = 0, volume = 0;
    for (const pkg of displayRows) {
      const p = parseInt(pkg.pieces ?? "0", 10);
      if (!isNaN(p)) pieces += p;
      if (pkg.volumeM3 != null) volume += pkg.volumeM3;
    }
    return { count: displayRows.length, pieces, volume };
  }, [displayRows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] sm:max-w-[98vw] max-h-[92vh] h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Packages for Plan</DialogTitle>
          <DialogDescription>
            Pick packages from your inventory to add to this plan. Plans are
            informational — packages can be on multiple plans and in production
            or shipment drafts at the same time. Markers below show current state.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allPackages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No packages available.</div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-auto rounded-lg border">
              <Table dense className="w-max min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-1 w-[40px] sticky left-0 bg-background z-10">
                      <input
                        type="checkbox"
                        checked={selected.size === displayRows.length && displayRows.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 rounded border-input"
                      />
                    </TableHead>
                    {columns.map((col) => (
                      <TableHead key={col.key} className="px-1 text-xs whitespace-nowrap">
                        <span className="flex items-center gap-0.5">
                          {col.label}
                          <ColumnHeaderMenu
                            columnKey={col.key}
                            isNumeric={col.isNumeric}
                            uniqueValues={uniqueValuesFor(col.key)}
                            activeSort={sortState}
                            activeFilter={filterState[col.key] ?? new Set()}
                            onSortChange={handleSortChange}
                            onFilterChange={handleFilterChange}
                          />
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((pkg) => {
                    const isSelected = selected.has(pkg.id);
                    return (
                      <TableRow
                        key={pkg.id}
                        className={isSelected ? "bg-accent/30 hover:bg-accent/40 cursor-pointer" : "hover:bg-accent/10 cursor-pointer"}
                        onClick={() => toggleSelect(pkg.id)}
                      >
                        <TableCell className="px-2 sticky left-0 bg-background z-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(pkg.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-input"
                          />
                        </TableCell>
                        {columns.map((col) => {
                          const value = col.getValue(pkg);
                          if (col.key === "packageNumber") {
                            const hasNote = !!pkg.notes;
                            const showMarkers = hasNote || pkg.inOutgoingShipment || pkg.inProductionDraft || pkg.inAnotherPlan;
                            if (showMarkers) {
                              return (
                                <TableCell key={col.key} className="px-1 text-xs whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <span>{value || "-"}</span>
                                    {pkg.inAnotherPlan && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Layers className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
                                          </TooltipTrigger>
                                          <TooltipContent side="right" className="max-w-xs">
                                            <p className="text-sm">Also in plan{pkg.otherPlanNames?.includes(",") ? "s" : ""}: {pkg.otherPlanNames}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    {pkg.inOutgoingShipment && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Truck className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                          </TooltipTrigger>
                                          <TooltipContent side="right" className="max-w-xs">
                                            <p className="text-sm">In shipment {pkg.outgoingShipmentCode ?? "(unknown)"}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    {pkg.inProductionDraft && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <FileText className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                                          </TooltipTrigger>
                                          <TooltipContent><p>In production draft</p></TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    {hasNote && (
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
                                    )}
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

            <div className="flex items-center justify-between gap-4 pt-3 shrink-0">
              <span className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Showing:</span>
                <span>{visibleTotals.count} package{visibleTotals.count !== 1 ? "s" : ""}</span>
                <span>{visibleTotals.pieces} pcs</span>
                <span>{visibleTotals.volume.toFixed(3).replace(".", ",")} m³</span>
              </span>
              <div className="flex items-center gap-4">
                {totals.count > 0 && (
                  <span className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Selected:</span>
                    <span>{totals.count} package{totals.count > 1 ? "s" : ""}</span>
                    {totals.pieces > 0 && <span>{totals.pieces} pcs</span>}
                    {totals.volume > 0 && <span>{totals.volume.toFixed(3).replace(".", ",")} m³</span>}
                  </span>
                )}
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adding}>Cancel</Button>
                <Button onClick={handleAdd} disabled={selected.size === 0 || adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Add {selected.size > 0 ? `(${selected.size})` : ""}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
