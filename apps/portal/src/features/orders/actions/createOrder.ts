"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import { createOrderSchema } from "../schemas";
import type { Order, ActionResult } from "../types";
import { logOrderActivity } from "./logOrderActivity";

/**
 * Create Order
 *
 * Creates a new order with auto-generated code.
 * - Admins/salespersons can create orders for any organisation
 * - Non-admin users can create orders for their own organisation only
 */
export async function createOrder(input: {
  name: string;
  projectNumber?: string | null;
  customerOrganisationId: string | null;
  sellerOrganisationId?: string | null;
  dateReceived: string;
  dateLoaded?: string | null;
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

  // 2. Non-admin users: check orders.create module
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

    // If creating for a different org, check customer-select module
    if (input.customerOrganisationId !== userOrgId) {
      const canSelectCustomer = await orgHasModule(userOrgId, "orders.customer-select");
      if (!canSelectCustomer) {
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

  const { name, projectNumber, customerOrganisationId, dateReceived, dateLoaded, volumeM3, valueCents, currency, notes } =
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

  // 6. Determine seller org
  // For non-admin users with customer-select, the seller is the user's own org
  const userOrgId = session.currentOrganizationId || session.organisationId;
  let sellerOrgId = input.sellerOrganisationId || null;
  if (!sellerOrgId && !isAdmin(session) && customerOrganisationId !== userOrgId) {
    sellerOrgId = userOrgId;
  }

  // 7. Insert new order
  const { data, error } = await client
    .from("orders")
    .insert({
      code,
      name,
      project_number: projectNumber,
      customer_organisation_id: customerOrganisationId,
      seller_organisation_id: sellerOrgId,
      date_received: dateReceived,
      date_loaded: dateLoaded,
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
    console.error("Failed to create order:", error);
    return {
      success: false,
      error: "Failed to create order",
      code: "CREATE_FAILED",
    };
  }

  // 8. Transform and return
  const order: Order = {
    id: data.id as string,
    name: data.name as string,
    projectNumber: data.project_number as string | null,
    typeSummary: null,
    treads: 0,
    winders: 0,
    quarters: 0,
    totalPieces: 0,
    treadLength: null,
    totalPricePence: 0,
    totalKg: 0,
    maxM3: 0, treadM3: 0, winderM3: 0, quarterM3: 0, totalProducedM3: 0,
    usedMaterialM3: 0, wasteM3: 0, wastePercent: 0,
    productionMaterial: 0, productionWork: 0, productionFinishing: 0, productionTotal: 0, productionInvoiceNumber: null, productionPaymentDate: null,
    woodArt: 0, glowing: 0, woodArtCnc: 0, woodArtTotal: 0, woodArtInvoiceNumber: null, woodArtPaymentDate: null,
    advanceInvoiceNumber: null,
    invoiceNumber: null,
    packageNumber: null,
    transportInvoiceNumber: null,
    transportPrice: null,
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

  await logOrderActivity(order.id, session.portalUserId, "created", `Order ${order.name} created`, "list");

  return {
    success: true,
    data: order,
  };
}
