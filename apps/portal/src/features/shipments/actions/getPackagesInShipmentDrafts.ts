"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

export interface ShipmentDraftPackageInfo {
  packageId: string;
  shipmentId: string;
  shipmentCode: string;
  toOrganisationName: string;
}

/**
 * Get all packages that are currently in draft shipments.
 * Returns a list of packageId -> shipment draft info for quick lookup.
 */
export async function getPackagesInShipmentDrafts(
  orgId?: string
): Promise<ActionResult<ShipmentDraftPackageInfo[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // Determine org ID to filter by
  let filterOrgId: string | null = null;
  if (isOrganisationUser(session)) {
    filterOrgId = session.organisationId;
  } else if (isSuperAdmin(session) && orgId) {
    filterOrgId = orgId;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      shipment_id,
      shipments!inner!inventory_packages_shipment_id_fkey(
        id,
        shipment_code,
        from_organisation_id,
        status,
        to_organisation_id
      )
    `)
    .eq("shipments.status", "draft");

  // Filter by organisation (packages in shipments FROM this org)
  if (filterOrgId) {
    query = query.eq("shipments.from_organisation_id", filterOrgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch packages in shipment drafts:", error);
    return { success: false, error: error.message, code: "QUERY_FAILED" };
  }

  // Get unique to_organisation_ids to fetch names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toOrgIds = [...new Set((data ?? []).map((row: any) => row.shipments?.to_organisation_id).filter(Boolean))];

  // Fetch organisation names
  const orgNameMap = new Map<string, string>();
  if (toOrgIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orgs } = await (supabase as any)
      .from("organisations")
      .select("id, name")
      .in("id", toOrgIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (orgs ?? []).forEach((org: any) => orgNameMap.set(org.id, org.name));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: ShipmentDraftPackageInfo[] = (data ?? []).map((row: any) => ({
    packageId: row.id,
    shipmentId: row.shipments?.id,
    shipmentCode: row.shipments?.shipment_code ?? "Draft",
    toOrganisationName: orgNameMap.get(row.shipments?.to_organisation_id) ?? "Unknown",
  }));

  return { success: true, data: result };
}
