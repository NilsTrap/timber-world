"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import type { Order, ActionResult } from "../types";

/**
 * Get Orders
 *
 * Fetches all orders with organisation details.
 * - Admins see all orders
 * - Org users see only orders for their organisation (if orders.view is enabled)
 *
 * @param options.includeCompleted - If false, excludes completed orders. Default: true
 */
export async function getOrders(options?: {
  includeCompleted?: boolean;
}): Promise<ActionResult<Order[]>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. For non-admin users, check if their org has orders feature enabled
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const hasOrdersModule = await orgHasModule(orgId, "orders.view");
    if (!hasOrdersModule) {
      return {
        success: false,
        error: "Orders feature not enabled for your organisation",
        code: "FEATURE_DISABLED",
      };
    }
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const includeCompleted = options?.includeCompleted ?? true;

  // 3. Build query
  let query = client
    .from("orders")
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
      ),
      portal_users (
        name
      ),
      inventory_packages (
        thickness,
        pieces,
        volume_m3,
        status,
        unit_price_piece,
        transport_per_piece,
        work_per_piece,
        eur_per_m3,
        production_entry_id,
        ref_types (value),
        ref_product_names (value),
        uk_staircase_pricing (eur_per_m3_cents, work_cost_cents, transport_cost_cents)
      )
    `
    )
    .order("created_at", { ascending: false });

  // 4. Filter by status if needed
  if (!includeCompleted) {
    query = query.neq("status", "completed");
  }

  // 5. Filter by organisation for non-admin users
  // Show orders where user's org is the buyer OR the seller
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    if (!orgId) {
      return {
        success: false,
        error: "No organisation assigned",
        code: "NO_ORGANISATION",
      };
    }
    query = query.or(
      `customer_organisation_id.eq.${orgId},seller_organisation_id.eq.${orgId},producer_organisation_id.eq.${orgId}`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch orders:", error);
    return {
      success: false,
      error: "Failed to fetch orders",
      code: "FETCH_FAILED",
    };
  }

  // 6. Collect all production_entry_ids across all orders to batch-fetch inputs
  const allProductionEntryIds = new Set<string>();
  for (const row of data || []) {
    for (const pkg of row.inventory_packages || []) {
      if (pkg.production_entry_id && pkg.status !== "ordered") {
        allProductionEntryIds.add(pkg.production_entry_id);
      }
    }
  }

  // Fetch production inputs for all relevant entries in one query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let inputsByEntryId: Record<string, number> = {};
  if (allProductionEntryIds.size > 0) {
    const { data: inputsData } = await client
      .from("portal_production_inputs")
      .select("production_entry_id, volume_m3")
      .in("production_entry_id", [...allProductionEntryIds]);

    if (inputsData) {
      for (const inp of inputsData) {
        const entryId = inp.production_entry_id as string;
        const vol = parseFloat(inp.volume_m3) || 0;
        inputsByEntryId[entryId] = (inputsByEntryId[entryId] || 0) + vol;
      }
    }
  }

  // 7. Transform to Order type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders: Order[] = (data || []).map((row: any) => {
    // Compute summaries from order products (all packages linked to this order)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allPkgs = row.inventory_packages || [];
    const typeSet = new Set<string>();
    let treads = 0;
    let winders = 0;
    let quarters = 0;
    let totalPieces = 0;
    let totalPricePence = 0;
    let totalKg = 0;
    let maxM3 = 0;
    let eurPerM3 = 0; // EUR per m³ from first package's staircase code
    let workPerPiece = 0; // Work cost per piece from first package's staircase code
    let totalWork = 0; // Sum of workPerPiece × pieces across all packages
    let totalTransport = 0; // Sum of transportPerPiece × pieces across all packages
    let totalEurPerPiece = 0; // Sum of (eurPerM3 × volume) × pieces across all packages

    // Production metrics (from produced packages only)
    let treadM3 = 0;
    let winderM3 = 0;
    let quarterM3 = 0;
    const productionEntryIds = new Set<string>();

    for (const pkg of allPkgs) {
      const typeName = pkg.ref_types?.value;
      const thickness = pkg.thickness;
      if (typeName && thickness) {
        const abbr = typeName.toLowerCase().replace(/\s+/g, "") === "fullstave" ? "FS" : typeName;
        typeSet.add(`${abbr}${thickness}`);
      }
      const productName = (pkg.ref_product_names?.value || "").toLowerCase();
      const pcs = parseInt(pkg.pieces, 10) || 0;
      const unitPrice = parseFloat(pkg.unit_price_piece) || 0;
      const vol = Math.round((parseFloat(pkg.volume_m3) || 0) * 10000) / 10000;
      if (productName === "step" || productName === "tread") treads += pcs;
      else if (productName === "winder") winders += pcs;
      else if (productName === "quarter") quarters += pcs;
      totalPieces += pcs;
      totalPricePence += Math.round(unitPrice * 100) * pcs;
      totalKg += vol * 700 * pcs;
      maxM3 += vol * pcs;

      // EUR per m³: use stored value, fall back to staircase pricing
      const pkgEurPerM3 = parseFloat(pkg.eur_per_m3) || (pkg.uk_staircase_pricing?.eur_per_m3_cents ? pkg.uk_staircase_pricing.eur_per_m3_cents / 100 : 0);
      if (eurPerM3 === 0 && pkgEurPerM3 > 0) {
        eurPerM3 = pkgEurPerM3;
      }
      // Total EUR per piece: eurPerM3 × volume × pieces for each package
      if (pcs > 0 && pkgEurPerM3 > 0 && vol > 0) {
        totalEurPerPiece += pkgEurPerM3 * vol * pcs;
      }
      // Work per piece: use stored value, fall back to staircase pricing
      if (workPerPiece === 0) {
        const storedWork = parseFloat(pkg.work_per_piece) || 0;
        if (storedWork > 0) workPerPiece = storedWork;
        else if (pkg.uk_staircase_pricing?.work_cost_cents) workPerPiece = pkg.uk_staircase_pricing.work_cost_cents / 100;
      }
      // Total work: use stored value per package, fall back to staircase pricing
      if (pcs > 0) {
        const storedWork = parseFloat(pkg.work_per_piece) || 0;
        const staircaseWork = pkg.uk_staircase_pricing?.work_cost_cents ? pkg.uk_staircase_pricing.work_cost_cents / 100 : 0;
        const workPP = storedWork || staircaseWork;
        if (workPP > 0) totalWork += workPP * pcs;
      }
      // Transport per piece: use stored value, fall back to staircase pricing + 11, then formula
      if (pcs > 0) {
        const storedTransport = parseFloat(pkg.transport_per_piece) || 0;
        const staircaseTransport = pkg.uk_staircase_pricing?.transport_cost_cents
          ? pkg.uk_staircase_pricing.transport_cost_cents / 100 + 11
          : 0;
        const calcTransport = vol > 0 ? Math.round((vol * 300 + 11) * 100) / 100 : 0;
        const transportPerPiece = storedTransport || staircaseTransport || calcTransport;
        if (transportPerPiece > 0) {
          totalTransport += transportPerPiece * pcs;
        }
      }

      // Produced packages: compute per-product-type m³
      if (pkg.status !== "ordered") {
        const totalVol = vol * pcs;
        if (productName === "step" || productName === "tread") treadM3 += totalVol;
        else if (productName === "winder") winderM3 += totalVol;
        else if (productName === "quarter") quarterM3 += totalVol;
        if (pkg.production_entry_id) {
          productionEntryIds.add(pkg.production_entry_id);
        }
      }
    }
    const typeSummary = typeSet.size > 0 ? [...typeSet].join(", ") : null;

    // Use stored DB values if available, otherwise use computed from production data
    const finalTreadM3 = row.tread_m3 != null ? parseFloat(row.tread_m3) : treadM3;
    const finalWinderM3 = row.winder_m3 != null ? parseFloat(row.winder_m3) : winderM3;
    const finalQuarterM3 = row.quarter_m3 != null ? parseFloat(row.quarter_m3) : quarterM3;
    const finalTotalProducedM3 = finalTreadM3 + finalWinderM3 + finalQuarterM3;

    let computedUsedMaterialM3 = 0;
    for (const entryId of productionEntryIds) {
      computedUsedMaterialM3 += inputsByEntryId[entryId] || 0;
    }
    const finalUsedMaterialM3 = row.used_material_m3 != null ? parseFloat(row.used_material_m3) : computedUsedMaterialM3;
    const finalWasteM3 = finalUsedMaterialM3 > 0 ? finalUsedMaterialM3 - finalTotalProducedM3 : 0;
    const finalWastePercent = finalUsedMaterialM3 > 0 ? (finalWasteM3 / finalUsedMaterialM3) * 100 : 0;

    // Compute all PL values
    const usedWorkVal = (parseFloat(row.production_finishing) || 0) + (parseFloat(row.wood_art) || 0) + (parseFloat(row.wood_art_cnc) || 0);
    const usedTransportVal = parseFloat(row.transport_price) || 0;
    const plM3Val = maxM3 > 0 && finalUsedMaterialM3 > 0 ? (maxM3 - finalUsedMaterialM3) * eurPerM3 * 0.7 : 0;
    const plWorkVal = totalWork > 0 && usedWorkVal > 0 ? totalWork - usedWorkVal : 0;
    const plTransportVal = totalTransport > 0 && usedTransportVal > 0 ? totalTransport - usedTransportVal : 0;
    const plMaterialsVal = totalEurPerPiece > 0 ? totalEurPerPiece * 0.3 : 0;
    const plTotalVal = plM3Val + plWorkVal + plTransportVal + plMaterialsVal;
    const totalInvoiceEur = totalPricePence > 0 ? (totalPricePence / 100) * 0.9 : 0;
    const plPercentVal = totalInvoiceEur > 0 && plTotalVal !== 0 ? (plTotalVal / totalInvoiceEur) * 100 : 0;

    return {
    id: row.id as string,
    name: row.name as string,
    projectNumber: row.project_number as string | null,
    typeSummary,
    treads,
    winders,
    quarters,
    totalPieces,
    treadLength: row.tread_length as string | null,
    totalPricePence,
    totalKg,
    maxM3,
    treadM3: finalTreadM3,
    winderM3: finalWinderM3,
    quarterM3: finalQuarterM3,
    totalProducedM3: finalTotalProducedM3,
    usedMaterialM3: finalUsedMaterialM3,
    wasteM3: finalWasteM3,
    wastePercent: finalWastePercent,
    productionMaterial: parseFloat(row.production_material) || 0,
    productionWork: parseFloat(row.production_work) || 0,
    productionFinishing: parseFloat(row.production_finishing) || 0,
    productionTotal: (parseFloat(row.production_material) || 0) + (parseFloat(row.production_finishing) || 0),
    productionInvoiceNumber: row.production_invoice_number as string | null,
    productionPaymentDate: row.production_payment_date as string | null,
    woodArt: parseFloat(row.wood_art) || 0,
    glowing: parseFloat(row.glowing) || 0,
    woodArtCnc: parseFloat(row.wood_art_cnc) || 0,
    woodArtTotal: (parseFloat(row.wood_art) || 0) + (parseFloat(row.wood_art_cnc) || 0),
    woodArtInvoiceNumber: row.wood_art_invoice_number as string | null,
    woodArtPaymentDate: row.wood_art_payment_date as string | null,
    advanceInvoiceNumber: row.advance_invoice_number as string | null,
    invoiceNumber: row.invoice_number as string | null,
    packageNumber: row.package_number as string | null,
    transportInvoiceNumber: row.transport_invoice_number as string | null,
    transportPrice: row.transport_price as string | null,
    customerOrganisationId: row.customer_organisation_id as string,
    customerOrganisationName: row.customer?.name as string | undefined,
    customerOrganisationCode: row.customer?.code as string | undefined,
    sellerOrganisationId: row.seller_organisation_id as string | null,
    sellerOrganisationName: row.seller?.name as string | undefined,
    sellerOrganisationCode: row.seller?.code as string | undefined,
    producerOrganisationId: row.producer_organisation_id as string | null,
    producerOrganisationName: row.producer?.name as string | undefined,
    producerOrganisationCode: row.producer?.code as string | undefined,
    eurPerM3,
    workPerPiece,
    invoicedWork: totalWork,
    usedWork: usedWorkVal,
    plMaterialValue: plM3Val,
    plWorkValue: plWorkVal,
    invoicedTransport: totalTransport,
    usedTransport: usedTransportVal,
    plTransportValue: plTransportVal,
    plMaterialsValue: plMaterialsVal,
    plTotalValue: plTotalVal,
    plPercentFromInvoice: plPercentVal,
    plannedDate: (row.planned_date as string) ?? null,
    dateReceived: row.date_received as string,
    dateLoaded: (row.date_loaded as string) ?? null,
    volumeM3: row.volume_m3 as number | null,
    valueCents: row.value_cents as number | null,
    currency: row.currency as "EUR" | "GBP" | "USD",
    status: row.status as Order["status"],
    notes: row.notes as string | null,
    createdBy: row.created_by as string | null,
    createdByName: row.portal_users?.name as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
  });

  return {
    success: true,
    data: orders,
  };
}
