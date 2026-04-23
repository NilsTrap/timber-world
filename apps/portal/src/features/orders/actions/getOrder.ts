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
      id, code, name, project_number, customer_organisation_id, seller_organisation_id, producer_organisation_id, planned_date, date_received, date_loaded,
      volume_m3, value_cents, currency, status, notes,
      created_by, created_at, updated_at,
      customer:organisations!orders_customer_organisation_id_fkey (code, name),
      seller:organisations!orders_seller_organisation_id_fkey (code, name),
      producer:organisations!orders_producer_organisation_id_fkey (code, name),
      portal_users (name)
    `)
    .eq("id", orderId)
    .single();

  if (error || !data) {
    return { success: false, error: "Order not found", code: "NOT_FOUND" };
  }

  // Non-admin: check org match (buyer or seller) and feature
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    if (data.customer_organisation_id !== orgId && data.seller_organisation_id !== orgId && data.producer_organisation_id !== orgId) {
      return { success: false, error: "Permission denied", code: "FORBIDDEN" };
    }
    const hasModule = await orgHasModule(orgId, "orders.view");
    if (!hasModule) {
      return { success: false, error: "Orders feature not enabled", code: "FEATURE_DISABLED" };
    }
  }

  const order: Order = {
    id: data.id,
    name: data.name,
    projectNumber: data.project_number ?? null,
    typeSummary: null,
    treads: 0,
    winders: 0,
    quarters: 0,
    totalPieces: 0,
    treadLength: null,
    totalPricePence: 0,
    totalKg: 0,
    maxM3: 0, treadM3: 0, winderM3: null, quarterM3: null, totalProducedM3: 0,
    usedMaterialM3: 0, wasteM3: 0, wastePercent: 0,
    productionMaterial: null, productionWork: 0, productionFinishing: null, productionTotal: null, productionInvoiceNumber: null, productionPaymentDate: null,
    woodArt: null, glowing: 0, woodArtCnc: null, woodArtTotal: null, woodArtInvoiceNumber: null, woodArtPaymentDate: null,
    advanceInvoiceNumber: null,
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
    plannedDate: data.planned_date ?? null,
    invoiceNumber: null,
    packageNumber: null,
    transportInvoiceNumber: null,
    transportPrice: null,
    customerOrganisationId: data.customer_organisation_id,
    customerOrganisationName: data.customer?.name,
    customerOrganisationCode: data.customer?.code,
    sellerOrganisationId: data.seller_organisation_id,
    sellerOrganisationName: data.seller?.name,
    sellerOrganisationCode: data.seller?.code,
    producerOrganisationId: data.producer_organisation_id,
    producerOrganisationName: data.producer?.name,
    producerOrganisationCode: data.producer?.code,
    dateReceived: data.date_received,
    dateLoaded: data.date_loaded ?? null,
    volumeM3: data.volume_m3,
    valueCents: data.value_cents,
    currency: data.currency,
    status: data.status,
    notes: data.notes,
    createdBy: data.created_by,
    createdByName: data.portal_users?.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    fileCount: 0,
  };

  return { success: true, data: order };
}
