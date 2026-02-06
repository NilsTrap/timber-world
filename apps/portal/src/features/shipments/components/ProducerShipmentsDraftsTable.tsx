"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { OrgShipmentListItem } from "../actions";

interface ProducerShipmentsDraftsTableProps {
  shipments: OrgShipmentListItem[];
}

export function ProducerShipmentsDraftsTable({ shipments }: ProducerShipmentsDraftsTableProps) {
  if (shipments.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      {shipments.map((shipment) => (
        <div
          key={shipment.id}
          className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm"
        >
          <Link
            href={`/shipments/${shipment.id}`}
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-70 transition-opacity"
          >
            <Package className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {shipment.shipmentCode || "Draft"}
                <span className="ml-3 text-muted-foreground font-normal">
                  {shipment.fromOrganisationName} → {shipment.toOrganisationName}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(shipment.shipmentDate)} &middot; {shipment.packageCount} packages &middot; {shipment.totalVolumeM3.toFixed(3).replace(".", ",")} m³
              </p>
            </div>
          </Link>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-yellow-100 text-yellow-800">
            Draft
          </span>
        </div>
      ))}
    </div>
  );
}
