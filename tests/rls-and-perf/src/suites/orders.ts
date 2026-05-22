/**
 * Orders snapshot suite.
 *
 * For each test user, capture the orders that user can read. Mirrors the
 * core query in apps/portal/src/features/orders/actions/getOrders.ts —
 * we deliberately replicate the query rather than calling the action over
 * HTTP, because we want to test what the DB returns to that user
 * (which is what RLS will eventually control), not the action plumbing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { TEST_USERS } from "../config.js";
import { userClient } from "../lib/supabase.js";
import { writeSnapshot, type SnapshotPath } from "../lib/snapshot.js";

const ORDERS_SELECT =
  "id, code, status, customer_organisation_id, seller_organisation_id, producer_organisation_id, created_at, volume_m3";

async function snapshotOrdersForUser(
  client: SupabaseClient,
  userKey: string,
  kind: "baseline" | "current",
): Promise<void> {
  const { data, error } = await client
    .from("orders")
    .select(ORDERS_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);

  const path: SnapshotPath = { userKey, suite: "orders", case: "list" };
  writeSnapshot(kind, path, {
    count: data?.length ?? 0,
    error: error?.message ?? null,
    rows: data ?? [],
  });
}

export async function runOrdersSuite(kind: "baseline" | "current"): Promise<void> {
  for (const user of TEST_USERS) {
    const client = await userClient(user);
    await snapshotOrdersForUser(client, user.userKey, kind);
    await client.auth.signOut();
  }
}
