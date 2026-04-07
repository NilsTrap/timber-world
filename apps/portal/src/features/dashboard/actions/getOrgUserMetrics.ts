"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrgUser } from "@/lib/auth";
import type { ActionResult, OrgUserMetrics } from "../types";

/**
 * Get Org User Dashboard Metrics
 *
 * Aggregates:
 * 1. Total available inventory (m3) from inventory_packages (non-consumed, at organisation's facility)
 * 2. Total production volume (all-time output m3 from validated entries)
 * 3. Overall weighted outcome % and waste %
 */
export async function getOrgUserMetrics(): Promise<ActionResult<OrgUserMetrics>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isOrgUser(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Use currentOrganizationId (Epic 10) with fallback to organisationId (legacy)
  const orgId = session.currentOrganizationId || session.organisationId;

  // Run ALL inventory + production queries in parallel (were sequential before)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const [shipmentResult, productionResult, directResult, outgoingDraftResult, onTheWayResult, entriesResult] = orgId
    ? await Promise.all([
        // 1a. Shipment-sourced packages
        client
          .from("inventory_packages")
          .select("id, volume_m3, shipments!inner!inventory_packages_shipment_id_fkey(to_organisation_id, status)")
          .eq("shipments.to_organisation_id", orgId)
          .in("shipments.status", ["accepted", "completed"])
          .neq("status", "consumed"),
        // 1b. Production-sourced packages
        client
          .from("inventory_packages")
          .select("id, volume_m3, portal_production_entries!inner(organisation_id)")
          .eq("portal_production_entries.organisation_id", orgId)
          .eq("organisation_id", orgId)
          .eq("status", "produced"),
        // 1c. Direct inventory packages
        client
          .from("inventory_packages")
          .select("id, volume_m3")
          .eq("organisation_id", orgId)
          .is("shipment_id", null)
          .is("production_entry_id", null)
          .neq("status", "consumed"),
        // 1d. Outgoing draft shipment packages
        client
          .from("inventory_packages")
          .select("id, volume_m3, shipments!inner!inventory_packages_shipment_id_fkey(from_organisation_id, status)")
          .eq("shipments.from_organisation_id", orgId)
          .eq("shipments.status", "draft")
          .neq("status", "consumed"),
        // 1e. Outgoing pending shipment packages
        client
          .from("inventory_packages")
          .select("id, volume_m3, shipments!inner!inventory_packages_shipment_id_fkey(from_organisation_id, status)")
          .eq("shipments.from_organisation_id", orgId)
          .eq("shipments.status", "pending")
          .neq("status", "consumed"),
        // 2. Production totals
        client
          .from("portal_production_entries")
          .select("total_input_m3, total_output_m3")
          .eq("organisation_id", orgId)
          .eq("status", "validated"),
      ])
    : [{ data: null }, { data: null }, { data: null }, { data: null }, { data: null }, { data: null }];

  // Collect all packages and deduplicate
  const allPackages: { id: string; volume_m3: number }[] = [
    ...(shipmentResult.data || []),
    ...(productionResult.data || []),
    ...(directResult.data || []),
    ...(outgoingDraftResult.data || []),
    ...(onTheWayResult.data || []),
  ];

  const seenIds = new Set<string>();
  let totalInventoryM3 = 0;
  for (const pkg of allPackages) {
    if (!seenIds.has(pkg.id)) {
      seenIds.add(pkg.id);
      totalInventoryM3 += Number(pkg.volume_m3) || 0;
    }
  }

  // Production totals
  let totalProductionVolumeM3 = 0;
  let totalInputM3 = 0;
  let totalOutputM3 = 0;

  if (entriesResult.data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const entry of entriesResult.data as any[]) {
      const inputM3 = Number(entry.total_input_m3) || 0;
      const outputM3 = Number(entry.total_output_m3) || 0;
      totalInputM3 += inputM3;
      totalOutputM3 += outputM3;
      totalProductionVolumeM3 += outputM3;
    }
  }

  // Compute weighted averages
  const overallOutcomePercent = totalInputM3 > 0 ? (totalOutputM3 / totalInputM3) * 100 : 0;
  const overallWastePercent = totalInputM3 > 0 ? 100 - overallOutcomePercent : 0;

  return {
    success: true,
    data: {
      totalInventoryM3,
      totalProductionVolumeM3,
      overallOutcomePercent,
      overallWastePercent,
    },
  };
}
