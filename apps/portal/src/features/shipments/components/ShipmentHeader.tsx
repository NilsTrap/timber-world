"use client";

import { useEffect, useState } from "react";
import { Label, Input } from "@timber/ui";
import { Loader2 } from "lucide-react";
import { getShipmentCodePreview } from "../actions";
import type { OrganisationOption } from "../types";

interface ShipmentHeaderProps {
  organisations: OrganisationOption[];
  /** Optional separate list for "to" dropdown (trading partners). If not provided, uses organisations. */
  toOrganisations?: OrganisationOption[];
  fromOrganisationId: string;
  toOrganisationId: string;
  shipmentDate: string;
  transportCostEur: string;
  onFromOrganisationChange: (id: string) => void;
  onToOrganisationChange: (id: string) => void;
  onDateChange: (date: string) => void;
  onTransportCostChange: (value: string) => void;
  /** Lock the From organisation (for producer mode) */
  lockedFromOrganisation?: OrganisationOption | null;
}

/**
 * Shipment Header Component
 *
 * From/To organisation dropdowns, date picker, and auto-generated shipment code display.
 * Fetches shipment code preview when both organisations are selected.
 */
export function ShipmentHeader({
  organisations,
  toOrganisations,
  fromOrganisationId,
  toOrganisationId,
  shipmentDate,
  transportCostEur,
  onFromOrganisationChange,
  onToOrganisationChange,
  onDateChange,
  onTransportCostChange,
  lockedFromOrganisation,
}: ShipmentHeaderProps) {
  const isFromLocked = !!lockedFromOrganisation;
  // Use toOrganisations if provided, otherwise filter from organisations
  const toOrgList = toOrganisations ?? organisations.filter((org) => org.id !== fromOrganisationId);
  const [shipmentCode, setShipmentCode] = useState<string>("");
  const [isLoadingCode, setIsLoadingCode] = useState(false);

  // Auto-fetch shipment code when both organisations are selected
  useEffect(() => {
    if (fromOrganisationId && toOrganisationId && fromOrganisationId !== toOrganisationId) {
      setIsLoadingCode(true);
      getShipmentCodePreview(fromOrganisationId, toOrganisationId).then((result) => {
        if (result.success) {
          setShipmentCode(result.data.code);
        } else {
          setShipmentCode("");
        }
        setIsLoadingCode(false);
      });
    } else {
      setShipmentCode("");
    }
  }, [fromOrganisationId, toOrganisationId]);

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold mb-4">Shipment Details</h2>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* From Organisation */}
        <div className="space-y-2">
          <Label htmlFor="from-organisation">
            From Organisation
          </Label>
          {isFromLocked ? (
            <div className="flex items-center h-9 px-3 rounded-md border bg-muted text-sm">
              {lockedFromOrganisation.code} - {lockedFromOrganisation.name}
            </div>
          ) : (
            <select
              id="from-organisation"
              value={fromOrganisationId}
              onChange={(e) => onFromOrganisationChange(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select...</option>
              {organisations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.code} - {org.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* To Organisation */}
        <div className="space-y-2">
          <Label htmlFor="to-organisation">
            To Organisation
          </Label>
          <select
            id="to-organisation"
            value={toOrganisationId}
            onChange={(e) => onToOrganisationChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            disabled={!fromOrganisationId}
          >
            <option value="">
              {!fromOrganisationId ? "Select From first..." : "Select..."}
            </option>
            {toOrgList.map((org) => (
              <option key={org.id} value={org.id}>
                {org.code} - {org.name}
              </option>
            ))}
          </select>
          {fromOrganisationId && toOrganisationId && fromOrganisationId === toOrganisationId && (
            <p className="text-sm text-destructive">From and To must be different</p>
          )}
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="shipment-date">
            Date
          </Label>
          <Input
            id="shipment-date"
            type="date"
            value={shipmentDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>

        {/* Transport Cost */}
        <div className="space-y-2">
          <Label htmlFor="transport-cost">
            Transport Cost (EUR)
          </Label>
          <Input
            id="transport-cost"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={transportCostEur.replace(".", ",")}
            onChange={(e) => onTransportCostChange(e.target.value.replace(",", "."))}
            onBlur={() => {
              if (transportCostEur) {
                const num = parseFloat(transportCostEur);
                if (!isNaN(num)) {
                  onTransportCostChange(num.toFixed(2));
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        </div>

        {/* Shipment Code (auto-generated, read-only) */}
        <div className="space-y-2">
          <Label htmlFor="shipment-code">Shipment Code</Label>
          <div className="flex items-center h-9 px-3 rounded-md border bg-muted text-sm font-mono">
            {isLoadingCode ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : shipmentCode ? (
              shipmentCode
            ) : (
              <span className="text-muted-foreground">Auto-generated</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
