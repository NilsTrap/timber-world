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
      inventory_packages!inventory_packages_shipment_id_fkey(volume_m3)
    `)
    .eq("from_organisation_id", orgId)
    .order("created_at", { ascending: false });

  if (outgoingError) {
    console.error("Failed to fetch outgoing shipments:", outgoingError);
    return { success: false, error: `Failed to fetch shipments: ${outgoingError.message}`, code: "QUERY_FAILED" };
  }

  // Fetch incoming shipments (to this org)
  // Include drafts - these are incoming shipments from external suppliers that the receiver creates
  // Note: We don't embed packages here because we need to count by both shipment_id AND source_shipment_id
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
      reviewer:portal_users!shipments_reviewed_by_fkey(name)
    `)
    .eq("to_organisation_id", orgId)
    .order("created_at", { ascending: false });

  if (incomingError) {
    console.error("Failed to fetch incoming shipments:", incomingError);
    return { success: false, error: `Failed to fetch shipments: ${incomingError.message}`, code: "QUERY_FAILED" };
  }

  // For incoming shipments, we need to count packages that either:
  // - Have shipment_id pointing to this shipment (still here), OR
  // - Have source_shipment_id pointing to this shipment (forwarded out)
  // Build a map of shipment_id -> { count, volume }
  const incomingIds = (incomingData ?? []).map((s: { id: string }) => s.id);
  const incomingPackageCounts: Map<string, { count: number; volume: number }> = new Map();

  if (incomingIds.length > 0) {
    // Get packages where shipment_id OR source_shipment_id matches any incoming shipment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: packages } = await (supabase as any)
      .from("inventory_packages")
      .select("shipment_id, source_shipment_id, volume_m3")
      .or(
        `shipment_id.in.(${incomingIds.join(",")}),source_shipment_id.in.(${incomingIds.join(",")})`
      );

    // Count packages per incoming shipment
    for (const pkg of packages ?? []) {
      // Determine which incoming shipment this package belongs to
      // Prefer source_shipment_id (original incoming) over shipment_id
      const incomingShipmentId = incomingIds.includes(pkg.source_shipment_id)
        ? pkg.source_shipment_id
        : incomingIds.includes(pkg.shipment_id)
          ? pkg.shipment_id
          : null;

      if (incomingShipmentId) {
        const current = incomingPackageCounts.get(incomingShipmentId) ?? { count: 0, volume: 0 };
        current.count++;
        current.volume += pkg.volume_m3 != null ? Number(pkg.volume_m3) : 0;
        incomingPackageCounts.set(incomingShipmentId, current);
      }
    }
  }

  // Transform outgoing shipments (use embedded packages)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapOutgoingRow = (row: any): OrgShipmentListItem => ({
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
    direction: "outgoing",
  });

  // Transform incoming shipments (use counts from separate query)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapIncomingRow = (row: any): OrgShipmentListItem => {
    const pkgData = incomingPackageCounts.get(row.id) ?? { count: 0, volume: 0 };
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
      direction: "incoming",
    };
  };

  const outgoing = (outgoingData ?? []).map(mapOutgoingRow);
  const incoming = (incomingData ?? []).map(mapIncomingRow);

  // Combine and sort by date (newest first)
  const allShipments = [...outgoing, ...incoming].sort((a, b) => {
    const dateA = new Date(a.shipmentDate).getTime();
    const dateB = new Date(b.shipmentDate).getTime();
    return dateB - dateA;
  });

  return { success: true, data: allShipments };
}
