"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "@/features/shipments/types";

/**
 * Cleanup Admin Shipments
 *
 * Removes shipments that were auto-created by admin when adding inventory packages.
 * Admin shipments are identified by having from_organisation_id = NULL.
 *
 * This action:
 * 1. Finds all admin-created shipments (from_organisation_id IS NULL)
 * 2. Unlinks packages from those shipments (sets shipment_id to NULL)
 * 3. Deletes the empty shipments
 *
 * The packages remain in inventory, just without a shipment reference.
 * Super Admin only.
 */
export async function cleanupAdminShipments(): Promise<ActionResult<{
  shipmentsDeleted: number;
  packagesUnlinked: number;
}>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // 1. Find all admin-created shipments (from_organisation_id IS NULL)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: adminShipments, error: fetchError } = await (supabase as any)
    .from("shipments")
    .select("id, shipment_code")
    .is("from_organisation_id", null);

  if (fetchError) {
    return { success: false, error: `Failed to fetch shipments: ${fetchError.message}`, code: "QUERY_FAILED" };
  }

  if (!adminShipments || adminShipments.length === 0) {
    return { success: true, data: { shipmentsDeleted: 0, packagesUnlinked: 0 } };
  }

  const shipmentIds = adminShipments.map((s: { id: string }) => s.id);
  console.log(`Found ${shipmentIds.length} admin shipments to clean up`);

  // 2. Count packages that will be unlinked
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: packagesCount } = await (supabase as any)
    .from("inventory_packages")
    .select("id", { count: "exact", head: true })
    .in("shipment_id", shipmentIds);

  // 3. Unlink packages from these shipments (set shipment_id to NULL)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: unlinkError } = await (supabase as any)
    .from("inventory_packages")
    .update({ shipment_id: null })
    .in("shipment_id", shipmentIds);

  if (unlinkError) {
    return { success: false, error: `Failed to unlink packages: ${unlinkError.message}`, code: "UPDATE_FAILED" };
  }

  // 4. Delete the admin shipments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("shipments")
    .delete()
    .in("id", shipmentIds);

  if (deleteError) {
    return { success: false, error: `Failed to delete shipments: ${deleteError.message}`, code: "DELETE_FAILED" };
  }

  return {
    success: true,
    data: {
      shipmentsDeleted: shipmentIds.length,
      packagesUnlinked: packagesCount || 0
    }
  };
}
