/**
 * Shipments snapshot suite.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { TEST_USERS } from "../config.js";
import { userClient } from "../lib/supabase.js";
import { writeSnapshot, type SnapshotPath } from "../lib/snapshot.js";

const SHIP_SELECT =
  "id, status, from_organisation_id, to_organisation_id, shipment_code, shipment_number, created_at";

async function snapshotForUser(
  client: SupabaseClient,
  userKey: string,
  kind: "baseline" | "current",
): Promise<void> {
  const { data, error } = await client
    .from("shipments")
    .select(SHIP_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);

  const path: SnapshotPath = { userKey, suite: "shipments", case: "list" };
  writeSnapshot(kind, path, {
    count: data?.length ?? 0,
    error: error?.message ?? null,
    rows: data ?? [],
  });
}

export async function runShipmentsSuite(kind: "baseline" | "current"): Promise<void> {
  for (const user of TEST_USERS) {
    const client = await userClient(user);
    await snapshotForUser(client, user.userKey, kind);
    await client.auth.signOut();
  }
}
