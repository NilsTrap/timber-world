/**
 * Positive write-path suite.
 *
 * The snapshot suites verify what users can READ; the negative suite verifies
 * users cannot touch OTHER orgs' data. Neither verifies that a user can perform
 * the core WRITES their own role is supposed to allow. This suite fills that
 * gap: for representative full-access org users, insert each core entity in the
 * user's OWN org and assert success, then clean up via the admin client.
 *
 * Why it exists: on 2026-05-28 org users hit "Failed to create order" in prod
 * because order-code generation produced a duplicate code under RLS. The fix
 * moved code generation to a DB DEFAULT backed by order_number_seq. The
 * `orders.create-own-org` case below inserts an order WITHOUT supplying `code`
 * and asserts the DB returns a valid unique ORD-#### — guarding that fix (the
 * DEFAULT plus the sequence GRANT to `authenticated`) against regression.
 *
 * Limitation: like the rest of this harness, these run against the DB with the
 * user's token — they do NOT exercise the Next.js server actions, so app-layer
 * logic and module gating are out of scope. See
 * docs/decisions/2026-05-28-write-path-testing-and-error-monitoring.md for the
 * options considered (DB-direct vs server-action integration vs Playwright e2e).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { TEST_ORGS, ORG_USERS } from "../config.js";
import { userClient, adminClient } from "../lib/supabase.js";

export type PositiveResult = {
  userKey: string;
  caseName: string;
  description: string;
  outcome: "ok" | "failed";
  detail: string;
  errorMessage?: string;
};

// Full-access org users — one per org so each writes into an org it belongs to.
// org-a-limited is excluded on purpose: module gating is an app-layer concern
// this DB-level harness cannot observe.
const WRITER_KEYS = ["org-a-full", "org-b-full"];

// int4-safe, collision-resistant number for shipments.shipment_number
// (NOT NULL, no default; real numbers are small so a high offset won't clash).
function safeShipmentNumber(): number {
  return 1_000_000_000 + Math.floor(Math.random() * 1_000_000_000);
}

async function resolveOrgIds(): Promise<Record<string, string>> {
  const admin = adminClient();
  const out: Record<string, string> = {};
  for (const org of TEST_ORGS) {
    const { data } = await admin
      .from("organisations")
      .select("id")
      .eq("code", org.code)
      .maybeSingle();
    if (data) out[org.orgKey] = data.id as string;
  }
  return out;
}

export async function runPositiveSuite(): Promise<PositiveResult[]> {
  const orgIdByKey = await resolveOrgIds();
  const results: PositiveResult[] = [];

  for (const user of ORG_USERS.filter((u) => WRITER_KEYS.includes(u.userKey))) {
    const ownOrgId = orgIdByKey[user.orgKeys[0]];
    if (!ownOrgId) {
      results.push({
        userKey: user.userKey,
        caseName: "setup",
        description: "resolve user's own org id",
        outcome: "failed",
        detail: `no org id for ${user.orgKeys[0]} — run seed first`,
      });
      continue;
    }

    // A different org to use as shipment counterparty (shipments require
    // from_organisation_id <> to_organisation_id; INSERT policy only needs the
    // user to be in from OR to, and the user is in `from`).
    const counterpartyOrgId = Object.values(orgIdByKey).find((id) => id !== ownOrgId);

    const client = await userClient(user);
    const cleanup: Array<{ table: string; id: string }> = [];

    // orders: create in own org WITHOUT supplying `code`.
    // Guards the 2026-05-28 order-code DEFAULT fix.
    {
      const { data, error } = await client
        .from("orders")
        .insert({
          name: "IJL positive-write test (own org)",
          seller_organisation_id: ownOrgId,
          status: "draft",
        })
        .select("id, code")
        .maybeSingle();
      const row = data as { id: string; code?: string } | null;
      const code = row?.code ?? "";
      const ok = !error && !!row && /^ORD-\d+$/.test(code);
      results.push({
        userKey: user.userKey,
        caseName: "orders.create-own-org",
        description:
          "org user creates an order in own org; DB DEFAULT generates a valid ORD-#### code",
        outcome: ok ? "ok" : "failed",
        detail: ok ? `code=${code}` : `code=${JSON.stringify(code)}`,
        errorMessage: error?.message,
      });
      if (row?.id) cleanup.push({ table: "orders", id: row.id });
    }

    // inventory_packages: create in own org.
    {
      const { data, error } = await client
        .from("inventory_packages")
        .insert({
          organisation_id: ownOrgId,
          package_number: "IJL-POS-INV-" + Date.now(),
        })
        .select("id")
        .maybeSingle();
      const row = data as { id: string } | null;
      const ok = !error && !!row;
      results.push({
        userKey: user.userKey,
        caseName: "inventory.create-own-org",
        description: "org user creates an inventory_package in own org",
        outcome: ok ? "ok" : "failed",
        detail: ok ? "inserted" : "no row returned",
        errorMessage: error?.message,
      });
      if (row?.id) cleanup.push({ table: "inventory_packages", id: row.id });
    }

    // shipments: create from own org.
    {
      const { data, error } = await client
        .from("shipments")
        .insert({
          from_organisation_id: ownOrgId,
          to_organisation_id: counterpartyOrgId,
          shipment_code: "IJL-POS-SH-" + Date.now(),
          shipment_number: safeShipmentNumber(),
        })
        .select("id")
        .maybeSingle();
      const row = data as { id: string } | null;
      const ok = !error && !!row;
      results.push({
        userKey: user.userKey,
        caseName: "shipments.create-own-org",
        description: "org user creates a shipment from own org",
        outcome: ok ? "ok" : "failed",
        detail: ok ? "inserted" : "no row returned",
        errorMessage: error?.message,
      });
      if (row?.id) cleanup.push({ table: "shipments", id: row.id });
    }

    await client.auth.signOut();

    // Clean up via admin client (bypasses RLS). Best-effort; reverse order.
    const admin = adminClient();
    for (const { table, id } of cleanup.reverse()) {
      await admin.from(table).delete().eq("id", id);
    }
  }

  return results;
}
