"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult, ShipmentListItem } from "../types";

/**
 * Get Shipments
 *
 * Fetches all shipments with organisation names and package aggregates.
 * Ordered by shipment_date DESC (newest first).
 * Admin only.
 *
 * TODO: Generate proper Supabase types from schema to remove `as any` casts
 * across all shipment actions (getShipments, getShipmentDetail, getPackages, updateShipmentPackages)
 */
export async function getShipments(): Promise<ActionResult<ShipmentListItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // TODO: Replace embedded inventory_packages(volume_m3) with a DB view or function
  // that returns aggregated package_count + total_volume_m3 to avoid transferring all
  // package rows per shipment just for count/sum computation
  // Note: FK constraints kept original names (shipments_from_party_id_fkey) after column rename
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("shipments")
    .select(`
      id,
      shipment_code,
      shipment_date,
      transport_cost_eur,
      from_organisation:organisations!shipments_from_party_id_fkey(code, name),
      to_organisation:organisations!shipments_to_party_id_fkey(code, name),
      inventory_packages(volume_m3)
    `)
    .order("shipment_date", { ascending: false });

  if (error) {
    console.error("Failed to fetch shipments:", error);
    return { success: false, error: `Failed to fetch shipments: ${error.message}`, code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shipments: ShipmentListItem[] = (data as any[]).map((row: any) => ({
    id: row.id,
    shipmentCode: row.shipment_code,
    fromOrganisationName: row.from_organisation?.name ?? "",
    fromOrganisationCode: row.from_organisation?.code ?? "",
    toOrganisationName: row.to_organisation?.name ?? "",
    toOrganisationCode: row.to_organisation?.code ?? "",
    shipmentDate: row.shipment_date,
    transportCostEur: row.transport_cost_eur != null ? Number(row.transport_cost_eur) : null,
    packageCount: row.inventory_packages?.length ?? 0,
    totalVolumeM3: (row.inventory_packages ?? []).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, pkg: any) => sum + (pkg.volume_m3 != null ? Number(pkg.volume_m3) : 0),
      0
    ),
  }));

  return { success: true, data: shipments };
}
