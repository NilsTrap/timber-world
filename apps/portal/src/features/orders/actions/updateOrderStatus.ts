"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import { updateOrderStatusSchema } from "../schemas";
import type { Order, OrderStatus, ActionResult } from "../types";
import { isValidUUID } from "../types";
import { logOrderActivity } from "./logOrderActivity";

/**
 * Update Order Status
 *
 * Changes the status of an order.
 * Admin only endpoint.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  tab?: string
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

  // 2. Check permission: admin or orders.create module
  if (!isAdmin(session)) {
    const userOrgId = session.currentOrganizationId || session.organisationId;
    const canCreate = await orgHasModule(userOrgId, "orders.create");
    if (!canCreate) {
      return {
        success: false,
        error: "Permission denied",
        code: "FORBIDDEN",
      };
    }
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
      project_number,
      customer_organisation_id,
      seller_organisation_id,
      producer_organisation_id,
      date_received,
      date_loaded,
      volume_m3,
      value_cents,
      currency,
      status,
      notes,
      created_by,
      created_at,
      updated_at,
      customer:organisations!orders_customer_organisation_id_fkey (
        code,
        name
      ),
      seller:organisations!orders_seller_organisation_id_fkey (
        code,
        name
      ),
      producer:organisations!orders_producer_organisation_id_fkey (
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
    name: data.name as string,
    projectNumber: (data.project_number as string) ?? null,
    typeSummary: null,
    treads: 0,
    winders: 0,
    quarters: 0,
    totalPieces: 0,
    treadLength: null,
    advanceInvoiceNumber: null,
    invoiceNumber: null,
    packageNumber: null,
    transportInvoiceNumber: null,
    transportPrice: null,
    totalPricePence: 0,
    totalKg: 0,
    maxM3: 0, treadM3: 0, winderM3: null, quarterM3: null, totalProducedM3: 0,
    usedMaterialM3: 0, wasteM3: 0, wastePercent: 0,
    productionMaterial: null, productionWork: 0, productionFinishing: null, productionTotal: null, productionInvoiceNumber: null, productionPaymentDate: null,
    woodArt: null, glowing: 0, woodArtCnc: null, woodArtTotal: null, woodArtInvoiceNumber: null, woodArtPaymentDate: null,
    eurPerM3: 0,
    workPerPiece: 0,
    invoicedWork: 0,
    usedWork: 0,
    plMaterialValue: 0,
    plWorkValue: 0,
    invoicedTransport: 0,
    usedTransport: 0,
    plTransportValue: 0,
    plMaterialsValue: 0,
    plTotalValue: 0,
    plPercentFromInvoice: 0,
    plannedDate: null,
    customerOrganisationId: data.customer_organisation_id as string,
    customerOrganisationName: data.customer?.name as string | undefined,
    customerOrganisationCode: data.customer?.code as string | undefined,
    sellerOrganisationId: data.seller_organisation_id as string | null,
    sellerOrganisationName: data.seller?.name as string | undefined,
    sellerOrganisationCode: data.seller?.code as string | undefined,
    producerOrganisationId: data.producer_organisation_id as string | null,
    producerOrganisationName: data.producer?.name as string | undefined,
    producerOrganisationCode: data.producer?.code as string | undefined,
    dateReceived: data.date_received as string,
    dateLoaded: (data.date_loaded as string) ?? null,
    volumeM3: data.volume_m3 as number | null,
    valueCents: data.value_cents as number | null,
    currency: data.currency as "EUR" | "GBP" | "USD",
    status: data.status as Order["status"],
    notes: data.notes as string | null,
    createdBy: data.created_by as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    fileCount: 0,
  };

  await logOrderActivity(orderId, session.portalUserId, "status_changed", `Status changed to ${newStatus}`, tab);

  return {
    success: true,
    data: order,
  };
}
