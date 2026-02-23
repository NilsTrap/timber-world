"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, orgHasFeature } from "@/lib/auth";
import type { Order, ActionResult } from "../types";

/**
 * Get Orders
 *
 * Fetches all orders with organisation details.
 * - Admins see all orders
 * - Producers see only orders for their organisation (if orders.view is enabled)
 *
 * @param options.includeCompleted - If false, excludes completed orders. Default: true
 */
export async function getOrders(options?: {
  includeCompleted?: boolean;
}): Promise<ActionResult<Order[]>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. For non-admin users, check if their org has orders feature enabled
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const hasOrdersFeature = await orgHasFeature(orgId, "orders.view");
    if (!hasOrdersFeature) {
      return {
        success: false,
        error: "Orders feature not enabled for your organisation",
        code: "FEATURE_DISABLED",
      };
    }
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const includeCompleted = options?.includeCompleted ?? true;

  // 3. Build query
  let query = client
    .from("orders")
    .select(
      `
      id,
      code,
      name,
      organisation_id,
      order_date,
      volume_m3,
      value_cents,
      currency,
      status,
      notes,
      created_by,
      created_at,
      updated_at,
      organisations!inner (
        code,
        name
      ),
      portal_users (
        name
      )
    `
    )
    .order("created_at", { ascending: false });

  // 4. Filter by status if needed
  if (!includeCompleted) {
    query = query.neq("status", "completed");
  }

  // 5. Filter by organisation for non-admin users
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    if (!orgId) {
      return {
        success: false,
        error: "No organisation assigned",
        code: "NO_ORGANISATION",
      };
    }
    query = query.eq("organisation_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch orders:", error);
    return {
      success: false,
      error: "Failed to fetch orders",
      code: "FETCH_FAILED",
    };
  }

  // 6. Transform to Order type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders: Order[] = (data || []).map((row: any) => ({
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    organisationId: row.organisation_id as string,
    organisationName: row.organisations?.name as string | undefined,
    organisationCode: row.organisations?.code as string | undefined,
    orderDate: row.order_date as string,
    volumeM3: row.volume_m3 as number | null,
    valueCents: row.value_cents as number | null,
    currency: row.currency as "EUR" | "GBP" | "USD",
    status: row.status as Order["status"],
    notes: row.notes as string | null,
    createdBy: row.created_by as string | null,
    createdByName: row.portal_users?.name as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));

  return {
    success: true,
    data: orders,
  };
}
