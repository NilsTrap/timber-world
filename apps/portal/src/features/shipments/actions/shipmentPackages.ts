"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * Add Packages to Shipment
 *
 * Links existing inventory packages to a draft shipment.
 * Only the shipment owner can add packages.
 */
export async function addPackagesToShipment(
  shipmentId: string,
  packageIds: string[]
): Promise<ActionResult<{ added: number }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  if (packageIds.length === 0) {
    return { success: false, error: "No packages selected", code: "NO_PACKAGES" };
  }

  const supabase = await createClient();

  // Verify shipment exists, is a draft, and belongs to user's org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: shipmentError } = await (supabase as any)
    .from("shipments")
    .select("id, from_organisation_id, status, shipment_number")
    .eq("id", shipmentId)
    .single();

  if (shipmentError || !shipment) {
    return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
  }

  if (shipment.from_organisation_id !== session.organisationId) {
    return { success: false, error: "Access denied", code: "FORBIDDEN" };
  }

  if (shipment.status !== "draft") {
    return { success: false, error: "Can only add packages to draft shipments", code: "NOT_DRAFT" };
  }

  // Verify packages exist and belong to user's organization
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packages, error: pkgError } = await (supabase as any)
    .from("inventory_packages")
    .select("id, organisation_id, shipment_id")
    .in("id", packageIds);

  if (pkgError) {
    console.error("Failed to verify packages:", pkgError);
    return { success: false, error: "Failed to verify packages", code: "QUERY_FAILED" };
  }

  // Filter valid packages (belong to user's org and not already in another shipment... actually they can be)
  // For this workflow, packages can be added to multiple shipments (drafts)
  // The actual inventory transfer happens on accept
  const validPackageIds = packages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((pkg: any) => pkg.organisation_id === session.organisationId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((pkg: any) => pkg.id);

  if (validPackageIds.length === 0) {
    return { success: false, error: "No valid packages to add", code: "NO_VALID_PACKAGES" };
  }

  // Get current max sequence in shipment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxSeqData } = await (supabase as any)
    .from("inventory_packages")
    .select("package_sequence")
    .eq("shipment_id", shipmentId)
    .order("package_sequence", { ascending: false })
    .limit(1)
    .single();

  let nextSequence = (maxSeqData?.package_sequence ?? 0) + 1;

  // Update packages to link to this shipment
  // For inter-org shipments, we're essentially "marking" which packages are part of the shipment
  // We'll update the shipment_id and generate new package numbers
  for (const pkgId of validPackageIds) {
    const packageNumber = `TWP-${String(shipment.shipment_number).padStart(3, "0")}-${String(nextSequence).padStart(3, "0")}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("inventory_packages")
      .update({
        shipment_id: shipmentId,
        package_sequence: nextSequence,
        package_number: packageNumber,
      })
      .eq("id", pkgId);

    nextSequence++;
  }

  return { success: true, data: { added: validPackageIds.length } };
}

/**
 * Remove Package from Shipment
 *
 * Removes a package from a draft shipment.
 * Only the shipment owner can remove packages.
 */
export async function removePackageFromShipment(
  shipmentId: string,
  packageId: string
): Promise<ActionResult<{ removed: true }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  const supabase = await createClient();

  // Verify shipment exists, is a draft, and belongs to user's org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: shipmentError } = await (supabase as any)
    .from("shipments")
    .select("id, from_organisation_id, status")
    .eq("id", shipmentId)
    .single();

  if (shipmentError || !shipment) {
    return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
  }

  if (shipment.from_organisation_id !== session.organisationId) {
    return { success: false, error: "Access denied", code: "FORBIDDEN" };
  }

  if (shipment.status !== "draft") {
    return { success: false, error: "Can only remove packages from draft shipments", code: "NOT_DRAFT" };
  }

  // Verify package exists and belongs to this shipment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pkg, error: pkgError } = await (supabase as any)
    .from("inventory_packages")
    .select("id, shipment_id")
    .eq("id", packageId)
    .single();

  if (pkgError || !pkg) {
    return { success: false, error: "Package not found", code: "NOT_FOUND" };
  }

  if (pkg.shipment_id !== shipmentId) {
    return { success: false, error: "Package not in this shipment", code: "WRONG_SHIPMENT" };
  }

  // For now, we'll just delete the package from the shipment
  // In a more complete implementation, we might want to "unlink" it
  // and return it to available inventory
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("inventory_packages")
    .delete()
    .eq("id", packageId);

  if (deleteError) {
    console.error("Failed to remove package:", deleteError);
    return { success: false, error: "Failed to remove package", code: "DELETE_FAILED" };
  }

  return { success: true, data: { removed: true } };
}

/**
 * Get Available Packages for Shipment
 *
 * Returns packages owned by the user's organization that can be added to a shipment.
 */
export async function getAvailablePackagesForShipment(
  shipmentId: string
): Promise<ActionResult<Array<{
  id: string;
  packageNumber: string;
  productName: string | null;
  woodSpecies: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
}>>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  const supabase = await createClient();

  // Get packages owned by user's org that are not already in this shipment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      package_number,
      thickness,
      width,
      length,
      pieces,
      volume_m3,
      status,
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value)
    `)
    .eq("organisation_id", session.organisationId)
    .in("status", ["available", "produced"])
    .neq("shipment_id", shipmentId)
    .order("package_number");

  if (error) {
    console.error("Failed to fetch available packages:", error);
    return { success: false, error: "Failed to fetch packages", code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages = (data as any[]).map((pkg: any) => ({
    id: pkg.id,
    packageNumber: pkg.package_number,
    productName: pkg.ref_product_names?.value ?? null,
    woodSpecies: pkg.ref_wood_species?.value ?? null,
    thickness: pkg.thickness,
    width: pkg.width,
    length: pkg.length,
    pieces: pkg.pieces,
    volumeM3: pkg.volume_m3 != null ? Number(pkg.volume_m3) : null,
  }));

  return { success: true, data: packages };
}
