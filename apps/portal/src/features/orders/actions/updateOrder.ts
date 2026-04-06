"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
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
    projectNumber?: string | null;
    customerOrganisationId?: string;
    sellerOrganisationId?: string | null;
    producerOrganisationId?: string | null;
    plannedDate?: string | null;
    dateReceived?: string;
    dateLoaded?: string | null;
    volumeM3?: number | null;
    valueCents?: number | null;
    currency?: "EUR" | "GBP" | "USD";
    notes?: string | null;
    treadLength?: string | null;
    advanceInvoiceNumber?: string | null;
    invoiceNumber?: string | null;
    packageNumber?: string | null;
    transportInvoiceNumber?: string | null;
    transportPrice?: string | null;
    treadM3?: number | null;
    winderM3?: number | null;
    quarterM3?: number | null;
    usedMaterialM3?: number | null;
    productionMaterial?: number | null;
    productionWork?: number | null;
    productionFinishing?: number | null;
    productionInvoiceNumber?: string | null;
    productionPaymentDate?: string | null;
    woodArt?: number | null;
    glowing?: number | null;
    woodArtCnc?: number | null;
    woodArtInvoiceNumber?: string | null;
    woodArtPaymentDate?: string | null;
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
  if (parsed.data.projectNumber !== undefined)
    updateData.project_number = parsed.data.projectNumber;
  if (parsed.data.customerOrganisationId !== undefined)
    updateData.customer_organisation_id = parsed.data.customerOrganisationId;
  if (parsed.data.sellerOrganisationId !== undefined)
    updateData.seller_organisation_id = parsed.data.sellerOrganisationId;
  if (parsed.data.producerOrganisationId !== undefined)
    updateData.producer_organisation_id = parsed.data.producerOrganisationId;
  if (parsed.data.plannedDate !== undefined)
    updateData.planned_date = parsed.data.plannedDate;
  if (parsed.data.dateReceived !== undefined)
    updateData.date_received = parsed.data.dateReceived;
  if (parsed.data.dateLoaded !== undefined)
    updateData.date_loaded = parsed.data.dateLoaded;
  if (parsed.data.volumeM3 !== undefined)
    updateData.volume_m3 = parsed.data.volumeM3;
  if (parsed.data.valueCents !== undefined)
    updateData.value_cents = parsed.data.valueCents;
  if (parsed.data.currency !== undefined)
    updateData.currency = parsed.data.currency;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
  if (parsed.data.treadLength !== undefined)
    updateData.tread_length = parsed.data.treadLength;
  if (parsed.data.advanceInvoiceNumber !== undefined)
    updateData.advance_invoice_number = parsed.data.advanceInvoiceNumber;
  if (parsed.data.invoiceNumber !== undefined)
    updateData.invoice_number = parsed.data.invoiceNumber;
  if (parsed.data.packageNumber !== undefined)
    updateData.package_number = parsed.data.packageNumber;
  if (parsed.data.transportInvoiceNumber !== undefined)
    updateData.transport_invoice_number = parsed.data.transportInvoiceNumber;
  if (parsed.data.transportPrice !== undefined)
    updateData.transport_price = parsed.data.transportPrice;
  if (parsed.data.treadM3 !== undefined)
    updateData.tread_m3 = parsed.data.treadM3;
  if (parsed.data.winderM3 !== undefined)
    updateData.winder_m3 = parsed.data.winderM3;
  if (parsed.data.quarterM3 !== undefined)
    updateData.quarter_m3 = parsed.data.quarterM3;
  if (parsed.data.usedMaterialM3 !== undefined)
    updateData.used_material_m3 = parsed.data.usedMaterialM3;
  if (parsed.data.productionMaterial !== undefined)
    updateData.production_material = parsed.data.productionMaterial;
  if (parsed.data.productionWork !== undefined)
    updateData.production_work = parsed.data.productionWork;
  if (parsed.data.productionFinishing !== undefined)
    updateData.production_finishing = parsed.data.productionFinishing;
  if (parsed.data.productionInvoiceNumber !== undefined)
    updateData.production_invoice_number = parsed.data.productionInvoiceNumber;
  if (parsed.data.productionPaymentDate !== undefined)
    updateData.production_payment_date = parsed.data.productionPaymentDate;
  if (parsed.data.woodArt !== undefined)
    updateData.wood_art = parsed.data.woodArt;
  if (parsed.data.glowing !== undefined)
    updateData.glowing = parsed.data.glowing;
  if (parsed.data.woodArtCnc !== undefined)
    updateData.wood_art_cnc = parsed.data.woodArtCnc;
  if (parsed.data.woodArtInvoiceNumber !== undefined)
    updateData.wood_art_invoice_number = parsed.data.woodArtInvoiceNumber;
  if (parsed.data.woodArtPaymentDate !== undefined)
    updateData.wood_art_payment_date = parsed.data.woodArtPaymentDate;

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
      project_number,
      customer_organisation_id,
      seller_organisation_id,
      producer_organisation_id,
      planned_date,
      date_received,
      date_loaded,
      volume_m3,
      value_cents,
      currency,
      status,
      notes,
      tread_length,
      advance_invoice_number,
      invoice_number,
      package_number,
      transport_invoice_number,
      transport_price,
      tread_m3,
      winder_m3,
      quarter_m3,
      used_material_m3,
      production_material,
      production_work,
      production_finishing,
      production_invoice_number,
      production_payment_date,
      wood_art,
      glowing,
      wood_art_cnc,
      wood_art_invoice_number,
      wood_art_payment_date,
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
    name: data.name as string,
    projectNumber: data.project_number as string | null,
    typeSummary: null,
    treads: 0,
    winders: 0,
    quarters: 0,
    totalPieces: 0,
    treadLength: data.tread_length as string | null,
    totalPricePence: 0,
    totalKg: 0,
    maxM3: 0,
    treadM3: parseFloat(data.tread_m3) || 0,
    winderM3: parseFloat(data.winder_m3) || 0,
    quarterM3: parseFloat(data.quarter_m3) || 0,
    totalProducedM3: (parseFloat(data.tread_m3) || 0) + (parseFloat(data.winder_m3) || 0) + (parseFloat(data.quarter_m3) || 0),
    usedMaterialM3: parseFloat(data.used_material_m3) || 0,
    wasteM3: (parseFloat(data.used_material_m3) || 0) > 0 ? (parseFloat(data.used_material_m3) || 0) - ((parseFloat(data.tread_m3) || 0) + (parseFloat(data.winder_m3) || 0) + (parseFloat(data.quarter_m3) || 0)) : 0,
    wastePercent: (parseFloat(data.used_material_m3) || 0) > 0 ? (((parseFloat(data.used_material_m3) || 0) - ((parseFloat(data.tread_m3) || 0) + (parseFloat(data.winder_m3) || 0) + (parseFloat(data.quarter_m3) || 0))) / (parseFloat(data.used_material_m3) || 1)) * 100 : 0,
    productionMaterial: parseFloat(data.production_material) || 0,
    productionWork: parseFloat(data.production_work) || 0,
    productionFinishing: parseFloat(data.production_finishing) || 0,
    productionTotal: (parseFloat(data.production_material) || 0) + (parseFloat(data.production_finishing) || 0),
    productionInvoiceNumber: data.production_invoice_number as string | null,
    productionPaymentDate: data.production_payment_date as string | null,
    woodArt: parseFloat(data.wood_art) || 0,
    glowing: parseFloat(data.glowing) || 0,
    woodArtCnc: parseFloat(data.wood_art_cnc) || 0,
    woodArtTotal: (parseFloat(data.wood_art) || 0) + (parseFloat(data.wood_art_cnc) || 0),
    woodArtInvoiceNumber: data.wood_art_invoice_number as string | null,
    woodArtPaymentDate: data.wood_art_payment_date as string | null,
    advanceInvoiceNumber: data.advance_invoice_number as string | null,
    invoiceNumber: data.invoice_number as string | null,
    packageNumber: data.package_number as string | null,
    transportInvoiceNumber: data.transport_invoice_number as string | null,
    transportPrice: data.transport_price as string | null,
    customerOrganisationId: data.customer_organisation_id as string,
    customerOrganisationName: data.customer?.name as string | undefined,
    customerOrganisationCode: data.customer?.code as string | undefined,
    sellerOrganisationId: data.seller_organisation_id as string | null,
    sellerOrganisationName: data.seller?.name as string | undefined,
    sellerOrganisationCode: data.seller?.code as string | undefined,
    producerOrganisationId: data.producer_organisation_id as string | null,
    producerOrganisationName: data.producer?.name as string | undefined,
    producerOrganisationCode: data.producer?.code as string | undefined,
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
    plannedDate: (data.planned_date as string) ?? null,
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
  };

  return {
    success: true,
    data: order,
  };
}
