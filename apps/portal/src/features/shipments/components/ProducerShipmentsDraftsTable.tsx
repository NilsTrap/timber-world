"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Trash2 } from "lucide-react";
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
} from "@timber/ui";
import { formatDate } from "@/lib/utils";
import { deleteShipment } from "../actions";
import type { OrgShipmentListItem } from "../actions";

interface ProducerShipmentsDraftsTableProps {
  shipments: OrgShipmentListItem[];
}

export function ProducerShipmentsDraftsTable({ shipments }: ProducerShipmentsDraftsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (shipments.length === 0) {
    return null;
  }

  const handleDelete = async (shipmentId: string) => {
    setDeletingId(shipmentId);
    const result = await deleteShipment(shipmentId);
    if (result.success) {
      toast.success("Shipment draft deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setDeletingId(null);
  };

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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={deletingId === shipment.id}
                title="Delete draft"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete shipment draft?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete shipment &ldquo;{shipment.shipmentCode}&rdquo; and all its
                  packages. This action cannot be undone.
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
          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-yellow-100 text-yellow-800">
            Draft
          </span>
        </div>
      ))}
    </div>
  );
}
