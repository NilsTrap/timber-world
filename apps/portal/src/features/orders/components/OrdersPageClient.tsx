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
export function OrdersPageClient(_props: OrdersPageClientProps) {
  return <OrdersOverview />;
}
