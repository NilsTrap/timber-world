"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, isSuperAdmin } from "@/lib/auth";
import type { ActionResult, ShipmentListItem } from "../types";

/**
 * Get Shipments
 *
 * Fetches all shipments with organisation names and package aggregates.
 * Ordered by shipment_date DESC (newest first).
 * Admin only.
 *
 * @param orgIds - Optional org IDs for Super Admin to filter by specific organisations (multi-select)
 *
 * TODO: Generate proper Supabase types from schema to remove `as any` casts
 * across all shipment actions (getShipments, getShipmentDetail, getPackages, updateShipmentPackages)
 */
export async function getShipments(orgIds?: string[]): Promise<ActionResult<ShipmentListItem[]>> {
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
  let query = (supabase as any)
    .from("shipments")
    .select(`
      id,
      shipment_code,
      shipment_date,
      transport_cost_eur,
      from_organisation_id,
      from_organisation:organisations!shipments_from_party_id_fkey(code, name),
      to_organisation_id,
      to_organisation:organisations!shipments_to_party_id_fkey(code, name),
      status,
      submitted_at,
      reviewed_at,
      reviewed_by,
      rejection_reason,
      completed_at,
      reviewer:portal_users!shipments_reviewed_by_fkey(name),
      inventory_packages(volume_m3)
    `)
    .order("shipment_date", { ascending: false });

  // Apply org filter for Super Admin when specified (filter by destination org)
  if (isSuperAdmin(session) && orgIds && orgIds.length > 0) {
    query = query.in("to_organisation_id", orgIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch shipments:", error);
    return { success: false, error: `Failed to fetch shipments: ${error.message}`, code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shipments: ShipmentListItem[] = (data as any[]).map((row: any) => ({
    id: row.id,
    shipmentCode: row.shipment_code,
    fromOrganisationId: row.from_organisation_id,
    fromOrganisationName: row.from_organisation?.name ?? "",
    fromOrganisationCode: row.from_organisation?.code ?? "",
    toOrganisationId: row.to_organisation_id,
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
    // Status workflow fields
    status: row.status ?? 'completed',
    submittedAt: row.submitted_at ?? null,
    reviewedAt: row.reviewed_at ?? null,
    reviewedByName: row.reviewer?.name ?? null,
    rejectionReason: row.rejection_reason ?? null,
    completedAt: row.completed_at ?? null,
  }));

  return { success: true, data: shipments };
}
