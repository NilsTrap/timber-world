"use client";

import { useMemo, useState, useCallback } from "react";
import { DataEntryTable, type ColumnDef } from "@timber/ui";
import { SummaryCards } from "./SummaryCards";
import type { PackageListItem } from "../types";

interface PackagesTabProps {
  packages: PackageListItem[];
}

export function PackagesTab({ packages }: PackagesTabProps) {
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
        type: "readonly",
        getValue: (row) => row.packageNumber,
        totalType: "count",
        formatTotal: (v) => String(v),
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
    []
  );

  const [displayedPackages, setDisplayedPackages] = useState<PackageListItem[]>(packages);

  const handleDisplayRowsChange = useCallback((rows: PackageListItem[]) => {
    setDisplayedPackages(rows);
  }, []);

  const summaryItems = useMemo(
    () => [
      { label: "Total Packages", value: displayedPackages.length },
      {
        label: "Total m³",
        value: displayedPackages
          .reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0)
          .toFixed(3)
          .replace(".", ","),
      },
    ],
    [displayedPackages]
  );

  if (packages.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No packages recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SummaryCards items={summaryItems} />

      <DataEntryTable<PackageListItem>
        columns={columns}
        rows={packages}
        getRowKey={(row) => row.id}
        readOnly
        collapseStorageKey="inventory-packages-collapsed"
        onDisplayRowsChange={handleDisplayRowsChange}
      />
    </div>
  );
}
