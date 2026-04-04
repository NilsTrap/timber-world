"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { Loader2, Plus, X, Check, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { Button, DataEntryTable, type ColumnDef, type DataEntryTableHandle } from "@timber/ui";
import { SummaryCards } from "@/features/shipments/components/SummaryCards";
import { addTrackingPackages } from "../actions/tracking";
import type { AuditPackageItem } from "@/features/inventory/actions/getAuditPackages";

interface TrackingPackageSelectorProps {
  trackingSetId: string;
  allPackages: AuditPackageItem[];
  existingPackageIds: Set<string>;
  onClose: () => void;
  onPackagesAdded: () => void;
}

export function TrackingPackageSelector({
  trackingSetId,
  allPackages,
  existingPackageIds,
  onClose,
  onPackagesAdded,
}: TrackingPackageSelectorProps) {
  const tableRef = useRef<DataEntryTableHandle>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const [displayedRows, setDisplayedRows] = useState<AuditPackageItem[]>([]);

  // Filter out already-tracked packages
  const availablePackages = useMemo(
    () => allPackages.filter((p) => !existingPackageIds.has(p.id)),
    [allPackages, existingPackageIds]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDisplayRowsChange = useCallback((rows: AuditPackageItem[]) => {
    setDisplayedRows(rows);
  }, []);

  // Check if all displayed rows are selected
  const allDisplayedSelected = displayedRows.length > 0 && displayedRows.every((r) => selectedIds.has(r.id));

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allDisplayedSelected) {
        // Deselect all displayed
        for (const row of displayedRows) {
          next.delete(row.id);
        }
      } else {
        // Select all displayed
        for (const row of displayedRows) {
          next.add(row.id);
        }
      }
      return next;
    });
  }, [displayedRows, allDisplayedSelected]);

  // Selected packages summary
  const selectedPackages = useMemo(
    () => availablePackages.filter((p) => selectedIds.has(p.id)),
    [availablePackages, selectedIds]
  );
  const selectedVolume = useMemo(
    () => selectedPackages.reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0),
    [selectedPackages]
  );
  const displayedVolume = useMemo(
    () => displayedRows.reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0),
    [displayedRows]
  );

  const summaryItems = useMemo(
    () => [
      { label: "Showing", value: `${displayedRows.length} packages` },
      { label: "Showing Vol", value: `${displayedVolume.toFixed(3).replace(".", ",")} m³` },
      { label: "Selected", value: `${selectedIds.size} packages` },
      { label: "Selected Vol", value: `${selectedVolume.toFixed(3).replace(".", ",")} m³` },
    ],
    [displayedRows.length, displayedVolume, selectedIds.size, selectedVolume]
  );

  const columns: ColumnDef<AuditPackageItem>[] = useMemo(
    () => [
      {
        key: "selected",
        label: "",
        type: "custom",
        width: "w-[2.5rem]",
        getValue: (row) => selectedIds.has(row.id) ? "1" : "0",
        renderCell: (row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSelect(row.id);
            }}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              selectedIds.has(row.id)
                ? "bg-primary border-primary text-primary-foreground"
                : "border-input hover:border-primary"
            }`}
          >
            {selectedIds.has(row.id) && <Check className="h-3 w-3" />}
          </button>
        ),
      },
      {
        key: "sourceType",
        label: "Source",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.sourceType,
      },
      {
        key: "sourceDetail",
        label: "Source Detail",
        type: "dropdown",
        getValue: (row) => row.sourceDetail,
      },
      {
        key: "packageNumber",
        label: "Package",
        type: "readonly",
        getValue: (row) => row.packageNumber,
        totalType: "count",
        formatTotal: (v) => String(v),
      },
      {
        key: "status",
        label: "Status",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.status,
      },
      {
        key: "productName",
        label: "Product",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.productName ?? "",
      },
      {
        key: "woodSpecies",
        label: "Species",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.woodSpecies ?? "",
      },
      {
        key: "thickness",
        label: "Thick",
        type: "text",
        isNumeric: true,
        getValue: (row) => row.thickness ?? "",
        width: "w-[4.5rem]",
      },
      {
        key: "width",
        label: "Width",
        type: "text",
        isNumeric: true,
        getValue: (row) => row.width ?? "",
        width: "w-[4.5rem]",
      },
      {
        key: "length",
        label: "Length",
        type: "text",
        isNumeric: true,
        getValue: (row) => row.length ?? "",
        width: "w-[4.5rem]",
      },
      {
        key: "pieces",
        label: "Pieces",
        type: "numeric",
        getValue: (row) => row.pieces && row.pieces !== "0" ? row.pieces : "",
        getDisplayValue: (row) => row.pieces && row.pieces !== "0" ? row.pieces : "-",
        width: "w-[4.5rem]",
        totalType: "sum",
        formatTotal: (v) => String(Math.round(v)),
      },
      {
        key: "volumeM3",
        label: "Vol m³",
        type: "numeric",
        getValue: (row) =>
          row.volumeM3 != null ? row.volumeM3.toFixed(3) : "",
        getDisplayValue: (row) =>
          row.volumeM3 != null ? row.volumeM3.toFixed(3).replace(".", ",") : "",
        totalType: "sum",
        formatTotal: (v) => v.toFixed(3).replace(".", ","),
      },
      {
        key: "destinationType",
        label: "Destination",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.destinationType,
      },
      {
        key: "destinationDetail",
        label: "Dest. Detail",
        type: "dropdown",
        getValue: (row) => row.destinationDetail,
      },
    ],
    [selectedIds, toggleSelect]
  );

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    const result = await addTrackingPackages(trackingSetId, [...selectedIds]);
    if (result.success) {
      toast.success(`Added ${result.data.addedCount} package${result.data.addedCount !== 1 ? "s" : ""}`);
      onPackagesAdded();
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-8 overflow-y-auto">
      <div className="bg-background rounded-lg border shadow-lg w-[95vw] max-w-[1400px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Add Packages to Tracking Set</h2>
            <p className="text-sm text-muted-foreground">
              Select packages to track. {selectedIds.size > 0 && `${selectedIds.size} selected.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => tableRef.current?.clearFilters()}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={displayedRows.length === 0}
            >
              {allDisplayedSelected ? (
                <CheckSquare className="h-4 w-4 mr-1" />
              ) : (
                <Square className="h-4 w-4 mr-1" />
              )}
              {allDisplayedSelected ? "Deselect All" : "Select All"}
            </Button>
            <Button
              onClick={handleAdd}
              disabled={selectedIds.size === 0 || saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}Package{selectedIds.size !== 1 ? "s" : ""}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="px-4 pt-3">
          <SummaryCards items={summaryItems} />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          <DataEntryTable<AuditPackageItem>
            ref={tableRef}
            columns={columns}
            rows={availablePackages}
            getRowKey={(row) => row.id}
            readOnly
            collapseStorageKey="tracking-selector-collapsed"
            filterStorageKey="tracking-selector"
            onFilterActiveChange={setHasActiveFilters}
            onDisplayRowsChange={handleDisplayRowsChange}
            getRowClassName={(row) =>
              selectedIds.has(row.id) ? "bg-primary/5" : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
