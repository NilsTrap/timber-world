"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer } from "@/lib/auth";
import type { ActionResult, ProducerMetrics } from "../types";

/**
 * Get Producer Dashboard Metrics
 *
 * Aggregates:
 * 1. Total available inventory (m3) from inventory_packages (non-consumed, at producer's facility)
 * 2. Total production volume (all-time output m3 from validated entries)
 * 3. Overall weighted outcome % and waste %
 */
export async function getProducerMetrics(): Promise<ActionResult<ProducerMetrics>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isProducer(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Use currentOrganizationId (Epic 10) with fallback to organisationId (legacy)
  const orgId = session.currentOrganizationId || session.organisationId;

  // Query 1: Total available inventory volume
  // Uses same pattern as getProducerPackages: shipment packages + production packages
  // IMPORTANT: Must deduplicate by package ID to avoid double-counting
  const allPackages: { id: string; volume_m3: number }[] = [];

  // 1a. Shipment-sourced packages (shipped to this producer's facility, not consumed)
  // Only include packages from shipments that have been accepted or completed
  if (orgId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shipmentPkgs, error: shipmentError } = await (supabase as any)
      .from("inventory_packages")
      .select("id, volume_m3, shipments!inner!inventory_packages_shipment_id_fkey(to_organisation_id, status)")
      .eq("shipments.to_organisation_id", orgId)
      .in("shipments.status", ["accepted", "completed"])
      .neq("status", "consumed");

    if (shipmentError) {
      console.error("[getProducerMetrics] Failed to fetch shipment packages:", shipmentError.message);
    } else if (shipmentPkgs) {
      allPackages.push(...shipmentPkgs);
    }
  }

  // 1b. Production-sourced packages (from this producer's organisation, status = produced)
  // Also verify package still belongs to this org (shipped packages have org_id updated)
  if (orgId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: productionPkgs, error: productionError } = await (supabase as any)
      .from("inventory_packages")
      .select("id, volume_m3, portal_production_entries!inner(organisation_id)")
      .eq("portal_production_entries.organisation_id", orgId)
      .eq("organisation_id", orgId)
      .eq("status", "produced");

    if (productionError) {
      console.error("[getProducerMetrics] Failed to fetch production packages:", productionError.message);
    } else if (productionPkgs) {
      allPackages.push(...productionPkgs);
    }
  }

  // 1c. Direct inventory packages (admin-added, no shipment or production source)
  if (orgId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: directPkgs, error: directError } = await (supabase as any)
      .from("inventory_packages")
      .select("id, volume_m3")
      .eq("organisation_id", orgId)
      .is("shipment_id", null)
      .is("production_entry_id", null)
      .neq("status", "consumed");

    if (directError) {
      console.error("[getProducerMetrics] Failed to fetch direct packages:", directError.message);
    } else if (directPkgs) {
      allPackages.push(...directPkgs);
    }
  }

  // 1d. Packages in outgoing draft shipments (still in this org's inventory)
  if (orgId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: outgoingDraftPkgs, error: outgoingDraftError } = await (supabase as any)
      .from("inventory_packages")
      .select("id, volume_m3, shipments!inner!inventory_packages_shipment_id_fkey(from_organisation_id, status)")
      .eq("shipments.from_organisation_id", orgId)
      .eq("shipments.status", "draft")
      .neq("status", "consumed");

    if (outgoingDraftError) {
      console.error("[getProducerMetrics] Failed to fetch outgoing draft packages:", outgoingDraftError.message);
    } else if (outgoingDraftPkgs) {
      allPackages.push(...outgoingDraftPkgs);
    }
  }

  // 1e. Packages in outgoing pending shipments ("on the way" - still belongs to sender until accepted)
  if (orgId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: onTheWayPkgs, error: onTheWayError } = await (supabase as any)
      .from("inventory_packages")
      .select("id, volume_m3, shipments!inner!inventory_packages_shipment_id_fkey(from_organisation_id, status)")
      .eq("shipments.from_organisation_id", orgId)
      .eq("shipments.status", "pending")
      .neq("status", "consumed");

    if (onTheWayError) {
      console.error("[getProducerMetrics] Failed to fetch on-the-way packages:", onTheWayError.message);
    } else if (onTheWayPkgs) {
      allPackages.push(...onTheWayPkgs);
    }
  }

  // Deduplicate by package ID and sum volumes
  const seenIds = new Set<string>();
  let totalInventoryM3 = 0;
  for (const pkg of allPackages) {
    if (!seenIds.has(pkg.id)) {
      seenIds.add(pkg.id);
      totalInventoryM3 += Number(pkg.volume_m3) || 0;
    }
  }

  // Query 2: Production totals from validated entries (from this organisation)
  let totalProductionVolumeM3 = 0;
  let totalInputM3 = 0;
  let totalOutputM3 = 0;

  if (orgId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entries, error: entriesError } = await (supabase as any)
      .from("portal_production_entries")
      .select("total_input_m3, total_output_m3")
      .eq("organisation_id", orgId)
      .eq("status", "validated");

    if (entriesError) {
      console.error("[getProducerMetrics] Failed to fetch production entries:", entriesError.message);
    } else if (entries) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const entry of entries as any[]) {
        const inputM3 = Number(entry.total_input_m3) || 0;
        const outputM3 = Number(entry.total_output_m3) || 0;
        totalInputM3 += inputM3;
        totalOutputM3 += outputM3;
        totalProductionVolumeM3 += outputM3;
      }
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
