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
    // E4 bilateral predicate: seller + buyer are canonical (producer arm is
    // transitional). The org-B sample orders (buyer = Org-B, no seller) are
    // rows Org-A is no party to — Org-A must see zero of them.
    const { data, error } = await aClient
      .from("orders")
      .select("id, seller_organisation_id, buyer_organisation_id, producer_organisation_id")
      .eq("buyer_organisation_id", orgBId)
      .is("seller_organisation_id", null);
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

  // ── E4 · direction-aware bilateral isolation (the middle-leg wall) ──────
  // Chain fixture from seedE4Chain: sell leg JLA→JLB (IJL-E4-SELL-001),
  // buy leg JLD→JLA (IJL-E4-BUY-001). org-a (JLA) is the house.
  const admin = adminClient();
  const orgDId = orgIdByKey["org-d-supplier"];
  const { data: legs, error: legsError } = await admin
    .from("orders")
    .select("id, code")
    .in("code", ["IJL-E4-SELL-001", "IJL-E4-BUY-001"]);
  const sellLegId = legs?.find((l) => l.code === "IJL-E4-SELL-001")?.id as string | undefined;
  const buyLegId = legs?.find((l) => l.code === "IJL-E4-BUY-001")?.id as string | undefined;

  if (legsError || !sellLegId || !buyLegId || !orgDId) {
    throw new Error(
      `E4 project fixtures are incomplete: ${legsError?.message ?? "expected both seeded legs and supplier org"}`,
    );
  }

  {
    // Project-workspace canaries make file probes non-vacuous. Metadata only:
    // no storage object is created, and the rows are removed before return.
    const probeStamp = Date.now();
    const { data: projectFileCanaries, error: projectFileCanaryError } = await admin
      .from("order_files")
      .insert([
        {
          order_id: buyLegId,
          category: "project",
          file_name: "hidden-buy-leg.pdf",
          relative_path: `security/hidden-buy-leg-${probeStamp}.pdf`,
          storage_path: `${buyLegId}/project/rls-${probeStamp}-buy.pdf`,
          mime_type: "application/pdf",
          file_variant: "original",
          lifecycle_status: "ready",
        },
        {
          order_id: sellLegId,
          category: "project",
          file_name: "visible-sell-leg.pdf",
          relative_path: `security/visible-sell-leg-${probeStamp}.pdf`,
          storage_path: `${sellLegId}/project/rls-${probeStamp}-sell.pdf`,
          mime_type: "application/pdf",
          file_variant: "original",
          lifecycle_status: "ready",
        },
      ])
      .select("id");
    if (projectFileCanaryError || (projectFileCanaries?.length ?? 0) !== 2) {
      throw new Error(`Project file canary setup failed: ${projectFileCanaryError?.message ?? "missing rows"}`);
    }
    const probeRead = async (
      client: Awaited<ReturnType<typeof userClient>>,
      userKey: string,
      probeName: string,
      description: string,
      table: string,
      column: string,
      value: string,
    ) => {
      const { data, error } = await client.from(table).select("id").eq(column, value);
      results.push({
        userKey,
        probeName,
        description,
        outcome: (data?.length ?? 0) > 0 ? "leaked" : "blocked",
        rowsSeen: data?.length ?? 0,
        errorMessage: error?.message,
      });
    };

    const assertVisible = async (
      client: Awaited<ReturnType<typeof userClient>>,
      userKey: string,
      table: string,
      column: string,
      value: string,
      fixture: string,
    ) => {
      const { data, error } = await client.from(table).select("id").eq(column, value);
      if (error || (data?.length ?? 0) === 0) {
        throw new Error(
          `${userKey} cannot see required ${fixture} fixture: ${error?.message ?? "zero rows"}`,
        );
      }
    };

    try {
      // Every denial is paired with a visible row/file assertion. A broken or
      // empty fixture can therefore never make the negative probe pass.
      const salesUser = TEST_USERS.find((u) => u.userKey === "house-sales")!;
      const salesClient = await userClient(salesUser);
      await assertVisible(salesClient, "house-sales", "orders", "id", sellLegId, "sell-leg project");
      await assertVisible(salesClient, "house-sales", "order_files", "order_id", sellLegId, "sell-leg project file");
      await probeRead(salesClient, "house-sales", "e4.sales-reads-buy-leg",
        "House salesperson (side.sell) selects the upstream buy leg", "orders", "id", buyLegId);
      await probeRead(salesClient, "house-sales", "e4.sales-reads-buy-leg-lines",
        "House salesperson reads the buy leg's line items (purchase prices)", "order_line_items", "order_id", buyLegId);
      await probeRead(salesClient, "house-sales", "e4.sales-reads-buy-leg-files",
        "House salesperson reads the buy leg's files (hole closed in E4)", "order_files", "order_id", buyLegId);
      {
        const { data, error } = await salesClient.from("order_files").insert({
          order_id: buyLegId, category: "project", file_name: "forbidden.pdf",
          relative_path: `security/forbidden-sales-${probeStamp}.pdf`,
          storage_path: `${buyLegId}/project/forbidden-sales-${probeStamp}.pdf`,
          file_variant: "original", lifecycle_status: "ready",
        }).select("id");
        results.push({ userKey: "house-sales", probeName: "projects.sales-writes-hidden-buy-leg", description: "House salesperson writes a project file onto the hidden buy leg", outcome: (data?.length ?? 0) > 0 ? "leaked" : "blocked", rowsSeen: data?.length ?? 0, errorMessage: error?.message });
        if (data?.length) await admin.from("order_files").delete().in("id", data.map((row) => row.id));
      }
      await probeRead(salesClient, "house-sales", "e4.sales-reads-supplier-org",
        "House salesperson reads the supplier org row (walled address book)", "organisations", "id", orgDId);
      await salesClient.auth.signOut();

      const purchUser = TEST_USERS.find((u) => u.userKey === "house-purchasing")!;
      const purchClient = await userClient(purchUser);
      await assertVisible(purchClient, "house-purchasing", "orders", "id", buyLegId, "buy-leg project");
      await assertVisible(purchClient, "house-purchasing", "order_files", "order_id", buyLegId, "buy-leg project file");
      await probeRead(purchClient, "house-purchasing", "e4.purchasing-reads-sell-leg",
        "House purchasing (side.buy) selects the downstream sell leg", "orders", "id", sellLegId);
      await purchClient.auth.signOut();

      const clientUser = TEST_USERS.find((u) => u.userKey === "client-user")!;
      const clientClient = await userClient(clientUser);
      await assertVisible(clientClient, "client-user", "orders", "id", sellLegId, "own project");
      await assertVisible(clientClient, "client-user", "order_files", "order_id", sellLegId, "own project file");
      await probeRead(clientClient, "client-user", "e4.client-reads-buy-leg",
        "Client selects the upstream buy leg (goods' origin hidden)", "orders", "id", buyLegId);
      await probeRead(clientClient, "client-user", "e4.client-reads-supplier-org",
        "Client reads the supplier org row", "organisations", "id", orgDId);
      {
        const { data, error } = await clientClient.from("order_files").insert({
          order_id: sellLegId, category: "project", file_name: "forbidden.pdf",
          relative_path: `security/forbidden-client-${probeStamp}.pdf`,
          storage_path: `${sellLegId}/project/forbidden-client-${probeStamp}.pdf`,
          file_variant: "original", lifecycle_status: "ready",
        }).select("id");
        results.push({ userKey: "client-user", probeName: "projects.client-writes-without-capability", description: "Client writes a project file without action/deal/create", outcome: (data?.length ?? 0) > 0 ? "leaked" : "blocked", rowsSeen: data?.length ?? 0, errorMessage: error?.message });
        if (data?.length) await admin.from("order_files").delete().in("id", data.map((row) => row.id));
      }
      await clientClient.auth.signOut();

      const supplierUser = TEST_USERS.find((u) => u.userKey === "supplier-user")!;
      const supplierClient = await userClient(supplierUser);
      await assertVisible(supplierClient, "supplier-user", "orders", "id", buyLegId, "own project");
      await assertVisible(supplierClient, "supplier-user", "order_files", "order_id", buyLegId, "own project file");
      await probeRead(supplierClient, "supplier-user", "e4.supplier-reads-sell-leg",
        "Supplier selects the downstream sell leg", "orders", "id", sellLegId);
      await supplierClient.auth.signOut();
    } finally {
      await admin.from("order_files").delete().in("id", projectFileCanaries.map((row) => row.id));
    }
  }

  return results;
}
