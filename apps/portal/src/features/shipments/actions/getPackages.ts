"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult, PackageListItem } from "../types";

/**
 * Get Packages
 *
 * Fetches all inventory packages with resolved reference names and shipment codes.
 * Used in the Packages tab of the inventory overview.
 * Admin only.
 */
export async function getPackages(): Promise<ActionResult<PackageListItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      package_number,
      shipment_id,
      thickness,
      width,
      length,
      pieces,
      volume_m3,
      shipments(shipment_code),
      ref_product_names(value),
      ref_wood_species(value),
      ref_humidity(value)
    `)
    .order("package_number", { ascending: true });

  if (error) {
    console.error("Failed to fetch packages:", error);
    return { success: false, error: `Failed to fetch packages: ${error.message}`, code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages: PackageListItem[] = (data as any[]).map((pkg: any) => ({
    id: pkg.id,
    packageNumber: pkg.package_number,
    shipmentCode: pkg.shipments?.shipment_code ?? "",
    shipmentId: pkg.shipment_id,
    productName: pkg.ref_product_names?.value ?? null,
    woodSpecies: pkg.ref_wood_species?.value ?? null,
    humidity: pkg.ref_humidity?.value ?? null,
    thickness: pkg.thickness,
    width: pkg.width,
    length: pkg.length,
    pieces: pkg.pieces,
    volumeM3: pkg.volume_m3 != null ? Number(pkg.volume_m3) : null,
  }));

  return { success: true, data: packages };
}
