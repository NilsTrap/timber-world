"use client";

import { useMemo, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  DataEntryTable,
  type ColumnDef,
} from "@timber/ui";
import { SummaryCards } from "./SummaryCards";
import { deleteInventoryPackage } from "@/features/inventory/actions";
import type { PackageListItem } from "../types";

interface PackagesTabProps {
  packages: PackageListItem[];
  /** If true, shows delete button for each row (Super Admin only) */
  canDelete?: boolean;
}

export function PackagesTab({ packages, canDelete = false }: PackagesTabProps) {
  const [localPackages, setLocalPackages] = useState(packages);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (packageId: string) => {
    setDeletingId(packageId);
    const result = await deleteInventoryPackage(packageId);
    if (result.success) {
      toast.success("Package deleted");
      setLocalPackages((prev) => prev.filter((p) => p.id !== packageId));
    } else {
      toast.error(result.error);
    }
    setDeletingId(null);
  };

  const columns: ColumnDef<PackageListItem>[] = useMemo(
    () => [
      {
        key: "organisationCode",
        label: "Organisation",
        type: "readonly",
        getValue: (row) => row.organisationCode ?? "",
        width: "w-[6rem]",
      },
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
      ...(canDelete
        ? [
            {
              key: "actions",
              label: "",
              type: "custom" as const,
              getValue: () => "",
              width: "w-[3rem]",
              renderCell: (row: PackageListItem) => (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      disabled={deletingId === row.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete package?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete package {row.packageNumber} from {row.shipmentCode || "production"}. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deletingId === row.id ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ),
            },
          ]
        : []),
    ],
    [canDelete, deletingId]
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

  if (localPackages.length === 0) {
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
        rows={localPackages}
        getRowKey={(row) => row.id}
        readOnly
        collapseStorageKey="inventory-packages-collapsed"
        onDisplayRowsChange={handleDisplayRowsChange}
      />
    </div>
  );
}
