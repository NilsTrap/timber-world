/**
 * Production-entries snapshot suite.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { TEST_USERS } from "../config.js";
import { userClient } from "../lib/supabase.js";
import { writeSnapshot, type SnapshotPath } from "../lib/snapshot.js";

const PROD_SELECT =
  "id, status, organisation_id, production_date, created_at, validated_at, process_id";

async function snapshotForUser(
  client: SupabaseClient,
  userKey: string,
  kind: "baseline" | "current",
): Promise<void> {
  const { data, error } = await client
    .from("portal_production_entries")
    .select(PROD_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);

  const path: SnapshotPath = { userKey, suite: "production", case: "entries" };
  writeSnapshot(kind, path, {
    count: data?.length ?? 0,
    error: error?.message ?? null,
    rows: data ?? [],
  });
}

export async function runProductionSuite(kind: "baseline" | "current"): Promise<void> {
  for (const user of TEST_USERS) {
    const client = await userClient(user);
    await snapshotForUser(client, user.userKey, kind);
    await client.auth.signOut();
  }
}
