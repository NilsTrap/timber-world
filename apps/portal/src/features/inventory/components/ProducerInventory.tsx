"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { DataEntryTable, Button, type ColumnDef, type DataEntryTableHandle, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@timber/ui";
import { X, FileText } from "lucide-react";
import { SummaryCards } from "@/features/shipments/components/SummaryCards";
import { PrintInventoryButton } from "./PrintInventoryButton";
import type { PackageListItem } from "../types";
import type { DraftPackageInfo } from "@/features/production/actions";

interface ProducerInventoryProps {
  packages: PackageListItem[];
  packagesInDrafts?: DraftPackageInfo[];
}

export function ProducerInventory({ packages, packagesInDrafts = [] }: ProducerInventoryProps) {
  const tableRef = useRef<DataEntryTableHandle>(null);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Create a map for quick lookup of draft info by package ID
  const draftsMap = useMemo(() => {
    const map = new Map<string, DraftPackageInfo>();
    packagesInDrafts.forEach((d) => map.set(d.packageId, d));
    return map;
  }, [packagesInDrafts]);

  // Format date for tooltip
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const columns: ColumnDef<PackageListItem>[] = useMemo(
    () => [
      {
        key: "shipmentCode",
        label: "Shipment",
        type: "readonly",
        getValue: (row) => row.shipmentCode,
      },
      {
        key: "packageNumber",
        label: "Package",
        type: "custom",
        getValue: (row) => row.packageNumber,
        totalType: "count",
        formatTotal: (v) => String(v),
        renderCell: (row) => {
          const draftInfo = draftsMap.get(row.id);
          return (
            <div className="flex items-center gap-1.5">
              <span>{row.packageNumber}</span>
              {draftInfo && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <FileText className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>In draft: {draftInfo.processName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(draftInfo.productionDate)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
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
        key: "humidity",
        label: "Humidity",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.humidity ?? "",
      },
      {
        key: "typeName",
        label: "Type",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.typeName ?? "",
      },
      {
        key: "processing",
        label: "Processing",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.processing ?? "",
      },
      {
        key: "fsc",
        label: "FSC",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.fsc ?? "",
      },
      {
        key: "quality",
        label: "Quality",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.quality ?? "",
      },
      {
        key: "thickness",
        label: "Thickness",
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
        getValue: (row) => row.pieces ?? "",
        width: "w-[4.5rem]",
        totalType: "sum",
        formatTotal: (v) => String(v),
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
    ],
    [draftsMap]
  );

  const [displayedPackages, setDisplayedPackages] = useState<PackageListItem[]>(packages);

  const handleDisplayRowsChange = useCallback((rows: PackageListItem[]) => {
    setDisplayedPackages(rows);
  }, []);

  const summaryItems = useMemo(
    () => [
      {
        label: "Total m³",
        value: displayedPackages
          .reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0)
          .toFixed(3)
          .replace(".", ","),
      },
      { label: "Total Packages", value: displayedPackages.length },
      {
        label: "Total Pieces",
        value: displayedPackages.reduce((sum, p) => {
          const n = p.pieces ? parseInt(p.pieces, 10) : 0;
          return sum + (isNaN(n) ? 0 : n);
        }, 0),
      },
    ],
    [displayedPackages]
  );

  return (
    <div className="space-y-4 w-fit max-w-full">
      <div className="relative">
        <SummaryCards items={summaryItems} />
        <div className="flex gap-2 absolute right-0 bottom-0">
          <PrintInventoryButton
            packages={displayedPackages}
            title="Inventory Packages"
          />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => tableRef.current?.clearFilters()}
              className="text-xs h-7"
            >
              <X className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      <DataEntryTable<PackageListItem>
        ref={tableRef}
        columns={columns}
        rows={packages}
        getRowKey={(row) => row.id}
        readOnly
        collapseStorageKey="producer-inventory-collapsed"
        onDisplayRowsChange={handleDisplayRowsChange}
        onFilterActiveChange={setHasActiveFilters}
        getRowClassName={(row) => draftsMap.has(row.id) ? "bg-amber-50" : undefined}
      />
    </div>
  );
}
