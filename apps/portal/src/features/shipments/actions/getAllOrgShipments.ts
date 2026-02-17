"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult, ShipmentListItem, ShipmentStatus } from "../types";

/** Shipment list item with direction indicator */
export interface OrgShipmentListItem extends ShipmentListItem {
  direction: "outgoing" | "incoming";
}

/**
 * Get All Organization Shipments
 *
 * Fetches all shipments (both outgoing and incoming) for the current user's organization.
 * Each shipment is marked with a "direction" field.
 * Excludes incoming drafts (sender hasn't submitted yet).
 * Ordered by shipment_date DESC (newest first).
 */
export async function getAllOrgShipments(): Promise<ActionResult<OrgShipmentListItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  const supabase = await createClient();
  const orgId = session.organisationId;

  // Fetch outgoing shipments (from this org)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outgoingData, error: outgoingError } = await (supabase as any)
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
    .eq("from_organisation_id", orgId)
    .order("created_at", { ascending: false });

  if (outgoingError) {
    console.error("Failed to fetch outgoing shipments:", outgoingError);
    return { success: false, error: `Failed to fetch shipments: ${outgoingError.message}`, code: "QUERY_FAILED" };
  }

  // Fetch incoming shipments (to this org)
  // Include drafts - these are incoming shipments from external suppliers that the receiver creates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: incomingData, error: incomingError } = await (supabase as any)
    .from("shipments")
    .select(`
      id,
      shipment_code,
      shipment_date,
      transport_cost_eur,
      from_organisation_id,
      from_organisation:organisations!shipments_from_party_id_fkey(code, name, is_external),
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
    .eq("to_organisation_id", orgId)
    .order("created_at", { ascending: false });

  if (incomingError) {
    console.error("Failed to fetch incoming shipments:", incomingError);
    return { success: false, error: `Failed to fetch shipments: ${incomingError.message}`, code: "QUERY_FAILED" };
  }

  // Transform and combine
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRow = (row: any, direction: "outgoing" | "incoming"): OrgShipmentListItem => ({
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
    direction,
  });

  const outgoing = (outgoingData ?? []).map((row: unknown) => mapRow(row, "outgoing"));
  const incoming = (incomingData ?? []).map((row: unknown) => mapRow(row, "incoming"));

  // Combine and sort by date (newest first)
  const allShipments = [...outgoing, ...incoming].sort((a, b) => {
    const dateA = new Date(a.shipmentDate).getTime();
    const dateB = new Date(b.shipmentDate).getTime();
    return dateB - dateA;
  });

  return { success: true, data: allShipments };
}
