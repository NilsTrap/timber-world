"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from "@timber/ui";
import { Loader2, Truck } from "lucide-react";
import { submitShipmentForAcceptance } from "../actions/submitShipment";
import { toast } from "sonner";

interface SubmitShipmentDialogProps {
  shipmentId: string;
  toOrgName: string;
  packageCount: number;
  totalVolume: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function SubmitShipmentDialog({
  shipmentId,
  toOrgName,
  packageCount,
  totalVolume,
  onClose,
  onSuccess,
}: SubmitShipmentDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const formatVolume = (vol: number) => {
    return vol.toLocaleString("de-DE", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await submitShipmentForAcceptance(shipmentId);
    if (result.success) {
      toast.success("Shipment is on the way");
      onSuccess();
    } else {
      toast.error(result.error);
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Shipment?</DialogTitle>
          <DialogDescription>
            The receiving organization will be notified and must accept this shipment
            before inventory is transferred.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Destination:</span>
              <p className="font-medium">{toOrgName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Packages:</span>
              <p className="font-medium">{packageCount}</p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Total Volume:</span>
              <p className="font-medium">{formatVolume(totalVolume)} m³</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Truck className="h-4 w-4 mr-2" />
                On The Way
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
