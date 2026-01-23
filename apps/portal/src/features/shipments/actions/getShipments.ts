"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult, ShipmentListItem } from "../types";

/**
 * Get Shipments
 *
 * Fetches all shipments with party names and package aggregates.
 * Ordered by shipment_date DESC (newest first).
 * Admin only.
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("shipments")
    .select(`
      id,
      shipment_code,
      shipment_date,
      transport_cost_eur,
      from_party:parties!shipments_from_party_id_fkey(code, name),
      to_party:parties!shipments_to_party_id_fkey(code, name),
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
    fromPartyName: row.from_party?.name ?? "",
    fromPartyCode: row.from_party?.code ?? "",
    toPartyName: row.to_party?.name ?? "",
    toPartyCode: row.to_party?.code ?? "",
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
