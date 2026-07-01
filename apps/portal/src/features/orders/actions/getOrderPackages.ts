"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getAccessProfile } from "@/lib/access";
import { resolveFieldAccess, type FieldAccess } from "../services/dealFields";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

export interface OrderPackage {
  id: string;
  packageNumber: string;
  productName: string | null;
  woodSpecies: string | null;
  humidity: string | null;
  typeName: string | null;
  processing: string | null;
  fsc: string | null;
  quality: string | null;
  thickness: string | null;
  width: string | null;
  riser: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
  status: string;
  staircaseCodeId: string | null;
  unitPricePiece: number | null;
  unitPriceM3: number | null;
  unitPriceM2: number | null;
  workPerPiece: number | null;
  transportPerPiece: number | null;
  eurPerM3: number | null;
  notes: string | null;
  productionEntryId: string | null;
}

/**
 * Get all inventory packages linked to an order.
 * Returns both "ordered" (spec) packages and "produced" (actual) packages.
 */
export async function getOrderPackages(
  orderId: string
): Promise<ActionResult<OrderPackage[]>> {
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

  // Authz + pricing visibility. Order packages are owned by the seller/manufacturer
  // org, so the owner-only inventory_packages RLS hides them from a producer
  // (Wood ART) counterparty — which made the detail-page products table empty for
  // them. We therefore read packages via the service-role admin client below, but
  // ONLY after verifying the caller may see this order: admins pass; everyone else
  // must be a party on the order (the orders RLS row read proves it — E4's
  // direction-aware bilateral policy) AND have orders.view. Package pricing is
  // projected through the E4 field wall (deal_terms / margin domains).
  let fieldAccess: FieldAccess | null = null;
  if (!isAdmin(session)) {
    const { data: ord } = await client
      .from("orders")
      .select("seller_organisation_id, buyer_organisation_id, producer_organisation_id")
      .eq("id", orderId)
      .single();
    if (!ord) {
      return { success: false, error: "Permission denied", code: "FORBIDDEN" };
    }
    const orgId = session.currentOrganizationId || session.organisationId;
    const isParty =
      ord.seller_organisation_id === orgId ||
      ord.buyer_organisation_id === orgId ||
      ord.producer_organisation_id === orgId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!isParty || !mods.has("orders.view")) {
      return { success: false, error: "Permission denied", code: "FORBIDDEN" };
    }
    const profile = await getAccessProfile(session.portalUserId, orgId);
    fieldAccess = resolveFieldAccess(profile);
  }
  const seeTerms = fieldAccess ? fieldAccess.domainVisible("deal_terms") : true;
  const seeMargin = fieldAccess ? fieldAccess.domainVisible("margin") : true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("inventory_packages")
    .select(`
      id, package_number, status, thickness, width, riser, length, pieces,
      volume_m3, notes, production_entry_id, staircase_code_id,
      unit_price_piece, unit_price_m3, unit_price_m2,
      work_per_piece, transport_per_piece, eur_per_m3,
      ref_product_names (value),
      ref_wood_species (value),
      ref_humidity (value),
      ref_types (value),
      ref_processing (value),
      ref_fsc (value),
      ref_quality (value)
    `)
    .eq("order_id", orderId)
    .order("package_number", { ascending: true });

  if (error) {
    console.error("[getOrderPackages] Failed:", error);
    return { success: false, error: "Failed to fetch order packages", code: "FETCH_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages: OrderPackage[] = (data || []).map((row: any) => ({
    id: row.id,
    packageNumber: row.package_number,
    productName: row.ref_product_names?.value ?? null,
    woodSpecies: row.ref_wood_species?.value ?? null,
    humidity: row.ref_humidity?.value ?? null,
    typeName: row.ref_types?.value ?? null,
    processing: row.ref_processing?.value ?? null,
    fsc: row.ref_fsc?.value ?? null,
    quality: row.ref_quality?.value ?? null,
    thickness: row.thickness,
    width: row.width,
    riser: row.riser,
    length: row.length,
    pieces: row.pieces,
    volumeM3: row.volume_m3,
    staircaseCodeId: row.staircase_code_id ?? null,
    status: row.status,
    // Pricing projected through the field wall: unit prices are the leg's
    // deal_terms; work/transport/eur-per-m³ components are margin analytics.
    // Hidden fields never reach the payload.
    unitPricePiece: seeTerms ? row.unit_price_piece : null,
    unitPriceM3: seeTerms ? row.unit_price_m3 : null,
    unitPriceM2: seeTerms ? row.unit_price_m2 : null,
    workPerPiece: seeMargin ? (row.work_per_piece != null ? parseFloat(row.work_per_piece) : null) : null,
    transportPerPiece: seeMargin ? (row.transport_per_piece != null ? parseFloat(row.transport_per_piece) : null) : null,
    eurPerM3: seeMargin ? (row.eur_per_m3 != null ? parseFloat(row.eur_per_m3) : null) : null,
    notes: row.notes,
    productionEntryId: row.production_entry_id,
  }));

  return { success: true, data: packages };
}
