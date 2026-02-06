"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@timber/ui";
import { createShipmentDraft, getShipmentDestinations } from "../actions";
import type { OrganisationOption } from "../types";

/**
 * Start Shipment Form
 *
 * Simple inline form with a destination org dropdown and "Start Shipment" button.
 * Creates a draft shipment and redirects to the shipment detail page.
 * Matches the production page's NewProductionForm pattern.
 */
export function StartShipmentForm() {
  const router = useRouter();
  const [destinations, setDestinations] = useState<OrganisationOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load destinations on mount
  useEffect(() => {
    getShipmentDestinations().then((result) => {
      if (result.success) {
        setDestinations(result.data);
      } else {
        toast.error(result.error);
      }
      setIsLoading(false);
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedOrgId) {
      toast.error("Please select a destination");
      return;
    }

    setIsSubmitting(true);

    const result = await createShipmentDraft({ toOrganisationId: selectedOrgId });

    if (!result.success) {
      toast.error(result.error);
      setIsSubmitting(false);
      return;
    }

    toast.success(`Shipment draft created: ${result.data.shipmentCode}`);
    router.push(`/shipments/${result.data.id}`);
  }, [selectedOrgId, router]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading destinations...</span>
      </div>
    );
  }

  if (destinations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No destination organizations available
      </p>
    );
  }

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1 max-w-xs">
        <label
          htmlFor="destination-select"
          className="block text-sm font-medium mb-1.5"
        >
          Destination
        </label>
        <select
          id="destination-select"
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          disabled={isSubmitting}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
        >
          <option value="">Select destination...</option>
          {destinations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!selectedOrgId || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          "Start Shipment"
        )}
      </Button>
    </div>
  );
}
