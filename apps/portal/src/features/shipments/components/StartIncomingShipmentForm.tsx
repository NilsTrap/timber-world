"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@timber/ui";
import { getExternalTradingPartners, createIncomingShipmentDraft } from "../actions";
import type { OrganisationOption } from "../types";

/**
 * Start Incoming Shipment Form
 *
 * Form to create a new incoming shipment from an external supplier.
 * Shows only external trading partners as source options.
 */
export function StartIncomingShipmentForm() {
  const router = useRouter();
  const [sources, setSources] = useState<OrganisationOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load external partners on mount
  useEffect(() => {
    getExternalTradingPartners().then((result) => {
      if (result.success) {
        setSources(result.data);
      } else {
        toast.error(result.error);
      }
      setIsLoading(false);
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedOrgId) {
      toast.error("Please select a source");
      return;
    }

    setIsSubmitting(true);

    const result = await createIncomingShipmentDraft({ fromOrganisationId: selectedOrgId });

    if (!result.success) {
      toast.error(result.error);
      setIsSubmitting(false);
      return;
    }

    toast.success(`Incoming shipment draft created: ${result.data.shipmentCode}`);
    router.push(`/shipments/${result.data.id}`);
  }, [selectedOrgId, router]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading suppliers...</span>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No external suppliers configured. Add external trading partners in Admin to enable incoming shipments.
      </p>
    );
  }

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1 max-w-xs">
        <label
          htmlFor="source-select"
          className="block text-sm font-medium mb-1.5"
        >
          Source (Supplier)
        </label>
        <select
          id="source-select"
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          disabled={isSubmitting}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
        >
          <option value="">Select supplier...</option>
          {sources.map((org) => (
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
          "Start Incoming"
        )}
      </Button>
    </div>
  );
}
