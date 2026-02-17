"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
} from "@timber/ui";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { OrgShipmentListItem } from "../actions";

interface ProducerShipmentsCompletedTableProps {
  shipments: OrgShipmentListItem[];
}

type SortKey = keyof OrgShipmentListItem;

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

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "outline",
    accepted: "default",
    completed: "default",
    rejected: "destructive",
  };

  const labels: Record<string, string> = {
    pending: "On The Way",
    accepted: "Accepted",
    completed: "Completed",
    rejected: "Rejected",
  };

  return (
    <Badge variant={variants[status] ?? "secondary"}>
      {labels[status] ?? status}
    </Badge>
  );
}

export function ProducerShipmentsCompletedTable({ shipments }: ProducerShipmentsCompletedTableProps) {
  const router = useRouter();
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({ key: "shipmentDate", direction: "desc" });

  const sortedShipments = useMemo(() => {
    return [...shipments].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [shipments, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleRowClick = (shipment: OrgShipmentListItem) => {
    router.push(`/shipments/${shipment.id}`);
  };

  if (shipments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
        <p>No completed shipments yet</p>
        <p className="text-sm mt-1">Submitted shipments will appear here</p>
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
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedShipments.map((shipment) => (
            <TableRow
              key={shipment.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleRowClick(shipment)}
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
              <TableCell>
                <StatusBadge status={shipment.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
