"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { isValidUUID } from "../types";
import type { ActionResult } from "../types";

/**
 * Get Party Shipment Count
 *
 * Returns the number of shipments associated with a party.
 * Used to show warning when deactivating a party with existing shipments.
 * Admin only endpoint.
 */
export async function getPartyShipmentCount(
  partyId: string
): Promise<ActionResult<{ count: number }>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Check admin role
  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  // 3. Validate party ID
  if (!isValidUUID(partyId)) {
    return {
      success: false,
      error: "Invalid party ID",
      code: "INVALID_ID",
    };
  }

  const supabase = await createClient();

  // 4. Count shipments where party is source or destination
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: fromCount, error: fromError } = await (supabase as any)
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("from_party_id", partyId);

  if (fromError) {
    console.error("Failed to count shipments (from):", fromError);
    return {
      success: false,
      error: "Failed to count shipments",
      code: "QUERY_FAILED",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: toCount, error: toError } = await (supabase as any)
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("to_party_id", partyId);

  if (toError) {
    console.error("Failed to count shipments (to):", toError);
    return {
      success: false,
      error: "Failed to count shipments",
      code: "QUERY_FAILED",
    };
  }

  const totalCount = (fromCount ?? 0) + (toCount ?? 0);

  return {
    success: true,
    data: { count: totalCount },
  };
}
