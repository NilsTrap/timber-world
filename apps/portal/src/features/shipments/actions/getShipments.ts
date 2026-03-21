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

  // Note: FK constraints kept original names (shipments_from_party_id_fkey) after column rename
  // We no longer embed inventory_packages here — instead we do a separate query below
  // to count packages by both shipment_id AND source_shipment_id (for forwarded packages)
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
      reviewer:portal_users!shipments_reviewed_by_fkey(name)
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

  // Count packages per shipment using both shipment_id and source_shipment_id
  // This handles forwarded packages (e.g. received via DRWNP001, then shipped out via TIM-INE-001)
  const shipmentIds = (data as any[]).map((s: any) => s.id);
  const packageCounts: Map<string, { count: number; volume: number }> = new Map();

  if (shipmentIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: packages } = await (supabase as any)
      .from("inventory_packages")
      .select("id, shipment_id, source_shipment_id, volume_m3")
      .or(
        `shipment_id.in.(${shipmentIds.join(",")}),source_shipment_id.in.(${shipmentIds.join(",")})`
      );

    // Recover original volumes for consumed/partially-consumed packages
    const pkgIds = (packages ?? []).map((p: { id: string }) => p.id);
    const deductionsMap = new Map<string, number>();
    if (pkgIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inputsData } = await (supabase as any)
        .from("portal_production_inputs")
        .select("package_id, volume_m3")
        .in("package_id", pkgIds);

      for (const input of (inputsData ?? []) as { package_id: string; volume_m3: number | null }[]) {
        deductionsMap.set(input.package_id, (deductionsMap.get(input.package_id) ?? 0) + (Number(input.volume_m3) || 0));
      }
    }

    for (const pkg of packages ?? []) {
      const currentVol = pkg.volume_m3 != null ? Number(pkg.volume_m3) : 0;
      const originalVol = currentVol + (deductionsMap.get(pkg.id) ?? 0);
      // Count under shipment_id (current shipment)
      if (pkg.shipment_id && shipmentIds.includes(pkg.shipment_id)) {
        const current = packageCounts.get(pkg.shipment_id) ?? { count: 0, volume: 0 };
        current.count++;
        current.volume += originalVol;
        packageCounts.set(pkg.shipment_id, current);
      }
      // Also count under source_shipment_id (original incoming shipment) if different
      if (pkg.source_shipment_id && shipmentIds.includes(pkg.source_shipment_id) && pkg.source_shipment_id !== pkg.shipment_id) {
        const current = packageCounts.get(pkg.source_shipment_id) ?? { count: 0, volume: 0 };
        current.count++;
        current.volume += originalVol;
        packageCounts.set(pkg.source_shipment_id, current);
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
      // Status workflow fields
      status: row.status ?? 'completed',
      submittedAt: row.submitted_at ?? null,
      reviewedAt: row.reviewed_at ?? null,
      reviewedByName: row.reviewer?.name ?? null,
      rejectionReason: row.rejection_reason ?? null,
      completedAt: row.completed_at ?? null,
    };
  });

  return { success: true, data: shipments };
}
