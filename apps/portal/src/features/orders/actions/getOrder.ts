"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import type { Order, ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Get a single order by ID with organisation details.
 */
export async function getOrder(orderId: string): Promise<ActionResult<Order>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isValidUUID(orderId)) {
    return { success: false, error: "Invalid order ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data, error } = await client
    .from("orders")
    .select(`
      id, code, name, organisation_id, order_date,
      volume_m3, value_cents, currency, status, notes,
      created_by, created_at, updated_at,
      organisations (code, name),
      portal_users (name)
    `)
    .eq("id", orderId)
    .single();

  if (error || !data) {
    return { success: false, error: "Order not found", code: "NOT_FOUND" };
  }

  // Non-admin: check org match and feature
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    if (data.organisation_id !== orgId) {
      return { success: false, error: "Permission denied", code: "FORBIDDEN" };
    }
    const hasModule = await orgHasModule(orgId, "orders.view");
    if (!hasModule) {
      return { success: false, error: "Orders feature not enabled", code: "FEATURE_DISABLED" };
    }
  }

  const order: Order = {
    id: data.id,
    code: data.code,
    name: data.name,
    organisationId: data.organisation_id,
    organisationName: data.organisations?.name,
    organisationCode: data.organisations?.code,
    orderDate: data.order_date,
    volumeM3: data.volume_m3,
    valueCents: data.value_cents,
    currency: data.currency,
    status: data.status,
    notes: data.notes,
    createdBy: data.created_by,
    createdByName: data.portal_users?.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  return { success: true, data: order };
}
