/**
 * Inventory snapshot suite. Mirrors core queries in
 * apps/portal/src/features/inventory/actions/.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { TEST_USERS } from "../config.js";
import { userClient } from "../lib/supabase.js";
import { writeSnapshot, type SnapshotPath } from "../lib/snapshot.js";

const PKG_SELECT =
  "id, status, organisation_id, package_number, package_sequence, shipment_id, production_entry_id, pieces, volume_m3";

async function snapshotPackagesForUser(
  client: SupabaseClient,
  userKey: string,
  kind: "baseline" | "current",
): Promise<void> {
  const { data, error } = await client
    .from("inventory_packages")
    .select(PKG_SELECT)
    .order("package_number", { ascending: true })
    .order("id", { ascending: true })
    .limit(500);

  const path: SnapshotPath = { userKey, suite: "inventory", case: "packages" };
  writeSnapshot(kind, path, {
    count: data?.length ?? 0,
    error: error?.message ?? null,
    rows: data ?? [],
  });
}

export async function runInventorySuite(kind: "baseline" | "current"): Promise<void> {
  for (const user of TEST_USERS) {
    const client = await userClient(user);
    await snapshotPackagesForUser(client, user.userKey, kind);
    await client.auth.signOut();
  }
}
