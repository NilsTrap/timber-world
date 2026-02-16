"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer } from "@/lib/auth";
import type { ActionResult } from "../types";
import type { PackageListItem } from "@/features/shipments/types";

/**
 * Get Available Packages for Production Input
 *
 * Fetches inventory packages at the producer's facility,
 * excluding packages already added as inputs to the given production entry.
 */
export async function getAvailablePackages(
  productionEntryId: string
): Promise<ActionResult<PackageListItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isProducer(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!session.organisationId) {
    return { success: false, error: "Your account is not linked to a facility. Contact Admin.", code: "NO_ORGANISATION_LINK" };
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!productionEntryId || !UUID_REGEX.test(productionEntryId)) {
    return { success: false, error: "Invalid production entry ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Get packages already used as inputs in this entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingInputs, error: inputsError } = await (supabase as any)
    .from("portal_production_inputs")
    .select("package_id")
    .eq("production_entry_id", productionEntryId);

  if (inputsError) {
    console.error("Failed to fetch existing inputs:", inputsError);
    return { success: false, error: `Failed to fetch inputs: ${inputsError.message}`, code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usedPackageIds = (existingInputs as any[]).map((i: any) => i.package_id);

  const refSelect = `
    ref_product_names!inventory_packages_product_name_id_fkey(value),
    ref_wood_species!inventory_packages_wood_species_id_fkey(value),
    ref_humidity!inventory_packages_humidity_id_fkey(value),
    ref_types!inventory_packages_type_id_fkey(value),
    ref_processing!inventory_packages_processing_id_fkey(value),
    ref_fsc!inventory_packages_fsc_id_fkey(value),
    ref_quality!inventory_packages_quality_id_fkey(value)
  `;

  // Query 1: Shipment-sourced packages at producer's facility (exclude consumed and zero-pieces, allow null pieces)
  // Only include packages from shipments that have been accepted or completed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let shipmentQuery = (supabase as any)
    .from("inventory_packages")
    .select(`
      id, package_number, shipment_id, thickness, width, length, pieces, volume_m3, notes,
      shipments!inner!inventory_packages_shipment_id_fkey(shipment_code, to_organisation_id, status),
      ${refSelect}
    `)
    .eq("shipments.to_organisation_id", session.organisationId)
    .in("shipments.status", ["accepted", "completed"])
    .neq("status", "consumed")
    .or("pieces.neq.0,pieces.is.null,volume_m3.gt.0")
    .order("package_number", { ascending: true });

  if (usedPackageIds.length > 0) {
    shipmentQuery = shipmentQuery.not("id", "in", `(${usedPackageIds.join(",")})`);
  }

  // Query 2: Production-sourced packages owned by this producer's organisation (status: produced, non-zero pieces, allow null, or has volume)
  // Filter by organisation_id for proper multi-tenant isolation (not created_by)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let productionQuery = (supabase as any)
    .from("inventory_packages")
    .select(`
      id, package_number, shipment_id, thickness, width, length, pieces, volume_m3, notes,
      portal_production_entries!inner(organisation_id),
      ${refSelect}
    `)
    .eq("portal_production_entries.organisation_id", session.organisationId)
    .eq("status", "produced")
    .or("pieces.neq.0,pieces.is.null,volume_m3.gt.0")
    .order("package_number", { ascending: true });

  if (usedPackageIds.length > 0) {
    productionQuery = productionQuery.not("id", "in", `(${usedPackageIds.join(",")})`);
  }

  // Query 2b: Production-sourced packages where the production entry was deleted (orphaned)
  // These have production_entry_id set but the entry no longer exists or org matches directly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orphanedProductionQuery = (supabase as any)
    .from("inventory_packages")
    .select(`
      id, package_number, shipment_id, thickness, width, length, pieces, volume_m3, notes,
      ${refSelect}
    `)
    .eq("organisation_id", session.organisationId)
    .not("production_entry_id", "is", null)
    .is("shipment_id", null)
    .neq("status", "consumed")
    .or("pieces.neq.0,pieces.is.null,volume_m3.gt.0")
    .order("package_number", { ascending: true });

  if (usedPackageIds.length > 0) {
    orphanedProductionQuery = orphanedProductionQuery.not("id", "in", `(${usedPackageIds.join(",")})`);
  }

  // Query 3: Direct inventory packages (admin-added, no shipment or production source)
  // These have organisation_id set directly on the package
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let directQuery = (supabase as any)
    .from("inventory_packages")
    .select(`
      id, package_number, shipment_id, thickness, width, length, pieces, volume_m3, notes,
      ${refSelect}
    `)
    .eq("organisation_id", session.organisationId)
    .is("shipment_id", null)
    .is("production_entry_id", null)
    .neq("status", "consumed")
    .or("pieces.neq.0,pieces.is.null,volume_m3.gt.0")
    .order("package_number", { ascending: true });

  if (usedPackageIds.length > 0) {
    directQuery = directQuery.not("id", "in", `(${usedPackageIds.join(",")})`);
  }

  // Query 4: Packages in outgoing draft shipments FROM this org (still in inventory)
  // Only drafts stay in inventory - once "on the way" (pending), they leave inventory
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let outgoingDraftQuery = (supabase as any)
    .from("inventory_packages")
    .select(`
      id, package_number, shipment_id, thickness, width, length, pieces, volume_m3, notes,
      shipments!inner!inventory_packages_shipment_id_fkey(shipment_code, from_organisation_id, status),
      ${refSelect}
    `)
    .eq("shipments.from_organisation_id", session.organisationId)
    .eq("shipments.status", "draft")
    .neq("status", "consumed")
    .or("pieces.neq.0,pieces.is.null,volume_m3.gt.0")
    .order("package_number", { ascending: true });

  if (usedPackageIds.length > 0) {
    outgoingDraftQuery = outgoingDraftQuery.not("id", "in", `(${usedPackageIds.join(",")})`);
  }

  const [shipmentResult, productionResult, orphanedResult, directResult, outgoingDraftResult] = await Promise.all([
    shipmentQuery,
    productionQuery,
    orphanedProductionQuery,
    directQuery,
    outgoingDraftQuery,
  ]);

  if (shipmentResult.error) {
    console.error("Failed to fetch shipment packages:", shipmentResult.error);
    return { success: false, error: `Failed to fetch packages: ${shipmentResult.error.message}`, code: "QUERY_FAILED" };
  }

  if (productionResult.error) {
    console.error("Failed to fetch production packages:", productionResult.error);
    // Non-fatal: continue with other packages
  }

  if (orphanedResult.error) {
    console.error("Failed to fetch orphaned production packages:", orphanedResult.error);
    // Non-fatal: continue with other packages
  }

  if (directResult.error) {
    console.error("Failed to fetch direct packages:", directResult.error);
    // Non-fatal: continue with other packages
  }

  if (outgoingDraftResult.error) {
    console.error("Failed to fetch outgoing draft packages:", outgoingDraftResult.error);
    // Non-fatal: continue with other packages
  }

  // Merge all result sets and deduplicate by id
  const allData = [
    ...(shipmentResult.data ?? []),
    ...(productionResult.data ?? []),
    ...(orphanedResult.data ?? []),
    ...(directResult.data ?? []),
    ...(outgoingDraftResult.data ?? []),
  ];
  const seenIds = new Set<string>();
  const uniqueData = allData.filter((pkg: { id: string }) => {
    if (seenIds.has(pkg.id)) return false;
    seenIds.add(pkg.id);
    return true;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages: PackageListItem[] = uniqueData.map((pkg: any) => ({
    id: pkg.id,
    packageNumber: pkg.package_number,
    shipmentCode: pkg.shipments?.shipment_code ?? "",
    shipmentId: pkg.shipment_id,
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
    pieces: pkg.pieces,
    volumeM3: pkg.volume_m3 != null ? Number(pkg.volume_m3) : null,
    // Producer only sees their own org's packages, so use session org info
    organisationName: session.organisationName,
    organisationCode: session.organisationCode,
    notes: pkg.notes ?? null,
  }));

  // Sort by package number after merging
  packages.sort((a, b) => (a.packageNumber ?? "").localeCompare(b.packageNumber ?? ""));

  return { success: true, data: packages };
}
