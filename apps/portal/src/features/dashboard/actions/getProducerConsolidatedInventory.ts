"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer } from "@/lib/auth";
import type { ActionResult, ConsolidatedInventoryItem } from "../types";

/**
 * Get Producer Consolidated Inventory
 *
 * Groups the producer's inventory packages by 6 attributes:
 * - Product Name
 * - Wood Species
 * - Humidity
 * - Type
 * - Processing
 * - Quality
 *
 * Returns totals (package count, pieces, volume) for each unique combination.
 * Uses the same query logic as getProducerPackages to determine ownership.
 */
export async function getProducerConsolidatedInventory(): Promise<ActionResult<ConsolidatedInventoryItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isProducer(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const orgId = session.currentOrganizationId || session.organisationId;
  if (!orgId) {
    return { success: false, error: "No organisation linked", code: "NO_ORGANISATION_LINK" };
  }

  const supabase = await createClient();
  const allPackages: {
    id: string;
    pieces: string | null;
    volume_m3: number | null;
    productName: string | null;
    woodSpecies: string | null;
    humidity: string | null;
    typeName: string | null;
    processing: string | null;
    quality: string | null;
  }[] = [];

  // Query 1: Incoming shipments (accepted/completed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipmentPkgs } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id, pieces, volume_m3,
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value),
      shipments!inner!inventory_packages_shipment_id_fkey(to_organisation_id, status)
    `)
    .eq("shipments.to_organisation_id", orgId)
    .in("shipments.status", ["accepted", "completed"])
    .neq("status", "consumed");

  if (shipmentPkgs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allPackages.push(...shipmentPkgs.map((p: any) => ({
      id: p.id,
      pieces: p.pieces,
      volume_m3: p.volume_m3,
      productName: p.ref_product_names?.value ?? null,
      woodSpecies: p.ref_wood_species?.value ?? null,
      humidity: p.ref_humidity?.value ?? null,
      typeName: p.ref_types?.value ?? null,
      processing: p.ref_processing?.value ?? null,
      quality: p.ref_quality?.value ?? null,
    })));
  }

  // Query 2: Production packages (status=produced, org matches)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: productionPkgs } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id, pieces, volume_m3,
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value),
      portal_production_entries!inner(organisation_id)
    `)
    .eq("portal_production_entries.organisation_id", orgId)
    .eq("organisation_id", orgId)
    .eq("status", "produced");

  if (productionPkgs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allPackages.push(...productionPkgs.map((p: any) => ({
      id: p.id,
      pieces: p.pieces,
      volume_m3: p.volume_m3,
      productName: p.ref_product_names?.value ?? null,
      woodSpecies: p.ref_wood_species?.value ?? null,
      humidity: p.ref_humidity?.value ?? null,
      typeName: p.ref_types?.value ?? null,
      processing: p.ref_processing?.value ?? null,
      quality: p.ref_quality?.value ?? null,
    })));
  }

  // Query 3: Direct packages (no shipment, no production)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: directPkgs } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id, pieces, volume_m3,
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value)
    `)
    .eq("organisation_id", orgId)
    .is("shipment_id", null)
    .is("production_entry_id", null)
    .neq("status", "consumed");

  if (directPkgs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allPackages.push(...directPkgs.map((p: any) => ({
      id: p.id,
      pieces: p.pieces,
      volume_m3: p.volume_m3,
      productName: p.ref_product_names?.value ?? null,
      woodSpecies: p.ref_wood_species?.value ?? null,
      humidity: p.ref_humidity?.value ?? null,
      typeName: p.ref_types?.value ?? null,
      processing: p.ref_processing?.value ?? null,
      quality: p.ref_quality?.value ?? null,
    })));
  }

  // Query 4: Outgoing draft shipments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: draftPkgs } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id, pieces, volume_m3,
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value),
      shipments!inner!inventory_packages_shipment_id_fkey(from_organisation_id, status)
    `)
    .eq("shipments.from_organisation_id", orgId)
    .eq("shipments.status", "draft")
    .neq("status", "consumed");

  if (draftPkgs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allPackages.push(...draftPkgs.map((p: any) => ({
      id: p.id,
      pieces: p.pieces,
      volume_m3: p.volume_m3,
      productName: p.ref_product_names?.value ?? null,
      woodSpecies: p.ref_wood_species?.value ?? null,
      humidity: p.ref_humidity?.value ?? null,
      typeName: p.ref_types?.value ?? null,
      processing: p.ref_processing?.value ?? null,
      quality: p.ref_quality?.value ?? null,
    })));
  }

  // Query 5: Outgoing pending shipments (on the way)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingPkgs } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id, pieces, volume_m3,
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value),
      shipments!inner!inventory_packages_shipment_id_fkey(from_organisation_id, status)
    `)
    .eq("shipments.from_organisation_id", orgId)
    .eq("shipments.status", "pending")
    .neq("status", "consumed");

  if (pendingPkgs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allPackages.push(...pendingPkgs.map((p: any) => ({
      id: p.id,
      pieces: p.pieces,
      volume_m3: p.volume_m3,
      productName: p.ref_product_names?.value ?? null,
      woodSpecies: p.ref_wood_species?.value ?? null,
      humidity: p.ref_humidity?.value ?? null,
      typeName: p.ref_types?.value ?? null,
      processing: p.ref_processing?.value ?? null,
      quality: p.ref_quality?.value ?? null,
    })));
  }

  // Deduplicate by ID and group by 6 attributes
  const seenIds = new Set<string>();
  const groupMap = new Map<string, ConsolidatedInventoryItem>();

  for (const pkg of allPackages) {
    if (seenIds.has(pkg.id)) continue;
    seenIds.add(pkg.id);

    const key = [
      pkg.productName ?? "",
      pkg.woodSpecies ?? "",
      pkg.humidity ?? "",
      pkg.typeName ?? "",
      pkg.processing ?? "",
      pkg.quality ?? "",
    ].join("|");

    const existing = groupMap.get(key);
    const pieces = pkg.pieces ? parseInt(pkg.pieces, 10) : 0;
    const volumeM3 = Number(pkg.volume_m3) || 0;

    if (existing) {
      existing.packageCount++;
      existing.totalPieces += isNaN(pieces) ? 0 : pieces;
      existing.totalVolumeM3 += volumeM3;
    } else {
      groupMap.set(key, {
        productName: pkg.productName,
        woodSpecies: pkg.woodSpecies,
        humidity: pkg.humidity,
        typeName: pkg.typeName,
        processing: pkg.processing,
        quality: pkg.quality,
        packageCount: 1,
        totalPieces: isNaN(pieces) ? 0 : pieces,
        totalVolumeM3: volumeM3,
      });
    }
  }

  // Sort by Product → Species → Humidity → Type → Processing → Quality
  const result = Array.from(groupMap.values()).sort((a, b) => {
    const fields: (keyof ConsolidatedInventoryItem)[] = [
      "productName",
      "woodSpecies",
      "humidity",
      "typeName",
      "processing",
      "quality",
    ];
    for (const field of fields) {
      const aVal = (a[field] as string | null) ?? "";
      const bVal = (b[field] as string | null) ?? "";
      const cmp = aVal.localeCompare(bVal);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });

  return { success: true, data: result };
}
