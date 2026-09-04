import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  loadUiFlowEnvFile,
  resolveUiFlowFixtureConfig,
  UI_FLOW_IDS,
  UI_FLOW_PERSONAS,
  UI_FLOW_RFP_CANDIDATES,
  type UiFlowFixtureConfig,
  type UiFlowOrganisationKey,
  type UiFlowPersonaKey,
} from "./fixtureConfig.js";

type Command = "apply" | "reset" | "verify";
type AuthUsers = Record<UiFlowPersonaKey, User>;

const organisationRows: Array<{
  key: UiFlowOrganisationKey;
  code: string;
  label: string;
  roleFlags: Record<string, boolean>;
}> = [
  { key: "trader", code: "UFT", label: "Trader", roleFlags: { is_trader: true, is_manufacturer: true } },
  { key: "buyer", code: "UFB", label: "Buyer", roleFlags: { is_customer: true } },
  { key: "metalSupplier", code: "UFM", label: "Metal Supplier", roleFlags: { is_supplier: true, is_manufacturer: true } },
  { key: "woodSupplier", code: "UFW", label: "Wood Supplier", roleFlags: { is_supplier: true, is_manufacturer: true } },
  { key: "metalBackup", code: "UMX", label: "Metal Backup Supplier", roleFlags: { is_supplier: true, is_manufacturer: true } },
  { key: "woodBackup", code: "UWX", label: "Wood Backup Supplier", roleFlags: { is_supplier: true, is_manufacturer: true } },
];

const orderIds = Object.values(UI_FLOW_IDS.orders);
const legOrderIds = [UI_FLOW_IDS.orders.metalLeg, UI_FLOW_IDS.orders.woodLeg];
const userIds = Object.values(UI_FLOW_IDS.users);
const requiredModules = ["dashboard.view", "projects.view", "counterparties.clients", "counterparties.suppliers"];
const requiredGroups = ["buyer", "trader", "manufacturer"];

function commandFrom(argv: string[]): Command {
  const command = argv.slice(2).find((argument) => argument !== "--") ?? "apply";
  if (command !== "apply" && command !== "reset" && command !== "verify") {
    throw new Error("Usage: ui-flow:fixture [apply|reset|verify]");
  }
  return command;
}

function adminClient(config: UiFlowFixtureConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function displayName(runLabel: string, key: UiFlowPersonaKey): string {
  const labels: Record<UiFlowPersonaKey, string> = {
    superAdmin: "Super Admin",
    trader: "Trader",
    buyer: "Buyer",
    metalSupplier: "Metal Supplier",
    woodSupplier: "Wood Supplier",
  };
  return `${runLabel} ${labels[key]}`;
}

async function existingFixtureAuthUsers(client: SupabaseClient): Promise<Map<string, User>> {
  const wanted = new Set<string>(Object.values(UI_FLOW_PERSONAS).map((persona) => persona.email));
  const found = new Map<string, User>();
  for (let page = 1; page <= 50 && found.size < wanted.size; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not inspect fixture auth users: ${error.message}`);
    for (const user of data.users) {
      const email = user.email?.toLowerCase();
      if (email && wanted.has(email)) found.set(email, user);
    }
    if (data.users.length < 200) break;
  }
  return found;
}

async function ensureAuthUsers(client: SupabaseClient, config: UiFlowFixtureConfig): Promise<AuthUsers> {
  const existing = await existingFixtureAuthUsers(client);
  const result = {} as AuthUsers;
  for (const key of Object.keys(UI_FLOW_PERSONAS) as UiFlowPersonaKey[]) {
    const persona = UI_FLOW_PERSONAS[key];
    const current = existing.get(persona.email);
    const attributes = {
      password: config.password,
      email_confirm: true,
      user_metadata: { name: displayName(config.runLabel, key), fixture: "nilitto-ui-flow" },
    };
    if (current) {
      const { data, error } = await client.auth.admin.updateUserById(current.id, attributes);
      if (error || !data.user) throw new Error(`Could not refresh synthetic ${key} auth user: ${error?.message}`);
      result[key] = data.user;
    } else {
      const { data, error } = await client.auth.admin.createUser({ email: persona.email, ...attributes });
      if (error || !data.user) throw new Error(`Could not create synthetic ${key} auth user: ${error?.message}`);
      result[key] = data.user;
    }
  }
  return result;
}

async function requireRegistry(client: SupabaseClient): Promise<Record<string, string>> {
  const [{ data: modules, error: modulesError }, { data: groups, error: groupsError }] = await Promise.all([
    client.from("modules").select("code").in("code", requiredModules),
    client.from("access_groups").select("id,key").in("key", requiredGroups),
  ]);
  if (modulesError || groupsError) throw new Error(`Could not verify fixture registry: ${modulesError?.message ?? groupsError?.message}`);
  const presentModules = new Set((modules ?? []).map((row) => String(row.code)));
  const missingModules = requiredModules.filter((code) => !presentModules.has(code));
  const groupIds = Object.fromEntries((groups ?? []).map((row) => [String(row.key), String(row.id)]));
  const missingGroups = requiredGroups.filter((key) => !groupIds[key]);
  if (missingModules.length || missingGroups.length) {
    throw new Error(`Fixture prerequisites missing: modules=[${missingModules.join(",")}], groups=[${missingGroups.join(",")}]`);
  }
  return groupIds;
}

async function clearMutableProjectState(client: SupabaseClient): Promise<void> {
  const { data: files, error: filesError } = await client.from("order_files").select("storage_path").in("order_id", orderIds);
  if (filesError) throw new Error(`Could not inspect fixture files: ${filesError.message}`);
  const paths = [...new Set((files ?? []).map((row) => String(row.storage_path)).filter(Boolean))];
  if (paths.length > 0) {
    const { error } = await client.storage.from("orders").remove(paths);
    if (error) throw new Error(`Could not remove fixture storage objects: ${error.message}`);
  }

  const clearAward = await client.from("project_rfqs").update({ awarded_candidate_id: null }).in("order_id", orderIds);
  if (clearAward.error) throw new Error(`Could not clear fixture RFQ awards: ${clearAward.error.message}`);
  const operations = [
    ["commercial sources", () => client.from("project_leg_commercial_sources").delete().or(`target_order_id.in.(${orderIds.join(",")}),source_order_id.in.(${orderIds.join(",")})`)],
    ["commercial lines", () => client.from("project_leg_commercial_lines").delete().in("target_order_id", orderIds)],
    ["image designations", () => client.from("spine_project_images").delete().eq("spine_id", UI_FLOW_IDS.spine)],
    ["RFQs", () => client.from("project_rfqs").delete().in("order_id", orderIds)],
    ["files", () => client.from("order_files").delete().in("order_id", orderIds)],
    ["folders", () => client.from("project_folders").delete().in("order_id", orderIds)],
  ] as const;
  for (const [label, operation] of operations) {
    const result = await operation();
    if (result.error) throw new Error(`Could not clear fixture ${label}: ${result.error.message}`);
  }

  const cleanupResult = await client.from("project_storage_cleanup").delete().in("order_id", orderIds);
  if (cleanupResult.error) throw new Error(`Could not clear fixture storage queue: ${cleanupResult.error.message}`);
}

async function seedOrganisations(client: SupabaseClient, config: UiFlowFixtureConfig): Promise<void> {
  const rows = organisationRows.map(({ key, code, label, roleFlags }) => ({
    id: UI_FLOW_IDS.organisations[key],
    code,
    name: `${config.runLabel} ${label}`,
    is_active: true,
    is_external: false,
    is_customer: false,
    is_trader: false,
    is_supplier: false,
    is_producer: false,
    is_manufacturer: false,
    ...roleFlags,
  }));
  const { error } = await client.from("organisations").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Could not seed fixture organisations: ${error.message}`);
}

async function seedUsersAndAccess(
  client: SupabaseClient,
  config: UiFlowFixtureConfig,
  authUsers: AuthUsers,
  groupIds: Record<string, string>,
): Promise<void> {
  const portalRows = (Object.keys(UI_FLOW_PERSONAS) as UiFlowPersonaKey[]).map((key) => {
    const persona = UI_FLOW_PERSONAS[key];
    const organisationId = persona.organisation ? UI_FLOW_IDS.organisations[persona.organisation] : null;
    return {
      id: UI_FLOW_IDS.users[key],
      auth_user_id: authUsers[key].id,
      email: persona.email,
      name: displayName(config.runLabel, key),
      role: key === "superAdmin" ? "admin" : "user",
      organisation_id: organisationId,
      status: "active",
      is_active: true,
      is_platform_admin: key === "superAdmin",
    };
  });
  const portalResult = await client.from("portal_users").upsert(portalRows, { onConflict: "id" });
  if (portalResult.error) throw new Error(`Could not seed fixture people: ${portalResult.error.message}`);

  const ordinaryKeys = (Object.keys(UI_FLOW_PERSONAS) as UiFlowPersonaKey[]).filter((key) => key !== "superAdmin");
  const memberships = ordinaryKeys.map((key) => {
    const organisationKey = UI_FLOW_PERSONAS[key].organisation;
    if (!organisationKey) throw new Error(`Fixture persona ${key} has no organisation`);
    return {
      user_id: UI_FLOW_IDS.users[key],
      organization_id: UI_FLOW_IDS.organisations[organisationKey],
      is_active: true,
      is_primary: true,
      invited_by: UI_FLOW_IDS.users.superAdmin,
    };
  });
  const membershipResult = await client.from("organization_memberships").upsert(memberships, { onConflict: "user_id,organization_id" });
  if (membershipResult.error) throw new Error(`Could not seed fixture memberships: ${membershipResult.error.message}`);

  const accessDelete = await client.from("user_access_groups").delete().in("user_id", userIds);
  if (accessDelete.error) throw new Error(`Could not reset fixture access groups: ${accessDelete.error.message}`);
  const assignments = ordinaryKeys.map((key) => {
    const persona = UI_FLOW_PERSONAS[key];
    if (!persona.organisation || !persona.group) throw new Error(`Fixture persona ${key} has incomplete access metadata`);
    return {
      user_id: UI_FLOW_IDS.users[key],
      organization_id: UI_FLOW_IDS.organisations[persona.organisation],
      group_id: groupIds[persona.group],
    };
  });
  const accessResult = await client.from("user_access_groups").insert(assignments);
  if (accessResult.error) throw new Error(`Could not assign fixture access groups: ${accessResult.error.message}`);
}

async function seedModulesAndPartners(client: SupabaseClient, authUsers: AuthUsers): Promise<void> {
  const modules = organisationRows.flatMap(({ key }) => {
    const base = ["dashboard.view", "projects.view"];
    const enabled = key === "trader" ? [...base, "counterparties.clients", "counterparties.suppliers"] : base;
    return enabled.map((moduleCode) => ({
      organization_id: UI_FLOW_IDS.organisations[key],
      module_code: moduleCode,
      enabled: true,
    }));
  });
  const moduleResult = await client.from("organization_modules").upsert(modules, { onConflict: "organization_id,module_code" });
  if (moduleResult.error) throw new Error(`Could not seed fixture organisation modules: ${moduleResult.error.message}`);

  const trader = UI_FLOW_IDS.organisations.trader;
  const partnerPairs = [
    [UI_FLOW_IDS.organisations.buyer, trader],
    [trader, UI_FLOW_IDS.organisations.buyer],
    [trader, UI_FLOW_IDS.organisations.metalSupplier],
    [UI_FLOW_IDS.organisations.metalSupplier, trader],
    [trader, UI_FLOW_IDS.organisations.woodSupplier],
    [UI_FLOW_IDS.organisations.woodSupplier, trader],
    [trader, UI_FLOW_IDS.organisations.metalBackup],
    [UI_FLOW_IDS.organisations.metalBackup, trader],
    [trader, UI_FLOW_IDS.organisations.woodBackup],
    [UI_FLOW_IDS.organisations.woodBackup, trader],
  ];
  const fixtureOrganisationIds = Object.values(UI_FLOW_IDS.organisations);
  const partnerDelete = await client.from("organisation_trading_partners").delete()
    .in("organisation_id", fixtureOrganisationIds)
    .in("partner_organisation_id", fixtureOrganisationIds);
  if (partnerDelete.error) throw new Error(`Could not reset fixture partner links: ${partnerDelete.error.message}`);
  const partnerResult = await client.from("organisation_trading_partners").upsert(
    partnerPairs.map(([organisationId, partnerId]) => ({
      organisation_id: organisationId,
      partner_organisation_id: partnerId,
      created_by: authUsers.superAdmin.id,
    })),
    { onConflict: "organisation_id,partner_organisation_id" },
  );
  if (partnerResult.error) throw new Error(`Could not seed fixture partner links: ${partnerResult.error.message}`);
}

async function seedProject(client: SupabaseClient, config: UiFlowFixtureConfig): Promise<void> {
  const title = `${config.runLabel} Metal staircase with wooden treads`;
  const spineResult = await client.from("spines").upsert({
    id: UI_FLOW_IDS.spine,
    code: "SP-UIFLOW-001",
    title,
    life_stage: "spec",
    status: "draft",
    product_group: "Staircase",
    origin: "root",
    created_by: UI_FLOW_IDS.users.buyer,
    origin_order_id: null,
  }, { onConflict: "id" });
  if (spineResult.error) throw new Error(`Could not seed fixture spine: ${spineResult.error.message}`);

  const orders = [
    {
      id: UI_FLOW_IDS.orders.origin,
      code: "UIFLOW-ROOT-001",
      deal_code: "UFT-UFB-001",
      name: title,
      customer_organisation_id: UI_FLOW_IDS.organisations.buyer,
      seller_organisation_id: UI_FLOW_IDS.organisations.trader,
      buyer_organisation_id: UI_FLOW_IDS.organisations.buyer,
      deal_kind: "buy_sell",
      project_sort_order: 1,
      is_manual_spine_leg: false,
    },
    {
      id: UI_FLOW_IDS.orders.metalLeg,
      code: "UIFLOW-METAL-001",
      deal_code: "XXX-UFT-001",
      name: `${title} - metal sourcing`,
      customer_organisation_id: UI_FLOW_IDS.organisations.trader,
      seller_organisation_id: null,
      buyer_organisation_id: UI_FLOW_IDS.organisations.trader,
      deal_kind: "purchase_only",
      project_sort_order: 2,
      is_manual_spine_leg: true,
    },
    {
      id: UI_FLOW_IDS.orders.woodLeg,
      code: "UIFLOW-WOOD-001",
      deal_code: "XXX-UFT-002",
      name: `${title} - wooden treads sourcing`,
      customer_organisation_id: UI_FLOW_IDS.organisations.trader,
      seller_organisation_id: null,
      buyer_organisation_id: UI_FLOW_IDS.organisations.trader,
      deal_kind: "purchase_only",
      project_sort_order: 3,
      is_manual_spine_leg: true,
    },
  ].map((row) => ({
    ...row,
    spine_id: UI_FLOW_IDS.spine,
    status: "draft",
    lifecycle_stage: "draft",
    currency: "EUR",
    product_group: "Staircase",
    created_by: UI_FLOW_IDS.users.buyer,
    deleted_at: null,
    deleted_by: null,
    deletion_batch_id: null,
    upstream_deal_id: null,
    value_cents: null,
    commercial_rollup_state: "draft",
    commercial_offer_scope: null,
    commercial_purchase_cost_cents: null,
    commercial_adjustment_cents: null,
    commercial_margin_mode: null,
    margin_amount_cents: null,
    margin_percent: null,
    resale_value_cents: null,
    commercial_version: 0,
    commercial_confirmed_at: null,
    commercial_stale_at: null,
  }));
  const orderResult = await client.from("orders").upsert(orders, { onConflict: "id" });
  if (orderResult.error) throw new Error(`Could not seed fixture project legs: ${orderResult.error.message}`);

  const legLineDelete = await client.from("order_line_items").delete().in("order_id", legOrderIds);
  if (legLineDelete.error) throw new Error(`Could not reset fixture leg lines: ${legLineDelete.error.message}`);
  const rootLineDelete = await client.from("order_line_items").delete().eq("order_id", UI_FLOW_IDS.orders.origin)
    .not("id", "in", `(${UI_FLOW_IDS.lines.metalOrigin},${UI_FLOW_IDS.lines.woodOrigin})`);
  if (rootLineDelete.error) throw new Error(`Could not reset extra fixture root lines: ${rootLineDelete.error.message}`);

  const originLines = [
    {
      id: UI_FLOW_IDS.lines.metalOrigin,
      order_id: UI_FLOW_IDS.orders.origin,
      line_no: 1,
      product_name: "Powder-coated steel staircase frame",
      product_type: "Metal staircase",
      pieces: "300",
      unit: "kg",
      notes: "Harmless synthetic fixture: metal frame only",
      specification_fields: [
        { key: "material_grade", label: "Material grade", value: "S355", active: true },
        { key: "colour_code", label: "Colour code", value: "RAL 9005", active: true },
      ],
    },
    {
      id: UI_FLOW_IDS.lines.woodOrigin,
      order_id: UI_FLOW_IDS.orders.origin,
      line_no: 2,
      product_name: "Oak staircase treads",
      wood_species: "Oak",
      product_type: "Wooden treads",
      thickness: "40",
      width: "300",
      length: "900",
      pieces: "12",
      unit: "piece",
      notes: "Harmless synthetic fixture: twelve solid-oak treads",
      specification_fields: [
        { key: "finish", label: "Finish", value: "Natural oil", active: true },
        { key: "edge", label: "Edge", value: "Bullnose", active: true },
      ],
    },
  ].map((row) => ({ ...row, side: "sell", is_standard: false, origin_line_item_id: null, work_package_quantity: null }));
  const originResult = await client.from("order_line_items").upsert(originLines, { onConflict: "id" });
  if (originResult.error) throw new Error(`Could not seed fixture origin specification: ${originResult.error.message}`);

  const triggeredLegDelete = await client.from("order_line_items").delete().in("order_id", legOrderIds);
  if (triggeredLegDelete.error) throw new Error(`Could not normalize shared fixture lines: ${triggeredLegDelete.error.message}`);
  const legLines = [
    {
      ...originLines[0],
      id: UI_FLOW_IDS.lines.metalLeg,
      order_id: UI_FLOW_IDS.orders.metalLeg,
      origin_line_item_id: UI_FLOW_IDS.lines.metalOrigin,
      work_package_quantity: 300,
      specification_fields: originLines[0]!.specification_fields,
    },
    {
      ...originLines[1],
      id: UI_FLOW_IDS.lines.woodLeg,
      order_id: UI_FLOW_IDS.orders.woodLeg,
      origin_line_item_id: UI_FLOW_IDS.lines.woodOrigin,
      work_package_quantity: 12,
      specification_fields: originLines[1]!.specification_fields,
    },
  ];
  const legResult = await client.from("order_line_items").insert(legLines);
  if (legResult.error) throw new Error(`Could not seed split fixture work packages: ${legResult.error.message}`);

  const processDelete = await client.from("order_line_item_process_requirements").delete()
    .in("order_line_item_id", [UI_FLOW_IDS.lines.metalOrigin, UI_FLOW_IDS.lines.woodOrigin]);
  if (processDelete.error) throw new Error(`Could not reset fixture process requirements: ${processDelete.error.message}`);
  const processResult = await client.from("order_line_item_process_requirements").insert([
    { order_line_item_id: UI_FLOW_IDS.lines.metalOrigin, field_key: "metal", name: "Material", value: "300", unit: "kg", sort_order: 10 },
    { order_line_item_id: UI_FLOW_IDS.lines.metalOrigin, field_key: "cutting", name: "Cutting", value: "24", unit: "m", sort_order: 20 },
    { order_line_item_id: UI_FLOW_IDS.lines.metalOrigin, field_key: "welding", name: "Welding", value: "18", unit: "m", sort_order: 70 },
    { order_line_item_id: UI_FLOW_IDS.lines.metalOrigin, field_key: "powder_coating", name: "Powder coating", value: "22", unit: "m²", sort_order: 120 },
    { order_line_item_id: UI_FLOW_IDS.lines.woodOrigin, field_key: "cutting", name: "Cutting", value: "12", unit: "pcs", sort_order: 20 },
    { order_line_item_id: UI_FLOW_IDS.lines.woodOrigin, field_key: "sanding", name: "Sanding", value: "6.48", unit: "m²", sort_order: 30 },
    { order_line_item_id: UI_FLOW_IDS.lines.woodOrigin, field_key: "painting", name: "Oiling", value: "6.48", unit: "m²", sort_order: 90 },
  ]);
  if (processResult.error) throw new Error(`Could not seed fixture processes: ${processResult.error.message}`);

  const originLink = await client.from("spines").update({ origin_order_id: UI_FLOW_IDS.orders.origin }).eq("id", UI_FLOW_IDS.spine);
  if (originLink.error) throw new Error(`Could not link fixture origin project: ${originLink.error.message}`);
}

async function verify(client: SupabaseClient): Promise<void> {
  const groupIds = await requireRegistry(client);
  const authUsers = await existingFixtureAuthUsers(client);
  if (authUsers.size !== 5) throw new Error(`Fixture verification failed: expected 5 auth users, found ${authUsers.size}`);
  const checks = await Promise.all([
    client.from("organisations").select("id,code,is_active,is_supplier,is_manufacturer").in("id", Object.values(UI_FLOW_IDS.organisations)),
    client.from("portal_users").select("id,auth_user_id,email,role,organisation_id,is_active,is_platform_admin").in("id", userIds),
    client.from("organization_memberships").select("user_id,organization_id,is_active,is_primary").in("user_id", userIds),
    client.from("user_access_groups").select("user_id,organization_id,group_id").in("user_id", userIds),
    client.from("orders").select("id,spine_id,buyer_organisation_id,seller_organisation_id,deal_kind").in("id", orderIds).is("deleted_at", null),
    client.from("order_line_items").select("id,order_id,origin_line_item_id").in("id", Object.values(UI_FLOW_IDS.lines)),
    client.from("spines").select("id,origin_order_id").eq("id", UI_FLOW_IDS.spine).is("deleted_at", null),
    client.from("order_line_item_process_requirements").select("order_line_item_id,field_key")
      .in("order_line_item_id", [UI_FLOW_IDS.lines.metalOrigin, UI_FLOW_IDS.lines.woodOrigin]),
    client.from("organization_modules").select("organization_id,module_code").eq("enabled", true)
      .in("organization_id", Object.values(UI_FLOW_IDS.organisations)),
    client.from("organisation_trading_partners").select("organisation_id,partner_organisation_id")
      .in("organisation_id", Object.values(UI_FLOW_IDS.organisations))
      .in("partner_organisation_id", Object.values(UI_FLOW_IDS.organisations)),
  ]);
  const error = checks.find((check) => check.error)?.error;
  if (error) throw new Error(`Fixture verification query failed: ${error.message}`);
  const expectedCounts = [6, 5, 4, 4, 3, 4, 1, 7, 14, 10];
  checks.forEach((check, index) => {
    if ((check.data?.length ?? 0) !== expectedCounts[index]) {
      throw new Error(`Fixture verification failed at check ${index + 1}: expected ${expectedCounts[index]}, found ${check.data?.length ?? 0}`);
    }
  });
  const organisations = checks[0]!.data as Array<{
    id: string; code: string; is_active: boolean; is_supplier: boolean; is_manufacturer: boolean;
  }>;
  for (const [key, code] of [["metalBackup", "UMX"], ["woodBackup", "UWX"]] as const) {
    const row = organisations.find((organisation) => organisation.id === UI_FLOW_IDS.organisations[key]);
    if (!row || row.code.trim() !== code || !row.is_active || !row.is_supplier || !row.is_manufacturer) {
      throw new Error(`Fixture verification failed: ${key} is not an eligible passive supplier`);
    }
  }
  const users = checks[1]!.data as Array<{
    id: string; auth_user_id: string; email: string; role: string; organisation_id: string | null;
    is_active: boolean; is_platform_admin: boolean;
  }>;
  for (const key of Object.keys(UI_FLOW_PERSONAS) as UiFlowPersonaKey[]) {
    const persona = UI_FLOW_PERSONAS[key];
    const row = users.find((user) => user.id === UI_FLOW_IDS.users[key]);
    const expectedOrganisation = persona.organisation ? UI_FLOW_IDS.organisations[persona.organisation] : null;
    if (!row || row.email !== persona.email || row.auth_user_id !== authUsers.get(persona.email)?.id
      || row.organisation_id !== expectedOrganisation || !row.is_active
      || row.role !== (key === "superAdmin" ? "admin" : "user")
      || row.is_platform_admin !== (key === "superAdmin")) {
      throw new Error(`Fixture verification failed: ${key} persona is not wired to the expected identity and organisation`);
    }
  }
  const memberships = checks[2]!.data as Array<{ user_id: string; organization_id: string; is_active: boolean; is_primary: boolean }>;
  const access = checks[3]!.data as Array<{ user_id: string; organization_id: string; group_id: string }>;
  for (const key of (Object.keys(UI_FLOW_PERSONAS) as UiFlowPersonaKey[]).filter((candidate) => candidate !== "superAdmin")) {
    const persona = UI_FLOW_PERSONAS[key];
    if (!persona.organisation || !persona.group) throw new Error(`Fixture verification failed: ${key} access metadata is incomplete`);
    const organisationId = UI_FLOW_IDS.organisations[persona.organisation];
    if (!memberships.some((row) => row.user_id === UI_FLOW_IDS.users[key] && row.organization_id === organisationId && row.is_active && row.is_primary)
      || !access.some((row) => row.user_id === UI_FLOW_IDS.users[key] && row.organization_id === organisationId && row.group_id === groupIds[persona.group])) {
      throw new Error(`Fixture verification failed: ${key} membership or access group is missing`);
    }
  }
  const projects = checks[4]!.data as Array<{
    id: string; spine_id: string; buyer_organisation_id: string; seller_organisation_id: string | null; deal_kind: string;
  }>;
  const root = projects.find((row) => row.id === UI_FLOW_IDS.orders.origin);
  const metalLeg = projects.find((row) => row.id === UI_FLOW_IDS.orders.metalLeg);
  const woodLeg = projects.find((row) => row.id === UI_FLOW_IDS.orders.woodLeg);
  if (root?.spine_id !== UI_FLOW_IDS.spine || root.buyer_organisation_id !== UI_FLOW_IDS.organisations.buyer
    || root.seller_organisation_id !== UI_FLOW_IDS.organisations.trader || root.deal_kind !== "buy_sell"
    || metalLeg?.spine_id !== UI_FLOW_IDS.spine || metalLeg.buyer_organisation_id !== UI_FLOW_IDS.organisations.trader
    || metalLeg.seller_organisation_id !== null || metalLeg.deal_kind !== "purchase_only"
    || woodLeg?.spine_id !== UI_FLOW_IDS.spine || woodLeg.buyer_organisation_id !== UI_FLOW_IDS.organisations.trader
    || woodLeg.seller_organisation_id !== null || woodLeg.deal_kind !== "purchase_only") {
    throw new Error("Fixture verification failed: staircase project parties or leg structure drifted");
  }
  const lines = checks[5]!.data as Array<{ id: string; order_id: string; origin_line_item_id: string | null }>;
  const metal = lines.find((line) => line.id === UI_FLOW_IDS.lines.metalLeg);
  const wood = lines.find((line) => line.id === UI_FLOW_IDS.lines.woodLeg);
  if (metal?.order_id !== UI_FLOW_IDS.orders.metalLeg || metal.origin_line_item_id !== UI_FLOW_IDS.lines.metalOrigin
    || wood?.order_id !== UI_FLOW_IDS.orders.woodLeg || wood.origin_line_item_id !== UI_FLOW_IDS.lines.woodOrigin) {
    throw new Error("Fixture verification failed: metal and wood work packages are not isolated on their intended legs");
  }
  const spine = (checks[6]!.data as Array<{ id: string; origin_order_id: string | null }>)[0];
  if (spine?.origin_order_id !== UI_FLOW_IDS.orders.origin) {
    throw new Error("Fixture verification failed: staircase spine is not linked to the root project");
  }
  const partnerLinks = checks[9]!.data as Array<{ organisation_id: string; partner_organisation_id: string }>;
  for (const supplierId of Object.values(UI_FLOW_RFP_CANDIDATES).flatMap((pair) => pair.organisationIds)) {
    if (!partnerLinks.some((link) => link.organisation_id === UI_FLOW_IDS.organisations.trader && link.partner_organisation_id === supplierId)
      || !partnerLinks.some((link) => link.organisation_id === supplierId && link.partner_organisation_id === UI_FLOW_IDS.organisations.trader)) {
      throw new Error("Fixture verification failed: a primary or backup supplier is not linked to the trader");
    }
  }
}

async function applyBaseline(client: SupabaseClient, config: UiFlowFixtureConfig): Promise<void> {
  const groupIds = await requireRegistry(client);
  const authUsers = await ensureAuthUsers(client, config);
  await seedOrganisations(client, config);
  await seedUsersAndAccess(client, config, authUsers, groupIds);
  await seedModulesAndPartners(client, authUsers);
  await clearMutableProjectState(client);
  await seedProject(client, config);
  await verify(client);
}

async function main(): Promise<void> {
  const command = commandFrom(process.argv);
  const config = resolveUiFlowFixtureConfig(loadUiFlowEnvFile(process.env));
  const client = adminClient(config);
  if (command === "verify") {
    await verify(client);
  } else {
    await applyBaseline(client, config);
  }
  console.log(JSON.stringify({
    command,
    status: "ok",
    resetSemantics: "baseline-convergence",
    runLabel: config.runLabel,
    personas: Object.fromEntries(Object.entries(UI_FLOW_PERSONAS).map(([key, persona]) => [key, persona.email])),
    projectId: UI_FLOW_IDS.orders.origin,
    metalLegId: UI_FLOW_IDS.orders.metalLeg,
    woodLegId: UI_FLOW_IDS.orders.woodLeg,
    rfpCandidates: UI_FLOW_RFP_CANDIDATES,
  }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown fixture failure";
  console.error(`UI-flow fixture failed: ${message}`);
  process.exit(1);
});
