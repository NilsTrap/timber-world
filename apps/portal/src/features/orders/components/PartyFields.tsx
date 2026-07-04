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
 * L2 · Shared Customer (buyer) + Trader (seller) picker, used by the new-deal
 * dialog and the draft Parties card. It mirrors the SERVER slot logic exactly
 * (resolvePartySlots / createOrder):
 *   - an admin picks both slots freely (Trader = any is_trader org);
 *   - a salesperson (bound to trader org[s]) picks the Customer, and the Trader
 *     is their own trader org — locked when they have exactly one, a dropdown of
 *     their traders when they have several;
 *   - a customer-side user picks the Trader (their own org is the forced buyer).
 * The forced/locked slot is shown read-only — the server, not this component,
 * enforces it.
 *
 * The seller slot's user label is "Trader" (the house's own trading company);
 * the DB column stays seller_organisation_id (CLAUDE.md party naming).
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
  // Seller-side = a salesperson bound to trader org(s), or a legacy
  // manufacturer-side org (pre-trader-flag). Such a user's Trader is their own
  // org; they pick the Customer. Everyone else picks the Trader.
  const isSellerSide = partyOptions.userIsTrader || partyOptions.userIsManufacturer;
  const pickCustomer = (partyOptions.isAdmin || isSellerSide) && lockedCustomerName == null;
  const pickTrader =
    lockedSellerName == null &&
    (partyOptions.isAdmin || !isSellerSide || partyOptions.userTraderOrgs.length > 1);
  const ownOrgLabel = partyOptions.userOrgName ?? "Your organisation";
  // The read-only trader label when a single trader is bound to the salesperson.
  const soleTrader = partyOptions.userTraderOrgs.length === 1 ? partyOptions.userTraderOrgs[0] : null;
  const soleTraderLabel = soleTrader ? (soleTrader.code ? `${soleTrader.code} — ${soleTrader.name}` : soleTrader.name) : ownOrgLabel;

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

      {/* Trader (seller) */}
      <div className="space-y-1.5">
        <Label>Trader</Label>
        {lockedSellerName != null ? (
          <p className="text-sm rounded-md border bg-muted/40 px-3 py-2">{lockedSellerName} <span className="text-muted-foreground">(set)</span></p>
        ) : pickTrader ? (
          partyOptions.traderOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No traders available yet.
            </p>
          ) : (
            <Select
              value={value.sellerOrganisationId ?? ""}
              onValueChange={(v) => onChange({ sellerOrganisationId: v || null })}
            >
              <SelectTrigger><SelectValue placeholder="Pick the trader" /></SelectTrigger>
              <SelectContent>
                {partyOptions.traderOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.code ? `${o.code} — ${o.name}` : o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        ) : (
          <p className="text-sm rounded-md border bg-muted/40 px-3 py-2">{soleTraderLabel} <span className="text-muted-foreground">(you)</span></p>
        )}
      </div>
    </div>
  );
}

/**
 * Which counterparty slot must the current user pick for a valid submission?
 * (An auto-filled / forced slot is completed server-side, so it never blocks
 * submit.) Returns true when every required pick is satisfied.
 */
export function partyPickComplete(partyOptions: OrderPartyOptions, value: PartyValue): boolean {
  const isSellerSide = partyOptions.userIsTrader || partyOptions.userIsManufacturer;
  const needCustomer = partyOptions.isAdmin || isSellerSide;
  const needTrader =
    partyOptions.isAdmin || !isSellerSide || partyOptions.userTraderOrgs.length > 1;
  if (needCustomer && !value.customerOrganisationId) return false;
  if (needTrader && !value.sellerOrganisationId) return false;
  return true;
}
