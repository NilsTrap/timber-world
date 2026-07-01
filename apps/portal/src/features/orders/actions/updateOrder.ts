"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getAccessProfile } from "@/lib/access";
import { updateOrderSchema } from "../schemas";
import { resolveFieldAccess, disallowedEdits } from "../services/dealFields";
import type { Order, ActionResult } from "../types";
import { isValidUUID } from "../types";
import { logOrderActivity } from "./logOrderActivity";
import { isAllowedOrderParty } from "./_validateOrderParty";

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
  },
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

  // 3. Validate order ID
  if (!isValidUUID(orderId)) {
    return {
      success: false,
      error: "Invalid order ID",
      code: "INVALID_ID",
    };
  }

  const supabasePre = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preClient = supabasePre as any;

  // 2. Check permission. E4: the config-driven field wall replaces the old
  //    hardcoded PRODUCTION_EDIT_FIELDS whitelist. A non-admin needs orders
  //    access (orders.view or the production tab) to edit at all; which
  //    fields they may edit comes from their groups' field-domain/override
  //    grants (editable in Settings → Groups, no deploy).
  if (!isAdmin(session)) {
    const userOrgId = session.currentOrganizationId || session.organisationId;
    const userModules = await getUserEnabledModules(session.portalUserId ?? "", userOrgId);
    if (!userModules.has("orders.view") && !userModules.has("orders.tab.production")) {
      return {
        success: false,
        error: "Permission denied",
        code: "FORBIDDEN",
      };
    }
    // The field wall is derived from the caller's CURRENT org, so that org
    // must actually be a party to the order being written — otherwise a
    // multi-org user could edit an order reachable only through org B while
    // holding org A's (more permissive) field grants. RLS enforces row
    // reachability across ALL memberships but has no column-level wall, so we
    // pin the org here (mirrors getOrder's party check).
    const { data: ord } = await preClient
      .from("orders")
      .select("seller_organisation_id, buyer_organisation_id, producer_organisation_id")
      .eq("id", orderId)
      .maybeSingle();
    if (
      !ord ||
      (ord.seller_organisation_id !== userOrgId &&
        ord.buyer_organisation_id !== userOrgId &&
        ord.producer_organisation_id !== userOrgId)
    ) {
      return { success: false, error: "Permission denied", code: "FORBIDDEN" };
    }
    const profile = await getAccessProfile(session.portalUserId, userOrgId);
    const access = resolveFieldAccess(profile);
    const forbidden = disallowedEdits(input as Record<string, unknown>, access);
    if (forbidden.length > 0) {
      return {
        success: false,
        error: `Permission denied for field${forbidden.length > 1 ? "s" : ""}: ${forbidden.join(", ")}`,
        code: "FORBIDDEN",
      };
    }
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

  // Reuse the RLS-enforcing client created for the party check above.
  const client = preClient;

  // 5. Build update object (snake_case for DB)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.projectNumber !== undefined)
    updateData.project_number = parsed.data.projectNumber;
  if (parsed.data.customerOrganisationId !== undefined) {
    updateData.customer_organisation_id = parsed.data.customerOrganisationId;
    // Bilateral invariant (E4, until the E8 data migration): the legacy
    // customer slot and the canonical buyer stay equal on 3-party orders so
    // the seller+buyer RLS keeps matching rows edited through this path.
    updateData.buyer_organisation_id = parsed.data.customerOrganisationId;
  }
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

  // Non-admins may only set order parties to their own trading partners (with
  // the right role). Clearing (null) is allowed. Admins are unrestricted.
  if (!isAdmin(session)) {
    const userOrgId = session.currentOrganizationId || session.organisationId;
    const partyChecks: Array<[string, "is_customer" | "is_manufacturer" | "is_producer"]> = [
      ["customer_organisation_id", "is_customer"],
      ["seller_organisation_id", "is_manufacturer"],
      ["producer_organisation_id", "is_producer"],
    ];
    for (const [field, role] of partyChecks) {
      if (updateData[field] && !(await isAllowedOrderParty(client, userOrgId, updateData[field], role))) {
        return { success: false, error: "Selected party is not an allowed trading partner", code: "FORBIDDEN" };
      }
    }
  }

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
    treadM3: data.tread_m3 != null ? parseFloat(data.tread_m3) : null,
    winderM3: data.winder_m3 != null ? parseFloat(data.winder_m3) : null,
    quarterM3: data.quarter_m3 != null ? parseFloat(data.quarter_m3) : null,
    totalProducedM3: (parseFloat(data.tread_m3) || 0) + (parseFloat(data.winder_m3) || 0) + (parseFloat(data.quarter_m3) || 0),
    usedMaterialM3: parseFloat(data.used_material_m3) || 0,
    wasteM3: (parseFloat(data.used_material_m3) || 0) > 0 ? (parseFloat(data.used_material_m3) || 0) - ((parseFloat(data.tread_m3) || 0) + (parseFloat(data.winder_m3) || 0) + (parseFloat(data.quarter_m3) || 0)) : 0,
    wastePercent: (parseFloat(data.used_material_m3) || 0) > 0 ? (((parseFloat(data.used_material_m3) || 0) - ((parseFloat(data.tread_m3) || 0) + (parseFloat(data.winder_m3) || 0) + (parseFloat(data.quarter_m3) || 0))) / (parseFloat(data.used_material_m3) || 1)) * 100 : 0,
    productionMaterial: data.production_material != null ? parseFloat(data.production_material) : null,
    productionWork: parseFloat(data.production_work) || 0,
    productionFinishing: data.production_finishing != null ? parseFloat(data.production_finishing) : null,
    productionTotal: data.production_material == null && data.production_finishing == null
      ? null
      : (parseFloat(data.production_material) || 0) + (parseFloat(data.production_finishing) || 0),
    productionInvoiceNumber: data.production_invoice_number as string | null,
    productionPaymentDate: data.production_payment_date as string | null,
    woodArt: data.wood_art != null ? parseFloat(data.wood_art) : null,
    glowing: parseFloat(data.glowing) || 0,
    woodArtCnc: data.wood_art_cnc != null ? parseFloat(data.wood_art_cnc) : null,
    woodArtTotal: data.wood_art == null && data.wood_art_cnc == null
      ? null
      : (parseFloat(data.wood_art) || 0) + (parseFloat(data.wood_art_cnc) || 0),
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
    fileCount: 0,
  };

  const changedFields = Object.keys(input).filter((k) => input[k as keyof typeof input] !== undefined);
  await logOrderActivity(
    orderId,
    session.portalUserId,
    "updated",
    `Updated ${changedFields.join(", ")}`,
    tab
  );

  return {
    success: true,
    data: order,
  };
}
