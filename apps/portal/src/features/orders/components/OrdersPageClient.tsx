"use client";

import { OrdersOverview } from "./OrdersOverview";

interface OrdersPageClientProps {
  isAdmin: boolean;
  canSelectCustomer: boolean;
  userOrganisationId: string | null;
  userOrganisationName: string | null;
  visibleTabs?: string[];
}

/**
 * Orders is now a single minimalistic OVERVIEW — the old List / Prices / Sales /
 * Production / Analytics tabs are gone (they encoded per-user-group visibility,
 * which belongs to access groups in Settings, not tabs). The operational order
 * content still lives on the order detail's "Order" tab.
 */
export function OrdersPageClient(props: OrdersPageClientProps) {
  // F1: the owner-only pairing hint needs isAdmin (§6.2 the full spine overview is
  // for the owner); the direction badge is viewer-relative (party comparison,
  // §2.5) so a counterparty login needs its own org id to see Sell/Buy from its
  // seat. Admins have no single house org → they fall back to the deal's own kind.
  return (
    <OrdersOverview isAdmin={props.isAdmin} userOrgId={props.isAdmin ? null : props.userOrganisationId} />
  );
}
