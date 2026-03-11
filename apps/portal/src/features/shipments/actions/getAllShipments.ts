"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult, ShipmentListItem, ShipmentStatus } from "../types";

export interface ShipmentFilters {
  fromOrgId?: string;
  toOrgId?: string;
  status?: ShipmentStatus | "all";
}

/**
 * Get All Shipments (Super Admin Only)
 *
 * Fetches all shipments across all organizations.
 * Supports filtering by from/to org and status.
 */
export async function getAllShipments(
  filters: ShipmentFilters = {}
): Promise<ActionResult<ShipmentListItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Super Admin access required", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

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
      inventory_packages!inventory_packages_shipment_id_fkey(volume_m3)
    `);

  // Apply filters
  if (filters.fromOrgId) {
    query = query.eq("from_organisation_id", filters.fromOrgId);
  }
  if (filters.toOrgId) {
    query = query.eq("to_organisation_id", filters.toOrgId);
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch all shipments:", error);
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
    status: (row.status ?? "completed") as ShipmentStatus,
    submittedAt: row.submitted_at ?? null,
    reviewedAt: row.reviewed_at ?? null,
    reviewedByName: row.reviewer?.name ?? null,
    rejectionReason: row.rejection_reason ?? null,
    completedAt: row.completed_at ?? null,
  }));

  return { success: true, data: shipments };
}

/**
 * Get All Pending Shipments Count (Super Admin Only)
 *
 * Returns the count of pending shipments across all organizations.
 * Returns 0 for non-Super Admin users (graceful degradation for badge display).
 */
export async function getAllPendingShipmentCount(): Promise<ActionResult<number>> {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    // Not an error - just not authorized, return 0 for badge display
    return { success: true, data: 0 };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase as any)
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("Failed to count pending shipments:", error);
    // Return error properly so callers can handle it
    return { success: false, error: `Failed to count pending shipments: ${error.message}`, code: "QUERY_FAILED" };
  }

  return { success: true, data: count ?? 0 };
}
