"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { createOrderSchema } from "../schemas";
import type { Order, ActionResult } from "../types";

/**
 * Create Order
 *
 * Creates a new order with auto-generated code.
 * - Admins/salespersons can create orders for any organisation
 * - Non-admin users can create orders for their own organisation only
 */
export async function createOrder(input: {
  name: string;
  organisationId: string;
  orderDate: string;
  volumeM3?: number | null;
  valueCents?: number | null;
  currency?: "EUR" | "GBP" | "USD";
  notes?: string | null;
}): Promise<ActionResult<Order>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Non-admin users: check if they can create for other orgs (salesperson types)
  if (!isAdmin(session)) {
    const userOrgId = session.currentOrganizationId || session.organisationId;
    if (input.organisationId !== userOrgId) {
      // Check if user's org is a salesperson type (principal/trader)
      const supabaseCheck = await createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: typeData } = await (supabaseCheck as any)
        .from("organization_type_assignments")
        .select("organization_types(name)")
        .eq("organization_id", userOrgId)
        .limit(1)
        .single();

      const orgTypeName = typeData?.organization_types?.name;
      const isSalesperson = orgTypeName === "principal" || orgTypeName === "trader";

      if (!isSalesperson) {
        return {
          success: false,
          error: "Permission denied",
          code: "FORBIDDEN",
        };
      }
    }
  }

  // 3. Validate input with Zod
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      code: "VALIDATION_ERROR",
    };
  }

  const { name, organisationId, orderDate, volumeM3, valueCents, currency, notes } =
    parsed.data;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // 4. Generate order code using sequence
  const { data: seqData, error: seqError } = await client.rpc("nextval", {
    seq_name: "order_number_seq",
  });

  let orderNumber: number;
  if (seqError) {
    // Fallback: count existing orders
    const { count } = await client
      .from("orders")
      .select("id", { count: "exact", head: true });
    orderNumber = (count || 0) + 1;
  } else {
    orderNumber = seqData;
  }

  const code = `ORD-${String(orderNumber).padStart(3, "0")}`;

  // 5. Get current user's portal_user ID
  let createdBy: string | null = null;
  if (session.id) {
    const { data: portalUser } = await client
      .from("portal_users")
      .select("id")
      .eq("auth_user_id", session.id)
      .single();
    if (portalUser) {
      createdBy = portalUser.id;
    }
  }

  // 6. Insert new order
  const { data, error } = await client
    .from("orders")
    .insert({
      code,
      name,
      organisation_id: organisationId,
      order_date: orderDate,
      volume_m3: volumeM3,
      value_cents: valueCents,
      currency: currency || "EUR",
      status: "draft",
      notes,
      created_by: createdBy,
    })
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
    console.error("Failed to create order:", error);
    return {
      success: false,
      error: "Failed to create order",
      code: "CREATE_FAILED",
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
