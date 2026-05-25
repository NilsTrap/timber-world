/**
 * Cross-tenant negative tests.
 *
 * These probe the actual security boundary: can User-A from Org-A see or
 * mutate Org-B's data? The current RLS policies are permissive (`USING true`),
 * so most of these probes will SUCCEED today — that is the baseline of the
 * security gap. After RLS hardening, every probe in this file must return
 * empty/forbidden.
 *
 * Reporting:
 *   - "blocked" = good (RLS / app filter correctly prevented the read or write)
 *   - "leaked"  = bad (the user got data they should not have)
 *
 * The orchestrator collects these results and reports the leak count.
 * A non-zero leak count is exit-1 in CI (after RLS hardening). Before
 * RLS hardening, leak counts establish the baseline gap.
 */

import { TEST_USERS, TEST_ORGS } from "../config.js";
import { userClient, adminClient } from "../lib/supabase.js";

export type ProbeResult = {
  userKey: string;
  probeName: string;
  description: string;
  outcome: "blocked" | "leaked";
  rowsSeen: number;
  errorMessage?: string;
};

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

export async function runNegativeSuite(): Promise<ProbeResult[]> {
  const orgIdByKey = await resolveOrgIds();
  const orgAId = orgIdByKey["org-a"];
  const orgBId = orgIdByKey["org-b"];
  if (!orgAId || !orgBId) {
    throw new Error(
      "Missing org-a / org-b ids — run seed before negative suite.",
    );
  }

  const results: ProbeResult[] = [];

  // Probe: User from Org A queries orders explicitly filtered to Org B
  const userAFull = TEST_USERS.find((u) => u.userKey === "org-a-full")!;
  const aClient = await userClient(userAFull);

  {
    const { data, error } = await aClient
      .from("orders")
      .select("id, customer_organisation_id, seller_organisation_id, producer_organisation_id")
      .or(
        `customer_organisation_id.eq.${orgBId},seller_organisation_id.eq.${orgBId},producer_organisation_id.eq.${orgBId}`,
      );
    results.push({
      userKey: userAFull.userKey,
      probeName: "orders.read-other-org",
      description: "Org-A user reads orders that belong to Org-B via any party column",
      outcome: (data?.length ?? 0) > 0 ? "leaked" : "blocked",
      rowsSeen: data?.length ?? 0,
      errorMessage: error?.message,
    });
  }

  {
    const { data, error } = await aClient
      .from("inventory_packages")
      .select("id, organisation_id")
      .eq("organisation_id", orgBId);
    results.push({
      userKey: userAFull.userKey,
      probeName: "inventory.read-other-org",
      description: "Org-A user reads inventory_packages of Org-B",
      outcome: (data?.length ?? 0) > 0 ? "leaked" : "blocked",
      rowsSeen: data?.length ?? 0,
      errorMessage: error?.message,
    });
  }

  {
    const { data, error } = await aClient
      .from("portal_production_entries")
      .select("id, organisation_id")
      .eq("organisation_id", orgBId);
    results.push({
      userKey: userAFull.userKey,
      probeName: "production.read-other-org",
      description: "Org-A user reads production entries of Org-B",
      outcome: (data?.length ?? 0) > 0 ? "leaked" : "blocked",
      rowsSeen: data?.length ?? 0,
      errorMessage: error?.message,
    });
  }

  {
    const { data, error } = await aClient
      .from("shipments")
      .select("id, from_organisation_id, to_organisation_id")
      .or(`from_organisation_id.eq.${orgBId},to_organisation_id.eq.${orgBId}`);
    results.push({
      userKey: userAFull.userKey,
      probeName: "shipments.read-other-org",
      description: "Org-A user reads shipments where Org-B is from/to",
      outcome: (data?.length ?? 0) > 0 ? "leaked" : "blocked",
      rowsSeen: data?.length ?? 0,
      errorMessage: error?.message,
    });
  }

  // Cross-tenant write probes — each should be blocked by RLS WITH CHECK.
  {
    const { data, error } = await aClient
      .from("inventory_packages")
      .insert({
        organisation_id: orgBId,
        package_number: "IJL-LEAK-INV-" + Date.now(),
      })
      .select("id");
    const inserted = data?.length ?? 0;
    results.push({
      userKey: userAFull.userKey,
      probeName: "inventory.insert-other-org",
      description: "Org-A user inserts an inventory_package owned by Org-B",
      outcome: inserted > 0 ? "leaked" : "blocked",
      rowsSeen: inserted,
      errorMessage: error?.message,
    });
    if (inserted > 0 && data) {
      const ids = data.map((r) => (r as { id: string }).id);
      await adminClient().from("inventory_packages").delete().in("id", ids);
    }
  }

  {
    const { data, error } = await aClient
      .from("shipments")
      .insert({
        from_organisation_id: orgBId,
        shipment_code: "IJL-LEAK-SH-" + Date.now(),
      })
      .select("id");
    const inserted = data?.length ?? 0;
    results.push({
      userKey: userAFull.userKey,
      probeName: "shipments.insert-other-org",
      description: "Org-A user inserts a shipment owned by Org-B",
      outcome: inserted > 0 ? "leaked" : "blocked",
      rowsSeen: inserted,
      errorMessage: error?.message,
    });
    if (inserted > 0 && data) {
      const ids = data.map((r) => (r as { id: string }).id);
      await adminClient().from("shipments").delete().in("id", ids);
    }
  }

  {
    const { data, error } = await aClient
      .from("orders")
      .insert({
        code: "IJL-TEST-LEAK-" + Date.now(),
        name: "RLS negative test row — Org-A inserting into Org-B",
        customer_organisation_id: orgBId,
        status: "draft",
      })
      .select("id");
    const inserted = data?.length ?? 0;
    results.push({
      userKey: userAFull.userKey,
      probeName: "orders.insert-other-org",
      description: "Org-A user inserts an order owned by Org-B",
      outcome: inserted > 0 ? "leaked" : "blocked",
      rowsSeen: inserted,
      errorMessage: error?.message,
    });
    // best-effort cleanup if leak occurred
    if (inserted > 0 && data) {
      const ids = data.map((r) => (r as { id: string }).id);
      await adminClient().from("orders").delete().in("id", ids);
    }
  }

  await aClient.auth.signOut();

  // Probe: limited-modules user attempts to read inventory (no module access)
  const userALimited = TEST_USERS.find((u) => u.userKey === "org-a-limited")!;
  const limitedClient = await userClient(userALimited);

  {
    const { data, error } = await limitedClient
      .from("inventory_packages")
      .select("id, organisation_id")
      .eq("organisation_id", orgAId);
    // For limited-modules user, the module gate is application-level.
    // RLS alone won't block this — the app filters by module. So this probe
    // is informational pre-RLS. After RLS, it should still return Org-A rows
    // (since user IS in Org-A); the application gate is what blocks the UI.
    // We label this as "informational" by tagging the probeName.
    results.push({
      userKey: userALimited.userKey,
      probeName: "inventory.no-module-read",
      description:
        "Org-A user without inventory module reads inventory rows (RLS allows; app gate should block)",
      outcome: (data?.length ?? 0) > 0 ? "leaked" : "blocked",
      rowsSeen: data?.length ?? 0,
      errorMessage: error?.message,
    });
  }

  await limitedClient.auth.signOut();
  return results;
}
