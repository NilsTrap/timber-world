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
import { ArrowUpDown, ArrowUp, ArrowDown, ArrowRight, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { OrgShipmentListItem } from "../actions";

interface ProducerShipmentsDraftsTableProps {
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

function DirectionBadge({ direction }: { direction: "outgoing" | "incoming" }) {
  if (direction === "outgoing") {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <ArrowRight className="h-3 w-3 mr-1" />
        Out
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
      <ArrowLeft className="h-3 w-3 mr-1" />
      In
    </Badge>
  );
}

export function ProducerShipmentsDraftsTable({ shipments }: ProducerShipmentsDraftsTableProps) {
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
    return null;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Direction</TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort("shipmentCode")}
            >
              Shipment Code
              <SortIcon columnKey="shipmentCode" sortConfig={sortConfig} />
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedShipments.map((shipment) => (
            <TableRow
              key={shipment.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleRowClick(shipment)}
            >
              <TableCell>
                <DirectionBadge direction={shipment.direction} />
              </TableCell>
              <TableCell className="font-mono font-medium">
                {shipment.shipmentCode || <span className="text-muted-foreground">Draft</span>}
              </TableCell>
              <TableCell>
                {shipment.toOrganisationCode} - {shipment.toOrganisationName}
              </TableCell>
              <TableCell>{formatDate(shipment.shipmentDate)}</TableCell>
              <TableCell className="text-right">{shipment.packageCount}</TableCell>
              <TableCell className="text-right">
                {shipment.totalVolumeM3.toFixed(3).replace(".", ",")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
