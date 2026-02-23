"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Delete Order
 *
 * Deletes an order. Only draft orders can be deleted.
 * Admin only endpoint.
 */
export async function deleteOrder(
  orderId: string
): Promise<ActionResult<{ deleted: true }>> {
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

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // 4. Check order exists and is a draft
  const { data: order, error: fetchError } = await client
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    return {
      success: false,
      error: "Order not found",
      code: "NOT_FOUND",
    };
  }

  if (order.status !== "draft") {
    return {
      success: false,
      error: "Only draft orders can be deleted",
      code: "INVALID_STATUS",
    };
  }

  // 5. Delete the order (order_shipments will cascade delete)
  const { error: deleteError } = await client
    .from("orders")
    .delete()
    .eq("id", orderId);

  if (deleteError) {
    console.error("Failed to delete order:", deleteError);
    return {
      success: false,
      error: "Failed to delete order",
      code: "DELETE_FAILED",
    };
  }

  return {
    success: true,
    data: { deleted: true },
  };
}
