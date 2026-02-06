"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
  Button,
} from "@timber/ui";
import { ArrowUpDown, ArrowUp, ArrowDown, Plus, ArrowRight, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { OrgShipmentListItem } from "../actions";

interface ProducerShipmentsTabProps {
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
    draft: "secondary",
    pending: "outline",
    accepted: "default",
    completed: "default",
    rejected: "destructive",
  };

  const labels: Record<string, string> = {
    draft: "Draft",
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

function DirectionBadge({ direction }: { direction: "outgoing" | "incoming" }) {
  if (direction === "outgoing") {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <ArrowRight className="h-3 w-3 mr-1" />
        Outgoing
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
      <ArrowLeft className="h-3 w-3 mr-1" />
      Incoming
    </Badge>
  );
}

export function ProducerShipmentsTab({ shipments }: ProducerShipmentsTabProps) {
  const router = useRouter();
  const [directionFilter, setDirectionFilter] = useState<"all" | "outgoing" | "incoming">("all");
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({ key: "shipmentDate", direction: "desc" });

  const filteredShipments = useMemo(() => {
    if (directionFilter === "all") return shipments;
    return shipments.filter((s) => s.direction === directionFilter);
  }, [shipments, directionFilter]);

  const sortedShipments = useMemo(() => {
    return [...filteredShipments].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [filteredShipments, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleRowClick = (shipment: OrgShipmentListItem) => {
    // Navigate to shipment detail - use org shipment detail route
    router.push(`/shipments/${shipment.id}`);
  };

  if (shipments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-lg mb-4">
          No shipments recorded yet
        </p>
        <Button onClick={() => router.push("/shipments?tab=new")}>
          <Plus className="h-4 w-4 mr-2" />
          Create First Shipment
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Direction Filter */}
      <div className="flex gap-2">
        <Button
          variant={directionFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setDirectionFilter("all")}
        >
          All ({shipments.length})
        </Button>
        <Button
          variant={directionFilter === "outgoing" ? "default" : "outline"}
          size="sm"
          onClick={() => setDirectionFilter("outgoing")}
        >
          <ArrowRight className="h-3 w-3 mr-1" />
          Outgoing ({shipments.filter((s) => s.direction === "outgoing").length})
        </Button>
        <Button
          variant={directionFilter === "incoming" ? "default" : "outline"}
          size="sm"
          onClick={() => setDirectionFilter("incoming")}
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Incoming ({shipments.filter((s) => s.direction === "incoming").length})
        </Button>
      </div>

      {/* Shipments Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Direction</TableHead>
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
                <TableCell>
                  <DirectionBadge direction={shipment.direction} />
                </TableCell>
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

      {filteredShipments.length === 0 && shipments.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No {directionFilter} shipments found
        </div>
      )}
    </div>
  );
}
