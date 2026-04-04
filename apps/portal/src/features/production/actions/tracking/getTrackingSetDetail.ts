"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TrackingSetPackage {
  id: string;
  packageNumber: string;
  status: string;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
  productName: string | null;
  woodSpecies: string | null;
  sourceType: string; // "Shipment" | "Production" | "Direct"
  sourceDetail: string;
}

export interface TrackingSetDetail {
  id: string;
  name: string;
  createdAt: string;
  packages: TrackingSetPackage[];
}

/**
 * Fetch a single tracking set with its seed packages and package details.
 *
 * Multi-tenancy:
 * - Organisation users can only view their own organisation's sets
 * - Super Admin can view any set
 */
export async function getTrackingSetDetail(
  trackingSetId: string
): Promise<ActionResult<TrackingSetDetail>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!trackingSetId || !UUID_REGEX.test(trackingSetId)) {
    return { success: false, error: "Invalid tracking set ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Fetch the tracking set
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: set, error: setError } = await (supabase as any)
    .from("production_tracking_sets")
    .select("id, name, organisation_id, created_at")
    .eq("id", trackingSetId)
    .single();

  if (setError || !set) {
    return { success: false, error: "Tracking set not found", code: "NOT_FOUND" };
  }

  // Verify ownership
  if (isOrganisationUser(session) && !isSuperAdmin(session) && set.organisation_id !== session.organisationId) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Fetch tracking packages with inventory package details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trackingPackages, error: pkgError } = await (supabase as any)
    .from("production_tracking_packages")
    .select(`
      package_id,
      inventory_packages(
        id,
        package_number,
        status,
        thickness,
        width,
        length,
        pieces,
        volume_m3,
        shipment_id,
        source_shipment_id,
        production_entry_id,
        ref_product_names!inventory_packages_product_name_id_fkey(value),
        ref_wood_species!inventory_packages_wood_species_id_fkey(value)
      )
    `)
    .eq("tracking_set_id", trackingSetId);

  if (pkgError) {
    return { success: false, error: pkgError.message, code: "QUERY_FAILED" };
  }

  // Collect production entry IDs and shipment IDs for source lookups
  const productionEntryIds = new Set<string>();
  const shipmentIds = new Set<string>();

  for (const tp of (trackingPackages ?? []) as any[]) {
    const pkg = tp.inventory_packages;
    if (!pkg) continue;
    if (pkg.production_entry_id) productionEntryIds.add(pkg.production_entry_id);
    const sourceShipmentId = pkg.source_shipment_id || pkg.shipment_id;
    if (sourceShipmentId) shipmentIds.add(sourceShipmentId);
  }

  // Fetch production entries for source info
  const productionMap = new Map<string, { processName: string; date: string }>();
  if (productionEntryIds.size > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prodData } = await (supabase as any)
      .from("portal_production_entries")
      .select("id, production_date, ref_processes(value)")
      .in("id", [...productionEntryIds]);

    for (const p of (prodData ?? []) as any[]) {
      productionMap.set(p.id, {
        processName: p.ref_processes?.value ?? "Unknown",
        date: p.production_date ?? "",
      });
    }
  }

  // Fetch shipments for source info
  const shipmentsMap = new Map<string, string>();
  if (shipmentIds.size > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shipmentsData } = await (supabase as any)
      .from("shipments")
      .select("id, shipment_code")
      .in("id", [...shipmentIds]);

    for (const s of (shipmentsData ?? []) as any[]) {
      shipmentsMap.set(s.id, s.shipment_code);
    }
  }

  // Fetch production inputs to restore original pieces/volume for consumed packages
  const packageIds = ((trackingPackages ?? []) as any[])
    .map((tp: any) => tp.inventory_packages?.id)
    .filter(Boolean) as string[];

  const consumedInMap = new Map<string, { piecesUsed: number; volumeM3: number }>();
  if (packageIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inputsData } = await (supabase as any)
      .from("portal_production_inputs")
      .select("package_id, pieces_used, volume_m3")
      .in("package_id", packageIds);

    for (const input of (inputsData ?? []) as any[]) {
      const existing = consumedInMap.get(input.package_id);
      consumedInMap.set(input.package_id, {
        piecesUsed: (existing?.piecesUsed ?? 0) + (input.pieces_used ?? 0),
        volumeM3: (existing?.volumeM3 ?? 0) + (Number(input.volume_m3) ?? 0),
      });
    }
  }

  // Map to response objects
  const packages: TrackingSetPackage[] = ((trackingPackages ?? []) as any[])
    .map((tp: any) => {
      const pkg = tp.inventory_packages;
      if (!pkg) return null;

      // Determine source
      let sourceType = "Direct";
      let sourceDetail = "";

      const prodEntry = pkg.production_entry_id
        ? productionMap.get(pkg.production_entry_id)
        : null;

      if (prodEntry) {
        sourceType = "Production";
        sourceDetail = `${prodEntry.processName} ${prodEntry.date}`;
      } else {
        const sourceShipmentId = pkg.source_shipment_id || pkg.shipment_id;
        if (sourceShipmentId) {
          const code = shipmentsMap.get(sourceShipmentId);
          if (code) {
            sourceType = "Shipment";
            sourceDetail = code;
          }
        }
      }

      // For consumed packages, restore original pieces/volume from production inputs
      const consumed = pkg.status === "consumed" ? consumedInMap.get(pkg.id) : null;

      return {
        id: pkg.id,
        packageNumber: pkg.package_number,
        status: pkg.status,
        thickness: pkg.thickness,
        width: pkg.width,
        length: pkg.length,
        pieces: consumed ? String(consumed.piecesUsed) : pkg.pieces,
        volumeM3: consumed ? consumed.volumeM3 : (pkg.volume_m3 != null ? Number(pkg.volume_m3) : null),
        productName: pkg.ref_product_names?.value ?? null,
        woodSpecies: pkg.ref_wood_species?.value ?? null,
        sourceType,
        sourceDetail,
      };
    })
    .filter(Boolean) as TrackingSetPackage[];

  // Natural sort by package number (e.g. 1, 2, 10 not 1, 10, 2)
  packages.sort((a, b) =>
    (a.packageNumber ?? "").localeCompare(b.packageNumber ?? "", undefined, { numeric: true, sensitivity: "base" })
  );

  return {
    success: true,
    data: {
      id: set.id,
      name: set.name,
      createdAt: set.created_at,
      packages,
    },
  };
}
