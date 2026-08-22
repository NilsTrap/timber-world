/**
 * MCP-coverage check (E5 completeness rule): every deterministic deal-lifecycle
 * step must be served by at least one registered MCP tool — no UI-only mutations.
 * ALSO (T-modularize): asserts the per-domain HANDLER maps and the TOOLS catalog
 * are in exact 1:1 correspondence — the guarantee the mechanical split into
 * domains/deals.ts · crm.ts · catalog.ts didn't drop or mis-wire a case.
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/app/api/timber-mcp/tools-coverage.test.ts`
 */

// The tool catalog now aggregates the per-domain modules (domains/*), which import
// the portal services; one of those (@/lib/access/profile) constructs a Supabase
// admin client at MODULE LOAD. Provide harmless placeholder env vars (only when the
// real ones are absent) so this pure catalog/handler-parity check can import the
// modules without a live DB — createSupabaseClient does no network at construction.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder-service-role-key";

let passed = 0;
let failed = 0;
function ok(label: string, cond: boolean) {
  if (cond) passed++;
  else { failed++; console.error(`✗ ${label}`); }
}

async function main() {
  // Dynamic imports so the placeholder env above is in place before the domain
  // modules (and their service graph) load.
  const { TOOLS, LIFECYCLE_STEPS, USER_WRITE_CAPABILITY } = await import("./tools");
  const { dealHandlers } = await import("./domains/deals");
  const { crmHandlers } = await import("./domains/crm");
  const { catalogHandlers } = await import("./domains/catalog");
  // The SAME merge route.ts performs to build its dispatch table.
  const HANDLERS = { ...dealHandlers, ...crmHandlers, ...catalogHandlers };

  // 1. Completeness: every lifecycle step has ≥1 tool.
  for (const step of LIFECYCLE_STEPS) {
    const tools = TOOLS.filter((t) => t.lifecycle === step).map((t) => t.name);
    ok(`lifecycle step "${step}" covered by a tool (${tools.join(", ") || "NONE"})`, tools.length >= 1);
  }

  // 2. Every tool's lifecycle is a known step.
  for (const t of TOOLS) {
    ok(`tool ${t.name} has a valid lifecycle (${t.lifecycle})`, (LIFECYCLE_STEPS as readonly string[]).includes(t.lifecycle));
  }

  // 3. Tool names are unique.
  const names = TOOLS.map((t) => t.name);
  ok("tool names are unique", new Set(names).size === names.length);

  // 4. Every tool name is timber_-prefixed + has a JSON-schema object inputSchema.
  for (const t of TOOLS) {
    ok(`${t.name} is timber_-prefixed`, t.name.startsWith("timber_"));
    ok(`${t.name} inputSchema is an object schema`, (t.inputSchema as { type?: string }).type === "object");
  }

  // 5. Read-only tools are reads (named *_list/_get/_definitions/_options); writes are not.
  for (const t of TOOLS) {
    const looksRead = /_(list|get)_/.test(t.name) || /(_definitions|_options|_missing_docs)$/.test(t.name);
    if (t.readOnly) ok(`${t.name} (readOnly) is named like a read`, looksRead);
  }

  // 6. E7: the new spine/gates/access tools are all registered.
  const byName = new Map(TOOLS.map((t) => [t.name, t]));
  for (const req of [
    "timber_get_spine", "timber_list_spine_deals", "timber_get_spine_lineage",
    "timber_get_advance_status", "timber_list_gate_configs", "timber_advance_deal",
    "timber_record_gate_confirmation", "timber_cancel_deal",
    "timber_list_access_groups", "timber_get_access_group",
    "timber_list_user_access_groups", "timber_list_users",
  ]) {
    ok(`E7 tool ${req} is registered`, byName.has(req));
  }

  // 7. The "gates" step must expose BOTH a read (evaluate/list) AND a state-changing
  //    write (advance/cancel) — the completeness rule forbids UI-only lifecycle mutations.
  const gateTools = TOOLS.filter((t) => t.lifecycle === "gates");
  ok("gates step has a read tool", gateTools.some((t) => t.readOnly));
  ok("gates step has a write tool", gateTools.some((t) => !t.readOnly));
  const advance = byName.get("timber_advance_deal");
  ok("a deal can be advanced through its gate via MCP (write)", advance != null && advance.readOnly === false);
  const cancel = byName.get("timber_cancel_deal");
  ok("a deal can be cancelled via MCP (write)", cancel != null && cancel.readOnly === false);

  // 8. J3: the access step now exposes BOTH reads AND writes (group CRUD + rights +
  //    user-group assignment). All access writes are full-token only.
  const accessTools = TOOLS.filter((t) => t.lifecycle === "access");
  ok("access step has a read tool", accessTools.some((t) => t.readOnly));
  ok("access step has a write tool", accessTools.some((t) => !t.readOnly));
  for (const req of ["timber_set_user_groups", "timber_upsert_access_group", "timber_delete_access_group"]) {
    const t = byName.get(req);
    ok(`J3 access write ${req} is registered as a full-token write`, t != null && t.readOnly === false);
  }

  // 9. create_deal exposes the bilateral buy-leg auto-spawn (needs_sourcing + source_organisation_id).
  const createDealProps =
    ((byName.get("timber_create_deal")?.inputSchema as { properties?: Record<string, unknown> })?.properties) ?? {};
  ok("create_deal exposes needs_sourcing", "needs_sourcing" in createDealProps);
  ok("create_deal exposes source_organisation_id", "source_organisation_id" in createDealProps);

  // L1 (2026-07-04): spine-Lego leg parity — create_deal can fork a leg onto an
  // origin deal's spine (copying its lines), and start_sourcing's buy-leg buyer is
  // editable (the Meeting-1 wrong-buyer fix).
  ok("L1: create_deal exposes origin_deal_id (leg on a spine)", "origin_deal_id" in createDealProps);
  ok("L1: create_deal exposes copy_lines", "copy_lines" in createDealProps);
  const startSourcingProps =
    ((byName.get("timber_start_sourcing")?.inputSchema as { properties?: Record<string, unknown> })?.properties) ?? {};
  ok("L1: start_sourcing exposes editable buyer_organisation_id", "buyer_organisation_id" in startSourcingProps);

  // ── J (2026-07-04): MCP parity for Vilma — every new UI action is a tool ──────
  // The completeness rule becomes EXECUTABLE for the J additions: a future UI action
  // shipped without its MCP tool (or a lost registration) FAILS this build.
  const props = (n: string) =>
    ((byName.get(n)?.inputSchema as { properties?: Record<string, unknown> })?.properties) ?? {};
  const isWrite = (n: string) => { const t = byName.get(n); return t != null && t.readOnly === false; };
  const isRead = (n: string) => { const t = byName.get(n); return t != null && t.readOnly === true; };

  // J1 · deal-flow parity — firming / sourcing / margin each MUST have a write tool.
  for (const step of ["firming", "sourcing", "margin"] as const) {
    const stepTools = TOOLS.filter((t) => t.lifecycle === step);
    ok(`"${step}" step has a write tool`, stepTools.some((t) => !t.readOnly));
  }
  ok("J1: timber_firm_order_specification is a full-token write", isWrite("timber_firm_order_specification"));
  ok("J1: timber_start_sourcing is a full-token write", isWrite("timber_start_sourcing"));
  ok("J1: timber_set_margin_approval is a full-token write", isWrite("timber_set_margin_approval"));
  // J1 · signee overrides (G3) settable via update_deal.
  for (const f of ["seller_signee_name", "seller_signee_role", "buyer_signee_name", "buyer_signee_role"]) {
    ok(`J1: update_deal exposes ${f}`, f in props("timber_update_deal"));
  }

  // J2 · CRM parity — org step has BOTH create AND update; update_org carries the role flags.
  ok("J2: org step has a create tool", byName.has("timber_create_org"));
  ok("J2: org step has an update tool (timber_update_org)", isWrite("timber_update_org"));
  for (const f of ["is_customer", "is_manufacturer", "is_producer", "is_supplier", "is_active"]) {
    ok(`J2: update_org exposes role/status flag ${f}`, f in props("timber_update_org"));
  }

  // J4 · catalog & stock — the step needs reads AND a stock write; the write guard is on the service.
  const catalogTools = TOOLS.filter((t) => t.lifecycle === "catalog");
  ok("catalog step has a read tool", catalogTools.some((t) => t.readOnly));
  ok("catalog step has a write tool", catalogTools.some((t) => !t.readOnly));
  ok("J4: timber_list_catalog_products is a read", isRead("timber_list_catalog_products"));
  ok("J4: timber_get_catalog_variant is a read", isRead("timber_get_catalog_variant"));
  ok("J4: timber_get_variant_stock is a read", isRead("timber_get_variant_stock"));
  ok("J4: timber_set_variant_stock is a full-token write", isWrite("timber_set_variant_stock"));

  // ── T3-T7 (2026-07-05): the 53 tools Epic T added (deals +12, crm +13,
  // catalog +28), taking the surface 40 → 93. Same EXECUTABLE completeness
  // contract as the J block: a new UI action shipped without its MCP tool (or a
  // lost / mis-flagged registration) FAILS this build. For each new tool assert
  // it is registered with the correct read/write flag; for the key ones assert a
  // critical arg is in its schema (and, where it matters, its user-key capability).
  const req = (n: string) =>
    ((byName.get(n)?.inputSchema as { required?: string[] })?.required) ?? [];
  const cap = (n: string) => USER_WRITE_CAPABILITY[n];

  // T-deals (+12) — duplicate, stage/parties/signee edits, deal-file + signed-doc
  // attachments, document delete, gate-config authoring.
  for (const w of [
    "timber_duplicate_deal", "timber_set_deal_stage", "timber_set_deal_parties",
    "timber_use_contact_as_signee", "timber_upload_deal_file", "timber_delete_deal_file",
    "timber_upload_signed_document", "timber_delete_signed_document",
    "timber_delete_document", "timber_upsert_gate_config",
  ]) ok(`T-deals write ${w} is a full-token write`, isWrite(w));
  for (const r of ["timber_get_deal_signee_context", "timber_get_signed_document_url"])
    ok(`T-deals read ${r} is a read`, isRead(r));
  ok("T: set_deal_stage exposes stage", "stage" in props("timber_set_deal_stage"));
  ok("T: set_deal_parties exposes customer + seller org ids",
    "customer_organisation_id" in props("timber_set_deal_parties") &&
    "seller_organisation_id" in props("timber_set_deal_parties"));
  ok("T: use_contact_as_signee side is a seller|buyer enum",
    ((props("timber_use_contact_as_signee").side as { enum?: string[] })?.enum ?? []).join() === "seller,buyer");
  ok("T: use_contact_as_signee requires contact_id", req("timber_use_contact_as_signee").includes("contact_id"));
  ok("T: upload_deal_file exposes content (base64 body)", "content" in props("timber_upload_deal_file"));
  ok("T: upload_signed_document exposes content + document_id",
    "content" in props("timber_upload_signed_document") && "document_id" in props("timber_upload_signed_document"));
  ok("T: upsert_gate_config exposes requirements", "requirements" in props("timber_upsert_gate_config"));
  ok("T: delete_document is admin-capability gated", cap("timber_delete_document") === "admin");
  ok("T: upsert_gate_config is admin-capability gated", cap("timber_upsert_gate_config") === "admin");

  // T-crm (+13) — org-contact book, people directory + person CRUD, platform settings.
  for (const w of [
    "timber_upsert_org_contact", "timber_delete_org_contact", "timber_create_person",
    "timber_add_person_to_org", "timber_remove_person_from_org", "timber_update_person",
    "timber_toggle_person_active", "timber_resend_person_invite", "timber_set_platform_setting",
  ]) ok(`T-crm write ${w} is a full-token write`, isWrite(w));
  for (const r of [
    "timber_list_org_contacts", "timber_get_people_directory", "timber_get_person",
    "timber_get_platform_setting",
  ]) ok(`T-crm read ${r} is a read`, isRead(r));
  // Contact cards remain book-scoped; login-person onboarding is platform-admin only.
  for (const c of ["timber_upsert_org_contact", "timber_delete_org_contact"])
    ok(`T: ${c} is counterparty-capability gated`, cap(c) === "counterparty");
  for (const c of ["timber_create_person", "timber_add_person_to_org", "timber_remove_person_from_org"])
    ok(`T: ${c} is platform-admin gated`, cap(c) === "admin");
  ok("T: create_person requires + exposes org_id",
    req("timber_create_person").includes("org_id") && "org_id" in props("timber_create_person"));
  ok("T: upsert_org_contact requires org_id", req("timber_upsert_org_contact").includes("org_id"));
  ok("T: set_platform_setting exposes key + value",
    "key" in props("timber_set_platform_setting") && "value" in props("timber_set_platform_setting"));
  ok("T: set_platform_setting is admin-capability gated", cap("timber_set_platform_setting") === "admin");
  ok("T: person-management writes are admin-gated",
    cap("timber_create_person") === "admin" && cap("timber_add_person_to_org") === "admin" &&
    cap("timber_remove_person_from_org") === "admin" && cap("timber_update_person") === "admin" && cap("timber_toggle_person_active") === "admin" &&
    cap("timber_resend_person_invite") === "admin");
  for (const n of ["timber_create_person", "timber_add_person_to_org", "timber_resend_person_invite"]) {
    const schema = JSON.stringify(byName.get(n)?.inputSchema ?? {});
    ok(`T: ${n} exposes no password/token/link field`, !/(password|token|magic_link|action_link)/i.test(schema));
  }

  // T-catalog (+28) — category / field / field-option / assignment / product /
  // variant / packaging / currency CRUD + bulk action + stock delete. All are
  // admin-gated FULL-token writes; list/get_category + the currency reads are reads.
  for (const w of [
    "timber_save_category", "timber_duplicate_category", "timber_delete_category",
    "timber_save_field", "timber_delete_field", "timber_save_field_option", "timber_delete_field_option",
    "timber_save_field_assignment", "timber_remove_field_assignment",
    "timber_save_product", "timber_duplicate_product", "timber_delete_product", "timber_bulk_product_action",
    "timber_save_variant", "timber_delete_variant",
    "timber_save_packaging_type", "timber_delete_packaging_type",
    "timber_assign_variant_packaging", "timber_remove_variant_packaging",
    "timber_save_currency", "timber_delete_currency", "timber_update_currency_prices",
    "timber_set_variant_currency_override", "timber_delete_variant_stock",
  ]) {
    ok(`T-catalog write ${w} is a full-token write`, isWrite(w));
    ok(`T-catalog write ${w} is admin-capability gated`, cap(w) === "admin");
  }
  for (const r of [
    "timber_list_categories", "timber_get_category",
    "timber_list_currencies", "timber_get_catalog_currency_prices",
  ]) ok(`T-catalog read ${r} is a read`, isRead(r));
  // bulk_product_action's discriminator (delete | set_active | set_visibility |
  // move_to_category) is a required arg (enum values documented in its description;
  // the handler validates them).
  ok("T: bulk_product_action exposes action", "action" in props("timber_bulk_product_action"));
  ok("T: bulk_product_action requires action + product_ids",
    req("timber_bulk_product_action").includes("action") && req("timber_bulk_product_action").includes("product_ids"));
  ok("T: save_variant exposes product_id + price_eur_cents",
    "product_id" in props("timber_save_variant") && "price_eur_cents" in props("timber_save_variant"));
  ok("T: set_variant_currency_override exposes variant_id + currency_code + price_cents",
    ["variant_id", "currency_code", "price_cents"].every((k) => k in props("timber_set_variant_currency_override")));
  ok("T: get_catalog_currency_prices exposes entity_ids", "entity_ids" in props("timber_get_catalog_currency_prices"));
  ok("T: save_field exposes field_key + field_type",
    "field_key" in props("timber_save_field") && "field_type" in props("timber_save_field"));

  // T3 · update_deal refresh — currency + notes now settable on the header (R3).
  ok("T3: update_deal exposes currency", "currency" in props("timber_update_deal"));
  ok("T3: update_deal exposes notes", "notes" in props("timber_update_deal"));

  // Headline count guard: Epic T took the surface 40 → 93 (+53). Locks the number a
  // regression (or an unregistered/dropped tool) would otherwise move silently.
  ok("T: tool count is 93 (was 40, +53 in Epic T)", TOOLS.length === 93);

  // 10. T2 · per-user WRITE authorization is DENY-by-default: EVERY write tool
  //     (readOnly:false) MUST declare a user-key capability in USER_WRITE_CAPABILITY,
  //     and read-only tools must NOT (they need no write gate). A new write tool
  //     shipped without its capability fails HERE (and is refused over a user key at
  //     runtime) — the enforcement that a user key can never exceed its owner's perms.
  const ALLOWED_CAPS = new Set(["admin", "deal_terms", "orders_view", "suppliers_book", "counterparty", "catalogue"]);
  for (const t of TOOLS) {
    if (t.readOnly) {
      ok(`${t.name} (read) has NO write capability`, !(t.name in USER_WRITE_CAPABILITY));
    } else {
      ok(`${t.name} (write) declares a user-key capability`, t.name in USER_WRITE_CAPABILITY);
      ok(`${t.name} capability is a known value`, ALLOWED_CAPS.has(USER_WRITE_CAPABILITY[t.name] as string));
    }
  }
  // No capability entry may reference a non-existent / read-only tool (drift guard).
  const toolByName = new Map(TOOLS.map((t) => [t.name, t]));
  for (const name of Object.keys(USER_WRITE_CAPABILITY)) {
    const t = toolByName.get(name);
    ok(`capability entry ${name} maps to a registered write tool`, t != null && t.readOnly === false);
  }

  // 11. T-modularize · HANDLER ↔ DEFINITION parity. The mechanical split moved each
  //     switch case into a per-domain handler map; this asserts nothing was dropped
  //     or mis-wired in EITHER direction (the core safety net for the refactor):
  //      (a) every registered tool has exactly one dispatch handler, and
  //      (b) every handler key maps to a registered tool (no orphan handlers).
  const handlerNames = new Set(Object.keys(HANDLERS));
  const toolNames = new Set(TOOLS.map((t) => t.name));
  for (const t of TOOLS) {
    ok(`tool ${t.name} has a dispatch handler`, handlerNames.has(t.name));
  }
  for (const n of handlerNames) {
    ok(`handler ${n} maps to a registered tool (no orphan)`, toolNames.has(n));
  }
  // The three domain handler maps are disjoint (a tool is owned by exactly one
  // domain) — a duplicate key across domains would be silently swallowed by the merge.
  const perDomainKeyCount =
    Object.keys(dealHandlers).length + Object.keys(crmHandlers).length + Object.keys(catalogHandlers).length;
  ok("domain handler maps are disjoint (no key handled by two domains)", perDomainKeyCount === handlerNames.size);
  // Exact 1:1: |handlers| == |tools|.
  ok(`handler count equals tool count (${handlerNames.size} == ${TOOLS.length})`, handlerNames.size === TOOLS.length);

  console.log(`\n${passed} passed, ${failed} failed — ${TOOLS.length} tools across ${LIFECYCLE_STEPS.length} lifecycle steps, ${handlerNames.size} handlers`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
