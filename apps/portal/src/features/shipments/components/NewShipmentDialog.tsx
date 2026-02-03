"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Label,
} from "@timber/ui";
import { createShipmentDraft, getShipmentDestinations } from "../actions";
import type { OrganisationOption } from "../types";

interface NewShipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog to quickly create a new shipment draft.
 * User selects destination org, draft is created immediately, then navigates to edit page.
 */
export function NewShipmentDialog({ open, onOpenChange }: NewShipmentDialogProps) {
  const router = useRouter();
  const [destinations, setDestinations] = useState<OrganisationOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Load destinations when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setSelectedOrgId("");
      getShipmentDestinations().then((result) => {
        if (result.success) {
          setDestinations(result.data);
        } else {
          toast.error(result.error);
        }
        setIsLoading(false);
      });
    }
  }, [open]);

  const handleCreate = async () => {
    if (!selectedOrgId) {
      toast.error("Please select a destination");
      return;
    }

    setIsCreating(true);
    const result = await createShipmentDraft({ toOrganisationId: selectedOrgId });

    if (result.success) {
      toast.success(`Draft created: ${result.data.shipmentCode}`);
      onOpenChange(false);
      router.push(`/shipments/${result.data.id}`);
    } else {
      toast.error(result.error);
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Shipment</DialogTitle>
          <DialogDescription>
            Select the destination organization to create a new shipment draft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : destinations.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No destinations available
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="destination">Destination Organization</Label>
              <select
                id="destination"
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select destination...</option>
                {destinations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.code} - {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading || !selectedOrgId || isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Draft"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
