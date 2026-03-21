"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin, isProducer } from "@/lib/auth";
import type { ActionResult } from "@/features/shipments/types";

export interface AuditPackageItem {
  id: string;
  packageNumber: string;
  status: string;
  organisationCode: string | null;
  organisationName: string | null;
  // Product attributes
  productName: string | null;
  woodSpecies: string | null;
  humidity: string | null;
  typeName: string | null;
  processing: string | null;
  fsc: string | null;
  quality: string | null;
  // Dimensions
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
  // Source: how it entered inventory
  sourceType: string; // "Shipment" | "Production" | "Direct"
  sourceDetail: string; // e.g. "TWG-INE-001" or "Sanding 2026-01-30"
  // Destination: how it left inventory (empty if still available)
  destinationType: string; // "" | "Consumed" | "Shipped"
  destinationDetail: string; // e.g. "Sanding 2026-01-30" or "INE-TWG-001"
}

/**
 * Get Audit Packages
 *
 * Fetches ALL inventory packages (including consumed) with source and destination tracing.
 * Read-only. Super Admin only.
 */
export async function getAuditPackages(orgId?: string): Promise<ActionResult<AuditPackageItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  // Producers can only audit their own org; super admins can audit any/all
  if (isProducer(session)) {
    const sessionOrgId = session.currentOrganizationId || session.organisationId;
    if (!sessionOrgId) {
      return { success: false, error: "Your account is not linked to a facility.", code: "NO_ORGANISATION_LINK" };
    }
    // Force org filter to their own org
    orgId = sessionOrgId;
  } else if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // 1. Fetch ALL packages (including consumed), optionally filtered by org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      package_number,
      status,
      shipment_id,
      source_shipment_id,
      production_entry_id,
      organisation_id,
      thickness,
      width,
      length,
      pieces,
      volume_m3,
      notes,
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_fsc!inventory_packages_fsc_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value)
    `)
    .order("package_number", { ascending: true });

  if (orgId) {
    query = query.eq("organisation_id", orgId);
  }

  const { data: packagesData, error: packagesError } = await query;

  if (packagesError) {
    console.error("Failed to fetch packages:", packagesError);
    return { success: false, error: `Failed to fetch packages: ${packagesError.message}`, code: "QUERY_FAILED" };
  }

  // 2. Fetch all organisations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgsData } = await (supabase as any)
    .from("organisations")
    .select("id, code, name");

  const orgsMap = new Map<string, { code: string; name: string }>();
  if (orgsData) {
    for (const org of orgsData as { id: string; code: string; name: string }[]) {
      orgsMap.set(org.id, { code: org.code, name: org.name });
    }
  }

  // 3. Fetch all shipments for source/destination lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allShipmentIds = new Set<string>();
  for (const pkg of packagesData as { shipment_id: string | null; source_shipment_id: string | null }[]) {
    if (pkg.shipment_id) allShipmentIds.add(pkg.shipment_id);
    if (pkg.source_shipment_id) allShipmentIds.add(pkg.source_shipment_id);
  }

  const shipmentsMap = new Map<string, { code: string; fromOrg: string; toOrg: string; date: string }>();
  if (allShipmentIds.size > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shipmentsData } = await (supabase as any)
      .from("shipments")
      .select("id, shipment_code, from_organisation_id, to_organisation_id, shipment_date")
      .in("id", [...allShipmentIds]);

    if (shipmentsData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of shipmentsData as any[]) {
        shipmentsMap.set(s.id, {
          code: s.shipment_code,
          fromOrg: orgsMap.get(s.from_organisation_id)?.code ?? "",
          toOrg: orgsMap.get(s.to_organisation_id)?.code ?? "",
          date: s.shipment_date ?? "",
        });
      }
    }
  }

  // 4. Fetch all production entries for source lookup
  const allProductionIds = new Set<string>();
  for (const pkg of packagesData as { production_entry_id: string | null }[]) {
    if (pkg.production_entry_id) allProductionIds.add(pkg.production_entry_id);
  }

  const productionMap = new Map<string, { processName: string; date: string }>();
  if (allProductionIds.size > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prodData } = await (supabase as any)
      .from("portal_production_entries")
      .select("id, production_date, ref_processes(value)")
      .in("id", [...allProductionIds]);

    if (prodData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of prodData as any[]) {
        productionMap.set(p.id, {
          processName: p.ref_processes?.value ?? "Unknown",
          date: p.production_date ?? "",
        });
      }
    }
  }

  // 5. Fetch all production inputs to find where packages were consumed (and their original values)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inputsData } = await (supabase as any)
    .from("portal_production_inputs")
    .select("package_id, production_entry_id, pieces_used, volume_m3");

  // Map: package_id -> { production_entry_id, pieces_used, volume_m3 }
  const consumedInMap = new Map<string, { entryId: string; piecesUsed: number; volumeM3: number }>();
  if (inputsData) {
    for (const input of inputsData as { package_id: string; production_entry_id: string; pieces_used: number | null; volume_m3: number | null }[]) {
      const existing = consumedInMap.get(input.package_id);
      // Accumulate if the same package was consumed across multiple inputs
      consumedInMap.set(input.package_id, {
        entryId: input.production_entry_id,
        piecesUsed: (existing?.piecesUsed ?? 0) + (input.pieces_used ?? 0),
        volumeM3: (existing?.volumeM3 ?? 0) + (Number(input.volume_m3) ?? 0),
      });
    }
  }

  // 6. Find packages that were shipped out (have source_shipment_id set, meaning they moved)
  // Already handled: shipment_id != source_shipment_id means it was forwarded

  // 7. Build audit items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages: AuditPackageItem[] = (packagesData as any[]).map((pkg: any) => {
    const org = pkg.organisation_id ? orgsMap.get(pkg.organisation_id) : null;

    // Determine source
    let sourceType = "Direct";
    let sourceDetail = "";

    // Source shipment (original incoming)
    const sourceShipmentId = pkg.source_shipment_id || pkg.shipment_id;
    const prodEntry = pkg.production_entry_id ? productionMap.get(pkg.production_entry_id) : null;

    if (prodEntry) {
      sourceType = "Production";
      sourceDetail = `${prodEntry.processName} ${prodEntry.date}`;
    } else if (sourceShipmentId) {
      const shipment = shipmentsMap.get(sourceShipmentId);
      if (shipment) {
        sourceType = "Shipment";
        sourceDetail = shipment.code;
      }
    }

    // Determine destination
    let destinationType = "";
    let destinationDetail = "";

    if (pkg.status === "consumed") {
      const consumedInfo = consumedInMap.get(pkg.id);
      if (consumedInfo) {
        const consumedProd = productionMap.get(consumedInfo.entryId);
        destinationType = "Consumed";
        destinationDetail = consumedProd
          ? `${consumedProd.processName} ${consumedProd.date}`
          : "Unknown process";
      } else {
        destinationType = "Consumed";
        destinationDetail = "";
      }
    } else if (pkg.source_shipment_id && pkg.shipment_id && pkg.source_shipment_id !== pkg.shipment_id) {
      // Package was forwarded to another shipment
      const outShipment = shipmentsMap.get(pkg.shipment_id);
      if (outShipment) {
        destinationType = "Shipped";
        destinationDetail = outShipment.code;
      }
    }

    return {
      id: pkg.id,
      packageNumber: pkg.package_number,
      status: pkg.status,
      organisationCode: org?.code ?? null,
      organisationName: org?.name ?? null,
      productName: pkg.ref_product_names?.value ?? null,
      woodSpecies: pkg.ref_wood_species?.value ?? null,
      humidity: pkg.ref_humidity?.value ?? null,
      typeName: pkg.ref_types?.value ?? null,
      processing: pkg.ref_processing?.value ?? null,
      fsc: pkg.ref_fsc?.value ?? null,
      quality: pkg.ref_quality?.value ?? null,
      thickness: pkg.thickness,
      width: pkg.width,
      length: pkg.length,
      // For consumed packages, restore original pieces/volume from production inputs
      pieces: pkg.status === "consumed" && consumedInMap.has(pkg.id)
        ? String(consumedInMap.get(pkg.id)!.piecesUsed)
        : pkg.pieces,
      volumeM3: pkg.status === "consumed" && consumedInMap.has(pkg.id)
        ? consumedInMap.get(pkg.id)!.volumeM3
        : (pkg.volume_m3 != null ? Number(pkg.volume_m3) : null),
      sourceType,
      sourceDetail,
      destinationType,
      destinationDetail,
    };
  });

  // Sort by Org → Package number (natural sort)
  packages.sort((a, b) => {
    const orgCmp = (a.organisationCode ?? "").localeCompare(b.organisationCode ?? "");
    if (orgCmp !== 0) return orgCmp;
    const pkgA = a.packageNumber ?? "";
    const pkgB = b.packageNumber ?? "";
    const prefA = pkgA.replace(/\d+$/, "");
    const prefB = pkgB.replace(/\d+$/, "");
    const prefCmp = prefA.localeCompare(prefB);
    if (prefCmp !== 0) return prefCmp;
    const numA = parseInt(pkgA.replace(/\D/g, "") || "0", 10);
    const numB = parseInt(pkgB.replace(/\D/g, "") || "0", 10);
    return numA - numB;
  });

  return { success: true, data: packages };
}
