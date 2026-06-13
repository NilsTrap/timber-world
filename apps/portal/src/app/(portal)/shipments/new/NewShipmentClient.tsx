"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Label,
  cn,
} from "@timber/ui";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createShipmentDraft, getShipmentDestinations } from "@/features/shipments/actions/createShipmentDraft";
import { toast } from "sonner";

interface OrganizationOption {
  id: string;
  code: string;
  name: string;
}

/**
 * New Shipment Page (client body)
 *
 * Allows organization users to create a new shipment draft
 * to another organization. Rendered by the server-gated page.tsx.
 */
export function NewShipmentClient() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toOrganisationId, setToOrganisationId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    async function fetchOrganizations() {
      const result = await getShipmentDestinations();
      if (result.success) {
        setOrganizations(result.data);
      } else {
        toast.error(result.error);
      }
      setLoading(false);
    }
    fetchOrganizations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!toOrganisationId) {
      toast.error("Please select a destination organization");
      return;
    }

    setCreating(true);

    const result = await createShipmentDraft({
      toOrganisationId,
      notes: notes || undefined,
    });

    if (result.success) {
      toast.success(`Shipment ${result.data.shipmentCode} created`);
      router.push(`/shipments/${result.data.id}`);
    } else {
      toast.error(result.error);
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Shipment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a shipment to send inventory to another organization
          </p>
        </div>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Shipment Details</CardTitle>
          <CardDescription>
            Select the destination organization and add any notes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="destination">Destination Organization *</Label>
              <select
                id="destination"
                value={toOrganisationId}
                onChange={(e) => setToOrganisationId(e.target.value)}
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "cursor-pointer"
                )}
              >
                <option value="">Select destination</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.code} - {org.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Add any notes about this shipment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !toOrganisationId}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Draft"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
