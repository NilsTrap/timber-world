"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrgUser } from "@/lib/auth";
import type { ActionResult } from "../types";

/** Package available for adding to a production plan. Same shape as
 *  ShipmentAvailablePackage but with plan-specific markers added. */
export interface PlanAvailablePackage {
  id: string;
  packageNumber: string;
  shipmentCode: string;
  productNameId: string | null;
  productName: string | null;
  woodSpeciesId: string | null;
  woodSpecies: string | null;
  humidityId: string | null;
  humidity: string | null;
  typeId: string | null;
  typeName: string | null;
  processingId: string | null;
  processing: string | null;
  fscId: string | null;
  fsc: string | null;
  qualityId: string | null;
  quality: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
  notes: string | null;
  /** Package is being consumed by a production draft entry from this org. */
  inProductionDraft: boolean;
  /** Package is currently attached to another draft/pending outgoing shipment. */
  inOutgoingShipment: boolean;
  outgoingShipmentCode: string | null;
  /** Package is already on one or more OTHER production plans. Informational. */
  inAnotherPlan: boolean;
  /** Comma-separated names of the other plans referencing this package (for tooltip). */
  otherPlanNames: string | null;
}

/**
 * Return every package the current org could reasonably add to a plan.
 *
 * Plans are informational only — they don't lock or move packages. So unlike
 * the shipment selector, this returns packages that are in production drafts,
 * outgoing shipments, or other plans WITHOUT excluding or disabling them.
 * The UI is expected to display markers so the user knows.
 *
 * Excludes the current plan's existing packages (caller passes `excludePlanId`)
 * — they're already shown in the plan's own packages table.
 */
export async function getPlanAvailablePackages(
  excludePlanId?: string
): Promise<ActionResult<PlanAvailablePackage[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isOrgUser(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const orgId = session.currentOrganizationId || session.organisationId;
  if (!orgId) {
    return { success: false, error: "No organisation context", code: "NO_ORGANISATION" };
  }

  const supabase = await createClient();

  // Production drafts holding any of our packages as inputs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: draftInputs } = await (supabase as any)
    .from("portal_production_inputs")
    .select(`
      package_id,
      portal_production_entries!inner(status, organisation_id)
    `)
    .eq("portal_production_entries.status", "draft")
    .eq("portal_production_entries.organisation_id", orgId);
  const packagesInProductionDrafts = new Set<string>(
    (draftInputs ?? []).map((row: { package_id: string }) => row.package_id)
  );

  // Outgoing draft/pending shipments holding any of our packages.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outgoingDraftPkgs } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      shipments!inner!inventory_packages_shipment_id_fkey(shipment_code, from_organisation_id, status)
    `)
    .eq("shipments.from_organisation_id", orgId)
    .in("shipments.status", ["draft", "pending"]);
  const packagesInOutgoingShipment = new Map<string, string>();
  for (const row of (outgoingDraftPkgs ?? []) as { id: string; shipments: { shipment_code: string } | null }[]) {
    if (row.shipments?.shipment_code) {
      packagesInOutgoingShipment.set(row.id, row.shipments.shipment_code);
    }
  }

  // OTHER plans referencing any of our packages. Builds package_id -> plan_names map.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let planLookupQuery = (supabase as any)
    .from("production_plan_packages")
    .select(`
      inventory_package_id,
      production_plans!inner(id, name, organisation_id)
    `)
    .eq("production_plans.organisation_id", orgId);
  if (excludePlanId) {
    planLookupQuery = planLookupQuery.neq("plan_id", excludePlanId);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: otherPlanRows } = await planLookupQuery;
  const packagesInOtherPlans = new Map<string, string[]>();
  for (const row of (otherPlanRows ?? []) as {
    inventory_package_id: string;
    production_plans: { name: string } | null;
  }[]) {
    const name = row.production_plans?.name;
    if (!name) continue;
    const list = packagesInOtherPlans.get(row.inventory_package_id) ?? [];
    if (!list.includes(name)) list.push(name);
    packagesInOtherPlans.set(row.inventory_package_id, list);
  }

  // Packages already on THIS plan (to exclude from the selector list).
  const onThisPlan = new Set<string>();
  if (excludePlanId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: thisPlanPkgs } = await (supabase as any)
      .from("production_plan_packages")
      .select("inventory_package_id")
      .eq("plan_id", excludePlanId);
    for (const row of (thisPlanPkgs ?? []) as { inventory_package_id: string }[]) {
      onThisPlan.add(row.inventory_package_id);
    }
  }

  // Now fetch the union of inventory sources — same three queries as the
  // shipment selector. We INCLUDE packages in production drafts and outgoing
  // shipments (plans are informational).
  const baseFields = `
    id, package_number, shipment_id,
    product_name_id, wood_species_id, humidity_id, type_id, processing_id, fsc_id, quality_id,
    thickness, width, length, pieces, volume_m3, status, notes,
    ref_product_names!inventory_packages_product_name_id_fkey(value),
    ref_wood_species!inventory_packages_wood_species_id_fkey(value),
    ref_humidity!inventory_packages_humidity_id_fkey(value),
    ref_types!inventory_packages_type_id_fkey(value),
    ref_processing!inventory_packages_processing_id_fkey(value),
    ref_fsc!inventory_packages_fsc_id_fkey(value),
    ref_quality!inventory_packages_quality_id_fkey(value)
  `;

  // Query 1: shipment-sourced (received into this org).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipmentData } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      ${baseFields},
      shipments!inner!inventory_packages_shipment_id_fkey(shipment_code, to_organisation_id, status)
    `)
    .eq("shipments.to_organisation_id", orgId)
    .in("shipments.status", ["accepted", "completed"])
    .in("status", ["available", "produced"]);

  // Query 2: production-sourced (still owned by this org).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: productionData } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      ${baseFields},
      portal_production_entries!inner(organisation_id)
    `)
    .eq("portal_production_entries.organisation_id", orgId)
    .eq("organisation_id", orgId)
    .eq("status", "produced");

  // Query 3: direct inventory (admin-added, no shipment or production source).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: directData } = await (supabase as any)
    .from("inventory_packages")
    .select(baseFields)
    .eq("organisation_id", orgId)
    .is("shipment_id", null)
    .is("production_entry_id", null)
    .in("status", ["available", "produced"]);

  const allData = [...(shipmentData ?? []), ...(productionData ?? []), ...(directData ?? [])];
  const seenIds = new Set<string>();
  const uniqueData = allData.filter((pkg: { id: string }) => {
    if (seenIds.has(pkg.id)) return false;
    if (onThisPlan.has(pkg.id)) return false; // already in this plan — hide
    // Packages earmarked for any outgoing draft/pending shipment are excluded
    // from plan selection — they're already committed to leaving inventory.
    if (packagesInOutgoingShipment.has(pkg.id)) return false;
    seenIds.add(pkg.id);
    return true;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages: PlanAvailablePackage[] = uniqueData.map((pkg: any) => {
    const otherPlans = packagesInOtherPlans.get(pkg.id) ?? [];
    return {
      id: pkg.id,
      packageNumber: pkg.package_number,
      shipmentCode: pkg.shipments?.shipment_code ?? "",
      productNameId: pkg.product_name_id,
      productName: pkg.ref_product_names?.value ?? null,
      woodSpeciesId: pkg.wood_species_id,
      woodSpecies: pkg.ref_wood_species?.value ?? null,
      humidityId: pkg.humidity_id,
      humidity: pkg.ref_humidity?.value ?? null,
      typeId: pkg.type_id,
      typeName: pkg.ref_types?.value ?? null,
      processingId: pkg.processing_id,
      processing: pkg.ref_processing?.value ?? null,
      fscId: pkg.fsc_id,
      fsc: pkg.ref_fsc?.value ?? null,
      qualityId: pkg.quality_id,
      quality: pkg.ref_quality?.value ?? null,
      thickness: pkg.thickness,
      width: pkg.width,
      length: pkg.length,
      pieces: pkg.pieces,
      volumeM3: pkg.volume_m3 != null ? Number(pkg.volume_m3) : null,
      notes: pkg.notes ?? null,
      inProductionDraft: packagesInProductionDrafts.has(pkg.id),
      inOutgoingShipment: packagesInOutgoingShipment.has(pkg.id),
      outgoingShipmentCode: packagesInOutgoingShipment.get(pkg.id) ?? null,
      inAnotherPlan: otherPlans.length > 0,
      otherPlanNames: otherPlans.length > 0 ? otherPlans.join(", ") : null,
    };
  });

  packages.sort((a, b) => (a.packageNumber ?? "").localeCompare(b.packageNumber ?? ""));

  return { success: true, data: packages };
}
