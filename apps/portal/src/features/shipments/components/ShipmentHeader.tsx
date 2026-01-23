"use client";

import { useEffect, useState } from "react";
import { Label, Input } from "@timber/ui";
import { Loader2 } from "lucide-react";
import { getShipmentCodePreview } from "../actions";
import type { OrganisationOption } from "../types";

interface ShipmentHeaderProps {
  organisations: OrganisationOption[];
  fromPartyId: string;
  toPartyId: string;
  shipmentDate: string;
  transportCostEur: string;
  onFromPartyChange: (id: string) => void;
  onToPartyChange: (id: string) => void;
  onDateChange: (date: string) => void;
  onTransportCostChange: (value: string) => void;
}

/**
 * Shipment Header Component
 *
 * From/To organisation dropdowns, date picker, and auto-generated shipment code display.
 * Fetches shipment code preview when both organisations are selected.
 */
export function ShipmentHeader({
  organisations,
  fromPartyId,
  toPartyId,
  shipmentDate,
  transportCostEur,
  onFromPartyChange,
  onToPartyChange,
  onDateChange,
  onTransportCostChange,
}: ShipmentHeaderProps) {
  const [shipmentCode, setShipmentCode] = useState<string>("");
  const [isLoadingCode, setIsLoadingCode] = useState(false);

  // Auto-fetch shipment code when both organisations are selected
  useEffect(() => {
    if (fromPartyId && toPartyId && fromPartyId !== toPartyId) {
      setIsLoadingCode(true);
      getShipmentCodePreview(fromPartyId, toPartyId).then((result) => {
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
  }, [fromPartyId, toPartyId]);

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold mb-4">Shipment Details</h2>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* From Organisation */}
        <div className="space-y-2">
          <Label htmlFor="from-party">
            From Organisation
          </Label>
          <select
            id="from-party"
            value={fromPartyId}
            onChange={(e) => onFromPartyChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Select...</option>
            {organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.code} - {org.name}
              </option>
            ))}
          </select>
        </div>

        {/* To Organisation */}
        <div className="space-y-2">
          <Label htmlFor="to-party">
            To Organisation
          </Label>
          <select
            id="to-party"
            value={toPartyId}
            onChange={(e) => onToPartyChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Select...</option>
            {organisations
              .filter((org) => org.id !== fromPartyId)
              .map((org) => (
                <option key={org.id} value={org.id}>
                  {org.code} - {org.name}
                </option>
              ))}
          </select>
          {fromPartyId && toPartyId && fromPartyId === toPartyId && (
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
