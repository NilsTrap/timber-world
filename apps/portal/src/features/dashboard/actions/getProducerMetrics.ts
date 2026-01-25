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

  // Query 1: Total available inventory volume
  // Uses same pattern as getProducerPackages: shipment packages + production packages
  let totalInventoryM3 = 0;

  // 1a. Shipment-sourced packages (shipped to this producer's facility, not consumed)
  if (session.organisationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shipmentPkgs, error: shipmentError } = await (supabase as any)
      .from("inventory_packages")
      .select("volume_m3, shipments!inner!inventory_packages_shipment_id_fkey(to_organisation_id)")
      .eq("shipments.to_organisation_id", session.organisationId)
      .neq("status", "consumed");

    if (shipmentError) {
      console.error("[getProducerMetrics] Failed to fetch shipment packages:", shipmentError.message);
    } else if (shipmentPkgs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalInventoryM3 += shipmentPkgs.reduce((sum: number, pkg: any) => sum + (Number(pkg.volume_m3) || 0), 0);
    }
  }

  // 1b. Production-sourced packages (created by this producer, status = produced)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: productionPkgs, error: productionError } = await (supabase as any)
    .from("inventory_packages")
    .select("volume_m3, portal_production_entries!inner(created_by)")
    .eq("portal_production_entries.created_by", session.id)
    .eq("status", "produced");

  if (productionError) {
    console.error("[getProducerMetrics] Failed to fetch production packages:", productionError.message);
  } else if (productionPkgs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    totalInventoryM3 += productionPkgs.reduce((sum: number, pkg: any) => sum + (Number(pkg.volume_m3) || 0), 0);
  }

  // Query 2: Production totals from validated entries (created by this user)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entries, error: entriesError } = await (supabase as any)
    .from("portal_production_entries")
    .select("total_input_m3, total_output_m3")
    .eq("created_by", session.id)
    .eq("status", "validated");

  let totalProductionVolumeM3 = 0;
  let totalInputM3 = 0;
  let totalOutputM3 = 0;

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
