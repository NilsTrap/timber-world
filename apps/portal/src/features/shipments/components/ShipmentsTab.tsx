"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Button,
} from "@timber/ui";
import { ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { deleteShipment } from "../actions";
import type { ShipmentListItem } from "../types";

interface ShipmentsTabProps {
  shipments: ShipmentListItem[];
  /** If true, shows delete button for each row (Super Admin only) */
  canDelete?: boolean;
}

type SortKey = keyof ShipmentListItem;

function SortIcon({
  columnKey,
  sortConfig,
}: {
  columnKey: SortKey;
  sortConfig: { key: SortKey; direction: "asc" | "desc" };
}) {
  if (sortConfig.key !== columnKey) {
    return <ArrowUpDown className="h-3 w-3 ml-1 inline text-muted-foreground" />;
  }
  return sortConfig.direction === "asc" ? (
    <ArrowUp className="h-3 w-3 ml-1 inline text-primary" />
  ) : (
    <ArrowDown className="h-3 w-3 ml-1 inline text-primary" />
  );
}

export function ShipmentsTab({ shipments, canDelete = false }: ShipmentsTabProps) {
  const router = useRouter();
  const [localShipments, setLocalShipments] = useState(shipments);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({ key: "shipmentDate", direction: "desc" });

  const handleDelete = async (shipmentId: string) => {
    setDeletingId(shipmentId);
    const result = await deleteShipment(shipmentId);
    if (result.success) {
      toast.success("Shipment deleted");
      setLocalShipments((prev) => prev.filter((s) => s.id !== shipmentId));
    } else {
      toast.error(result.error);
    }
    setDeletingId(null);
  };

  const sortedShipments = useMemo(() => {
    return [...localShipments].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [localShipments, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  if (localShipments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-lg mb-4">
          No shipments recorded yet
        </p>
        <Button onClick={() => router.push("/admin/shipments")}>
          <Plus className="h-4 w-4 mr-2" />
          Create First Shipment
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort("shipmentCode")}
            >
              Shipment Code
              <SortIcon columnKey="shipmentCode" sortConfig={sortConfig} />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort("fromOrganisationCode")}
            >
              From
              <SortIcon columnKey="fromOrganisationCode" sortConfig={sortConfig} />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort("toOrganisationCode")}
            >
              To
              <SortIcon columnKey="toOrganisationCode" sortConfig={sortConfig} />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort("shipmentDate")}
            >
              Date
              <SortIcon columnKey="shipmentDate" sortConfig={sortConfig} />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none text-right"
              onClick={() => toggleSort("packageCount")}
            >
              Packages
              <SortIcon columnKey="packageCount" sortConfig={sortConfig} />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none text-right"
              onClick={() => toggleSort("totalVolumeM3")}
            >
              Total m³
              <SortIcon columnKey="totalVolumeM3" sortConfig={sortConfig} />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none text-right"
              onClick={() => toggleSort("transportCostEur")}
            >
              Transport €
              <SortIcon columnKey="transportCostEur" sortConfig={sortConfig} />
            </TableHead>
            {canDelete && (
              <TableHead className="w-[60px] text-center">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedShipments.map((shipment) => (
            <TableRow
              key={shipment.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/admin/inventory/${shipment.id}`)}
            >
              <TableCell className="font-mono font-medium">
                {shipment.shipmentCode}
              </TableCell>
              <TableCell>
                {shipment.fromOrganisationCode} - {shipment.fromOrganisationName}
              </TableCell>
              <TableCell>
                {shipment.toOrganisationCode} - {shipment.toOrganisationName}
              </TableCell>
              <TableCell>{formatDate(shipment.shipmentDate)}</TableCell>
              <TableCell className="text-right">{shipment.packageCount}</TableCell>
              <TableCell className="text-right">
                {shipment.totalVolumeM3.toFixed(3).replace(".", ",")}
              </TableCell>
              <TableCell className="text-right">
                {shipment.transportCostEur != null
                  ? shipment.transportCostEur.toFixed(2).replace(".", ",")
                  : "-"}
              </TableCell>
              {canDelete && (
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === shipment.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete shipment?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete shipment {shipment.shipmentCode} and all its packages. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(shipment.id)}
                          disabled={deletingId === shipment.id}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deletingId === shipment.id ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
