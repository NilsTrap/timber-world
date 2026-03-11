"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult, ShipmentListItem, ShipmentStatus } from "../types";

/**
 * Get Outgoing Shipments
 *
 * Fetches shipments sent by the current user's organization.
 * Returns shipments in all statuses (draft, pending, completed, rejected).
 */
export async function getOutgoingShipments(): Promise<ActionResult<ShipmentListItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
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
    `)
    .eq("from_organisation_id", session.organisationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch outgoing shipments:", error);
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
 * Get Incoming Shipments
 *
 * Fetches shipments addressed to the current user's organization.
 * Excludes drafts (sender hasn't submitted yet).
 */
export async function getIncomingShipments(): Promise<ActionResult<ShipmentListItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  const supabase = await createClient();

  // Fetch incoming shipments without embedded packages
  // We need separate query for package counts due to source_shipment_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
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
      reviewer:portal_users!shipments_reviewed_by_fkey(name)
    `)
    .eq("to_organisation_id", session.organisationId)
    .neq("status", "draft") // Don't show drafts to receiver
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Failed to fetch incoming shipments:", error);
    return { success: false, error: `Failed to fetch shipments: ${error.message}`, code: "QUERY_FAILED" };
  }

  // For incoming shipments, count packages by shipment_id OR source_shipment_id
  const incomingIds = (data ?? []).map((s: { id: string }) => s.id);
  const packageCounts: Map<string, { count: number; volume: number }> = new Map();

  if (incomingIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: packages } = await (supabase as any)
      .from("inventory_packages")
      .select("shipment_id, source_shipment_id, volume_m3")
      .or(
        `shipment_id.in.(${incomingIds.join(",")}),source_shipment_id.in.(${incomingIds.join(",")})`
      );

    for (const pkg of packages ?? []) {
      const incomingShipmentId = incomingIds.includes(pkg.source_shipment_id)
        ? pkg.source_shipment_id
        : incomingIds.includes(pkg.shipment_id)
          ? pkg.shipment_id
          : null;

      if (incomingShipmentId) {
        const current = packageCounts.get(incomingShipmentId) ?? { count: 0, volume: 0 };
        current.count++;
        current.volume += pkg.volume_m3 != null ? Number(pkg.volume_m3) : 0;
        packageCounts.set(incomingShipmentId, current);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shipments: ShipmentListItem[] = (data as any[]).map((row: any) => {
    const pkgData = packageCounts.get(row.id) ?? { count: 0, volume: 0 };
    return {
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
      packageCount: pkgData.count,
      totalVolumeM3: pkgData.volume,
      status: (row.status ?? "completed") as ShipmentStatus,
      submittedAt: row.submitted_at ?? null,
      reviewedAt: row.reviewed_at ?? null,
      reviewedByName: row.reviewer?.name ?? null,
      rejectionReason: row.rejection_reason ?? null,
      completedAt: row.completed_at ?? null,
    };
  });

  return { success: true, data: shipments };
}

/**
 * Get Pending Shipment Count
 *
 * Returns the count of pending incoming shipments for the current organization.
 * Used for notification badges.
 */
export async function getPendingShipmentCount(): Promise<ActionResult<number>> {
  const session = await getSession();
  if (!session || !session.organisationId) {
    return { success: true, data: 0 };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase as any)
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("to_organisation_id", session.organisationId)
    .eq("status", "pending");

  if (error) {
    console.error("Failed to count pending shipments:", error);
    return { success: true, data: 0 };
  }

  return { success: true, data: count ?? 0 };
}
