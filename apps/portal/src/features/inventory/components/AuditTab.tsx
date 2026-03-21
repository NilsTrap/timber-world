"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { DataEntryTable, Button, type ColumnDef, type DataEntryTableHandle } from "@timber/ui";
import { X } from "lucide-react";
import { SummaryCards } from "@/features/shipments/components/SummaryCards";
import type { AuditPackageItem } from "../actions/getAuditPackages";

interface AuditTabProps {
  packages: AuditPackageItem[];
  showOrgColumn?: boolean;
}

export function AuditTab({ packages, showOrgColumn = true }: AuditTabProps) {
  const tableRef = useRef<DataEntryTableHandle>(null);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  const columns: ColumnDef<AuditPackageItem>[] = useMemo(
    () => [
      ...(showOrgColumn ? [{
        key: "organisationCode" as const,
        label: "Org",
        type: "dropdown" as const,
        collapsible: true,
        getValue: (row: AuditPackageItem) => row.organisationCode ?? "",
        width: "w-[3.5rem]",
      }] : []),
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
        type: "custom",
        getValue: (row) => row.packageNumber,
        totalType: "count",
        formatTotal: (v) => String(v),
        renderCell: (row) => (
          <div className="flex items-center justify-end whitespace-nowrap">
            <span>{row.packageNumber}</span>
          </div>
        ),
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
        key: "typeName",
        label: "Type",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.typeName ?? "",
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
    [showOrgColumn]
  );

  const [displayedPackages, setDisplayedPackages] = useState<AuditPackageItem[]>(packages);

  const handleDisplayRowsChange = useCallback((rows: AuditPackageItem[]) => {
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
        label: "Active",
        value: displayedPackages.filter((p) => p.status !== "consumed").length,
      },
      {
        label: "Consumed",
        value: displayedPackages.filter((p) => p.status === "consumed").length,
      },
    ],
    [displayedPackages]
  );

  return (
    <div className="space-y-4 w-fit max-w-full">
      <div className="relative">
        <SummaryCards items={summaryItems} />
        <div className="flex gap-2 absolute right-0 bottom-0">
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

      <DataEntryTable<AuditPackageItem>
        ref={tableRef}
        columns={columns}
        rows={packages}
        getRowKey={(row) => row.id}
        readOnly
        collapseStorageKey="inventory-audit-collapsed"
        filterStorageKey="inventory-audit"
        onDisplayRowsChange={handleDisplayRowsChange}
        onFilterActiveChange={setHasActiveFilters}
        getRowClassName={(row) => {
          if (row.status === "consumed") return "bg-gray-50 text-muted-foreground";
          return undefined;
        }}
      />
    </div>
  );
}
