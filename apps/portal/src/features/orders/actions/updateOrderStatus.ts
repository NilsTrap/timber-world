"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { updateOrderStatusSchema } from "../schemas";
import type { Order, OrderStatus, ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Update Order Status
 *
 * Changes the status of an order.
 * Admin only endpoint.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<ActionResult<Order>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Check admin role
  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  // 3. Validate order ID
  if (!isValidUUID(orderId)) {
    return {
      success: false,
      error: "Invalid order ID",
      code: "INVALID_ID",
    };
  }

  // 4. Validate status
  const parsed = updateOrderStatusSchema.safeParse({ status: newStatus });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid status",
      code: "VALIDATION_ERROR",
    };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // 5. Update status
  const { data, error } = await client
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", orderId)
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
      organisations (
        code,
        name
      )
    `
    )
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return {
        success: false,
        error: "Order not found",
        code: "NOT_FOUND",
      };
    }
    console.error("Failed to update order status:", error);
    return {
      success: false,
      error: "Failed to update order status",
      code: "UPDATE_FAILED",
    };
  }

  // 6. Transform and return
  const order: Order = {
    id: data.id as string,
    code: data.code as string,
    name: data.name as string,
    organisationId: data.organisation_id as string,
    organisationName: data.organisations?.name as string | undefined,
    organisationCode: data.organisations?.code as string | undefined,
    orderDate: data.order_date as string,
    volumeM3: data.volume_m3 as number | null,
    valueCents: data.value_cents as number | null,
    currency: data.currency as "EUR" | "GBP" | "USD",
    status: data.status as Order["status"],
    notes: data.notes as string | null,
    createdBy: data.created_by as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };

  return {
    success: true,
    data: order,
  };
}
