"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
} from "@timber/ui";
import { deleteShipment } from "../actions";

interface DeleteShipmentDraftButtonProps {
  shipmentId: string;
  shipmentCode: string;
}

/**
 * Client component button that deletes a shipment draft
 * after user confirmation via AlertDialog.
 */
export function DeleteShipmentDraftButton({ shipmentId, shipmentCode }: DeleteShipmentDraftButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleDelete = async () => {
    setIsPending(true);
    const result = await deleteShipment(shipmentId);
    if (result.success) {
      toast.success("Shipment draft deleted");
      router.push("/shipments");
    } else {
      toast.error(result.error);
      setIsPending(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          <Trash2 className="h-4 w-4 mr-1" />
          {isPending ? "Deleting..." : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete shipment draft?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete shipment &ldquo;{shipmentCode}&rdquo; and all its
            packages. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
