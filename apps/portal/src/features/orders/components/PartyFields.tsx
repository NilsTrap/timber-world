"use client";

import {
  Label,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@timber/ui";
import type { OrderPartyOptions } from "../actions/getOrderPartyOptions";

export interface PartyValue {
  customerOrganisationId: string | null;
  sellerOrganisationId: string | null;
}

/**
 * H1 · Shared Customer (buyer) + Manufacturer (seller) picker, used by the
 * new-deal dialog and the draft Parties card. It mirrors the SERVER slot logic
 * exactly (resolvePartySlots / createOrder): an admin picks both slots freely; a
 * non-admin whose org is a Manufacturer picks only the Customer (their own org is
 * the forced seller); a non-admin customer-side user picks only the Manufacturer
 * (their own org is the forced customer). The forced slot is shown read-only so
 * the user sees who they are — the server, not this component, enforces it.
 *
 * UI labels follow the house convention: seller = "Manufacturer", customer =
 * "Customer" (CLAUDE.md party naming).
 */
export function PartyFields({
  partyOptions,
  value,
  onChange,
  lockedCustomerName,
  lockedSellerName,
}: {
  partyOptions: OrderPartyOptions;
  value: PartyValue;
  onChange: (patch: Partial<PartyValue>) => void;
  /** When a slot is ALREADY set on the deal it is locked (set-once, §3.1) — the
   *  server keeps the existing party — so render it read-only rather than an
   *  editable-but-ignored picker. Only the Parties card passes these. */
  lockedCustomerName?: string | null;
  lockedSellerName?: string | null;
}) {
  const pickCustomer = (partyOptions.isAdmin || partyOptions.userIsManufacturer) && lockedCustomerName == null;
  const pickManufacturer = (partyOptions.isAdmin || !partyOptions.userIsManufacturer) && lockedSellerName == null;
  const ownOrgLabel = partyOptions.userOrgName ?? "Your organisation";

  return (
    <div className="space-y-3">
      {/* Customer (buyer) */}
      <div className="space-y-1.5">
        <Label>Customer</Label>
        {lockedCustomerName != null ? (
          <p className="text-sm rounded-md border bg-muted/40 px-3 py-2">{lockedCustomerName} <span className="text-muted-foreground">(set)</span></p>
        ) : pickCustomer ? (
          partyOptions.customerOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No customers in your book yet — add one in CRM / Clients.
            </p>
          ) : (
            <Select
              value={value.customerOrganisationId ?? ""}
              onValueChange={(v) => onChange({ customerOrganisationId: v || null })}
            >
              <SelectTrigger><SelectValue placeholder="Pick the customer" /></SelectTrigger>
              <SelectContent>
                {partyOptions.customerOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.code ? `${o.code} — ${o.name}` : o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        ) : (
          <p className="text-sm rounded-md border bg-muted/40 px-3 py-2">{ownOrgLabel} <span className="text-muted-foreground">(you)</span></p>
        )}
      </div>

      {/* Manufacturer (seller) */}
      <div className="space-y-1.5">
        <Label>Manufacturer</Label>
        {lockedSellerName != null ? (
          <p className="text-sm rounded-md border bg-muted/40 px-3 py-2">{lockedSellerName} <span className="text-muted-foreground">(set)</span></p>
        ) : pickManufacturer ? (
          partyOptions.manufacturerOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No manufacturers in your book yet — add one in CRM.
            </p>
          ) : (
            <Select
              value={value.sellerOrganisationId ?? ""}
              onValueChange={(v) => onChange({ sellerOrganisationId: v || null })}
            >
              <SelectTrigger><SelectValue placeholder="Pick the manufacturer" /></SelectTrigger>
              <SelectContent>
                {partyOptions.manufacturerOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.code ? `${o.code} — ${o.name}` : o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        ) : (
          <p className="text-sm rounded-md border bg-muted/40 px-3 py-2">{ownOrgLabel} <span className="text-muted-foreground">(you)</span></p>
        )}
      </div>
    </div>
  );
}

/**
 * Which counterparty slot must the current user pick for a valid submission?
 * (The forced own-org slot is filled server-side, so it never blocks submit.)
 * Returns true when every required pick is satisfied.
 */
export function partyPickComplete(partyOptions: OrderPartyOptions, value: PartyValue): boolean {
  const needCustomer = partyOptions.isAdmin || partyOptions.userIsManufacturer;
  const needManufacturer = partyOptions.isAdmin || !partyOptions.userIsManufacturer;
  if (needCustomer && !value.customerOrganisationId) return false;
  if (needManufacturer && !value.sellerOrganisationId) return false;
  return true;
}
