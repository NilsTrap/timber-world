"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, CardContent } from "@timber/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import { getOutgoingShipments, getIncomingShipments } from "../actions/getOrgShipments";
import type { ShipmentListItem, ShipmentStatus } from "../types";
import { formatDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface OrgShipmentTabsProps {
  activeTab: "outgoing" | "incoming";
  onTabChange: (tab: "outgoing" | "incoming") => void;
}

/**
 * Status badge colors
 */
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

/**
 * OrgShipmentTabs
 *
 * Displays shipment table content for the active tab (outgoing or incoming).
 * Note: This component does NOT render its own tab controls - the parent component
 * (ShipmentsPageContent) handles tab switching. This component only renders the
 * table content for the currently active tab.
 */
export function OrgShipmentTabs({ activeTab }: OrgShipmentTabsProps) {
  const router = useRouter();
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    const result = activeTab === "outgoing"
      ? await getOutgoingShipments()
      : await getIncomingShipments();
    if (result.success) {
      setShipments(result.data);
    }
    setLoading(false);
  }, [activeTab]);

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

  const isOutgoing = activeTab === "outgoing";

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No {isOutgoing ? "outgoing" : "incoming"} shipments yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>{isOutgoing ? "To" : "From"}</TableHead>
                <TableHead className="text-right">Packages</TableHead>
                <TableHead className="text-right">Volume m³</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>{isOutgoing ? "Date" : "Submitted"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((shipment) => (
                <TableRow
                  key={shipment.id}
                  className={`cursor-pointer hover:bg-muted/50 ${
                    !isOutgoing && shipment.status === "pending" ? "bg-yellow-50" : ""
                  }`}
                  onClick={() => handleRowClick(shipment.id)}
                >
                  <TableCell className="font-medium">{shipment.shipmentCode}</TableCell>
                  <TableCell>
                    {isOutgoing
                      ? `${shipment.toOrganisationCode} - ${shipment.toOrganisationName}`
                      : `${shipment.fromOrganisationCode} - ${shipment.fromOrganisationName}`}
                  </TableCell>
                  <TableCell className="text-right">{shipment.packageCount}</TableCell>
                  <TableCell className="text-right">{formatVolume(shipment.totalVolumeM3)}</TableCell>
                  <TableCell>
                    <ShipmentStatusBadge status={shipment.status} />
                  </TableCell>
                  <TableCell>
                    {!isOutgoing && shipment.submittedAt
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
  );
}
