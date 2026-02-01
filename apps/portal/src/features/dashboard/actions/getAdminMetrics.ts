"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, isSuperAdmin } from "@/lib/auth";
import type { ActionResult, AdminMetrics, DateRange } from "../types";

/**
 * Get Admin Dashboard Metrics
 *
 * Aggregates production data across ALL producers (admin view):
 * 1. Total production volume (all-time output m3 from validated entries)
 * 2. Overall weighted outcome % and waste %
 * 3. Entry count for the period
 *
 * @param dateRange - Optional date range filter (ISO strings)
 * @param orgId - Optional org ID for Super Admin to filter by specific organisation
 */
export async function getAdminMetrics(
  dateRange?: DateRange,
  orgId?: string
): Promise<ActionResult<AdminMetrics>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Fetch inventory packages with shipment info for org filtering
  // Include organisation_id for direct inventory packages (admin-added)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packagesData, error: packagesError } = await (supabase as any)
    .from("inventory_packages")
    .select("volume_m3, shipment_id, production_entry_id, organisation_id, shipments(to_organisation_id)")
    .neq("status", "consumed");

  if (packagesError) {
    console.error("[getAdminMetrics] Failed to fetch packages:", packagesError.message);
    return { success: false, error: packagesError.message, code: "QUERY_FAILED" };
  }

  // For org filtering, we need production entry org info too
  let productionOrgMap = new Map<string, string>();
  if (orgId && packagesData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productionIds = (packagesData as any[])
      .filter((pkg) => pkg.production_entry_id && !pkg.shipment_id)
      .map((pkg) => pkg.production_entry_id);

    if (productionIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prodData } = await (supabase as any)
        .from("portal_production_entries")
        .select("id, organisation_id")
        .in("id", productionIds);

      if (prodData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const entry of prodData as any[]) {
          productionOrgMap.set(entry.id, entry.organisation_id);
        }
      }
    }
  }

  // Calculate inventory totals (with optional org filter)
  let totalInventoryM3 = 0;
  let packageCount = 0;

  if (packagesData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const pkg of packagesData as any[]) {
      // Determine package org (priority: direct org_id > shipment destination > production entry org)
      let pkgOrgId: string | null = pkg.organisation_id ?? null;
      if (!pkgOrgId && pkg.shipments?.to_organisation_id) {
        pkgOrgId = pkg.shipments.to_organisation_id;
      } else if (!pkgOrgId && pkg.production_entry_id) {
        pkgOrgId = productionOrgMap.get(pkg.production_entry_id) ?? null;
      }

      // Apply org filter if specified
      if (orgId && pkgOrgId !== orgId) {
        continue;
      }

      totalInventoryM3 += Number(pkg.volume_m3) || 0;
      packageCount++;
    }
  }

  // Build query - admin sees ALL validated entries (or filtered by org if specified)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("portal_production_entries")
    .select("total_input_m3, total_output_m3, validated_at")
    .eq("status", "validated");

  // Apply org filter for Super Admin when specified
  if (isSuperAdmin(session) && orgId) {
    query = query.eq("organisation_id", orgId);
  }

  // Apply date range filter if provided
  if (dateRange) {
    query = query.gte("validated_at", dateRange.start);
    if (dateRange.end) {
      query = query.lte("validated_at", dateRange.end);
    }
  }

  const { data: entries, error: entriesError } = await query;

  if (entriesError) {
    console.error("[getAdminMetrics] Failed to fetch production entries:", entriesError.message);
    return { success: false, error: entriesError.message, code: "QUERY_FAILED" };
  }

  let totalProductionVolumeM3 = 0;
  let totalInputM3 = 0;
  let totalOutputM3 = 0;
  let entryCount = 0;

  if (entries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const entry of entries as any[]) {
      const inputM3 = Number(entry.total_input_m3) || 0;
      const outputM3 = Number(entry.total_output_m3) || 0;
      totalInputM3 += inputM3;
      totalOutputM3 += outputM3;
      totalProductionVolumeM3 += outputM3;
      entryCount++;
    }
  }

  // Compute weighted averages
  const overallOutcomePercent = totalInputM3 > 0 ? (totalOutputM3 / totalInputM3) * 100 : 0;
  const overallWastePercent = totalInputM3 > 0 ? 100 - overallOutcomePercent : 0;

  // Fetch active organizations count (activity in last 30 days)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: activeOrgsData } = await (supabase as any)
    .from("portal_production_entries")
    .select("organisation_id")
    .eq("status", "validated")
    .gte("validated_at", thirtyDaysAgo);

  const activeOrgIds = new Set<string>();
  if (activeOrgsData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const entry of activeOrgsData as any[]) {
      if (entry.organisation_id) {
        activeOrgIds.add(entry.organisation_id);
      }
    }
  }
  const activeOrganizations = activeOrgIds.size;

  // Fetch pending shipments count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: pendingCount } = await (supabase as any)
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const pendingShipments = pendingCount ?? 0;

  return {
    success: true,
    data: {
      totalInventoryM3,
      packageCount,
      totalProductionVolumeM3,
      overallOutcomePercent,
      overallWastePercent,
      entryCount,
      activeOrganizations,
      pendingShipments,
    },
  };
}
