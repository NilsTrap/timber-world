"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { updateOrderSchema } from "../schemas";
import type { Order, ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Update Order
 *
 * Updates an existing order.
 * Admin only endpoint.
 */
export async function updateOrder(
  orderId: string,
  input: {
    name?: string;
    organisationId?: string;
    orderDate?: string;
    volumeM3?: number | null;
    valueCents?: number | null;
    currency?: "EUR" | "GBP" | "USD";
    notes?: string | null;
  }
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

  // 4. Validate input with Zod
  const parsed = updateOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      code: "VALIDATION_ERROR",
    };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // 5. Build update object (snake_case for DB)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.organisationId !== undefined)
    updateData.organisation_id = parsed.data.organisationId;
  if (parsed.data.orderDate !== undefined)
    updateData.order_date = parsed.data.orderDate;
  if (parsed.data.volumeM3 !== undefined)
    updateData.volume_m3 = parsed.data.volumeM3;
  if (parsed.data.valueCents !== undefined)
    updateData.value_cents = parsed.data.valueCents;
  if (parsed.data.currency !== undefined)
    updateData.currency = parsed.data.currency;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  // 6. Update order
  const { data, error } = await client
    .from("orders")
    .update(updateData)
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
    console.error("Failed to update order:", error);
    return {
      success: false,
      error: "Failed to update order",
      code: "UPDATE_FAILED",
    };
  }

  // 7. Transform and return
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
