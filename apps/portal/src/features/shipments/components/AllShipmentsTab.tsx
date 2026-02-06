"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  Badge,
  cn,
} from "@timber/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import { getAllShipments, type ShipmentFilters } from "../actions/getAllShipments";
import type { ShipmentListItem, ShipmentStatus } from "../types";
import { formatDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface AllShipmentsTabProps {
  organizations: Array<{ id: string; code: string; name: string }>;
}

const statusColors: Record<ShipmentStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const statusLabels: Record<ShipmentStatus, string> = {
  draft: "Draft",
  pending: "On The Way",
  accepted: "Accepted",
  completed: "Completed",
  rejected: "Rejected",
};

function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <Badge className={statusColors[status]} variant="secondary">
      {statusLabels[status]}
    </Badge>
  );
}

export function AllShipmentsTab({ organizations }: AllShipmentsTabProps) {
  const router = useRouter();
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ShipmentFilters>({
    status: "all",
  });

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    const result = await getAllShipments(filters);
    if (result.success) {
      setShipments(result.data);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const formatVolume = (vol: number) => {
    return vol.toLocaleString("de-DE", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  };

  const handleRowClick = (shipmentId: string) => {
    router.push(`/shipments/${shipmentId}`);
  };

  const pendingCount = shipments.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium">From Organization</label>
          <select
            value={filters.fromOrgId ?? ""}
            onChange={(e) => setFilters({ ...filters, fromOrgId: e.target.value || undefined })}
            className={cn(
              "w-48 rounded-md border bg-background px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-ring"
            )}
          >
            <option value="">All</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.code} - {org.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">To Organization</label>
          <select
            value={filters.toOrgId ?? ""}
            onChange={(e) => setFilters({ ...filters, toOrgId: e.target.value || undefined })}
            className={cn(
              "w-48 rounded-md border bg-background px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-ring"
            )}
          >
            <option value="">All</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.code} - {org.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Status</label>
          <select
            value={filters.status ?? "all"}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as ShipmentStatus | "all" })}
            className={cn(
              "w-40 rounded-md border bg-background px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-ring"
            )}
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="pending">On The Way</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* On The Way count info */}
      {pendingCount > 0 && filters.status === "all" && (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-yellow-700">{pendingCount} on the way</span> shipment(s) awaiting acceptance
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : shipments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No shipments found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Packages</TableHead>
                  <TableHead className="text-right">Volume m³</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((shipment) => (
                  <TableRow
                    key={shipment.id}
                    className={`cursor-pointer hover:bg-muted/50 ${
                      shipment.status === "pending" ? "bg-yellow-50" : ""
                    }`}
                    onClick={() => handleRowClick(shipment.id)}
                  >
                    <TableCell className="font-medium">{shipment.shipmentCode}</TableCell>
                    <TableCell>
                      {shipment.fromOrganisationCode} - {shipment.fromOrganisationName}
                    </TableCell>
                    <TableCell>
                      {shipment.toOrganisationCode} - {shipment.toOrganisationName}
                    </TableCell>
                    <TableCell className="text-right">{shipment.packageCount}</TableCell>
                    <TableCell className="text-right">{formatVolume(shipment.totalVolumeM3)}</TableCell>
                    <TableCell>
                      <ShipmentStatusBadge status={shipment.status} />
                    </TableCell>
                    <TableCell>
                      {shipment.submittedAt
                        ? formatDate(shipment.submittedAt)
                        : formatDate(shipment.shipmentDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
