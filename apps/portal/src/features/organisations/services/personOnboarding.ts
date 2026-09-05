import { getUserEnabledModules } from "@/lib/auth/getOrgModules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PersonOnboardingDb = any;

export type OrganisationPersona = "Customer" | "Trader" | "Manufacturer/Supplier";

export interface OnboardingGroupOption {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  effectiveModules: string[];
  unavailableModules: string[];
  disabled: boolean;
  recommended: boolean;
}

export interface OrganisationRoleGroup {
  id: string;
  key: "buyer" | "trader" | "manufacturer";
  name: string;
}

export function requiredRoleModuleCodes(role: OrganisationRoleGroup["key"]): string[] {
  return role === "trader"
    ? ["dashboard.view", "projects.view", "counterparties.clients", "counterparties.suppliers"]
    : ["dashboard.view", "projects.view"];
}

export async function ensureOrganisationRoleModules(
  db: PersonOnboardingDb,
  organisationId: string,
  role: OrganisationRoleGroup["key"],
): Promise<{ ok: true } | { ok: false; code: "MODULE_ASSIGNMENT_FAILED" }> {
  const { error } = await db.from("organization_modules").upsert(
    requiredRoleModuleCodes(role).map((moduleCode) => ({ organization_id: organisationId, module_code: moduleCode, enabled: true })),
    { onConflict: "organization_id,module_code" },
  );
  return error ? { ok: false, code: "MODULE_ASSIGNMENT_FAILED" } : { ok: true };
}

export interface OnboardingMembership {
  orgId: string;
  orgName: string;
  orgCode: string;
  isActive: boolean;
  isPrimary: boolean;
  personas: OrganisationPersona[];
  groups: Array<{ groupId: string; groupName: string }>;
  effectiveModules: string[];
}

export interface OnboardingPerson {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: "admin" | "user";
  isActive: boolean;
  status: "created" | "invited" | "active";
  lastLoginAt: string | null;
  authUserId: string | null;
  invitedAt: string | null;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
  primaryOrgId: string | null;
  memberships: OnboardingMembership[];
}

export function derivePersonas(flags: {
  isCustomer?: boolean;
  isTrader?: boolean;
  isManufacturer?: boolean;
  isSupplier?: boolean;
  isProducer?: boolean;
}): OrganisationPersona[] {
  const personas: OrganisationPersona[] = [];
  if (flags.isCustomer) personas.push("Customer");
  if (flags.isTrader) personas.push("Trader");
  if (flags.isManufacturer || flags.isSupplier || flags.isProducer) {
    personas.push("Manufacturer/Supplier");
  }
  return personas;
}

/** System access-group presets recommended for each confirmed Nilitto persona. */
export function recommendedGroupKeys(flags: {
  isCustomer?: boolean;
  isTrader?: boolean;
  isManufacturer?: boolean;
  isSupplier?: boolean;
  isProducer?: boolean;
}): string[] {
  const keys: string[] = [];
  if (flags.isCustomer) keys.push("buyer");
  if (flags.isTrader) keys.push("trader");
  if (flags.isManufacturer || flags.isSupplier || flags.isProducer) keys.push("manufacturer");
  return keys;
}

/**
 * Resolve the single system access preset inherited from the company's role.
 * Access groups remain an implementation detail; onboarding callers must use
 * this resolver instead of accepting group ids from the browser or MCP.
 */
export async function getOrganisationRoleGroup(
  db: PersonOnboardingDb,
  organisationId: string,
): Promise<{ ok: true; group: OrganisationRoleGroup } | { ok: false; code: string }> {
  const { data: organisation } = await db.from("organisations")
    .select("is_customer, is_trader, is_manufacturer, is_supplier, is_producer")
    .eq("id", organisationId)
    .eq("is_active", true)
    .maybeSingle();
  if (!organisation) return { ok: false, code: "ONBOARDING_DENIED" };

  const keys = recommendedGroupKeys({
    isCustomer: organisation.is_customer,
    isTrader: organisation.is_trader,
    isManufacturer: organisation.is_manufacturer,
    isSupplier: organisation.is_supplier,
    isProducer: organisation.is_producer,
  });
  const uniqueKeys = Array.from(new Set(keys));
  if (uniqueKeys.length !== 1) return { ok: false, code: "COMPANY_ROLE_REQUIRED" };

  const key = uniqueKeys[0] as OrganisationRoleGroup["key"];
  const { data: group } = await db.from("access_groups")
    .select("id, key, name")
    .eq("key", key)
    .eq("is_system", true)
    .maybeSingle();
  return group
    ? { ok: true, group: { id: group.id, key, name: group.name } }
    : { ok: false, code: "ROLE_GROUP_MISSING" };
}

export function effectiveModuleIntersection(orgModules: Iterable<string>, groupModules: Iterable<string>): string[] {
  const ceiling = new Set(orgModules);
  return Array.from(new Set(groupModules)).filter((code) => ceiling.has(code)).sort();
}

export async function listAssignableGroups(
  db: PersonOnboardingDb,
  organisationId: string,
): Promise<OnboardingGroupOption[]> {
  const [{ data: groups }, { data: rights }, { data: orgModules }, { data: organisation }] = await Promise.all([
    db.from("access_groups").select("id, key, name, is_system, sort_order").order("sort_order"),
    db.from("access_group_rights").select("group_id, key").eq("right_type", "module").eq("resource", "portal"),
    db.from("organization_modules").select("module_code").eq("organization_id", organisationId).eq("enabled", true),
    db.from("organisations")
      .select("is_customer, is_trader, is_manufacturer, is_supplier, is_producer")
      .eq("id", organisationId)
      .maybeSingle(),
  ]);
  const recommended = new Set(recommendedGroupKeys({
    isCustomer: organisation?.is_customer,
    isTrader: organisation?.is_trader,
    isManufacturer: organisation?.is_manufacturer,
    isSupplier: organisation?.is_supplier,
    isProducer: organisation?.is_producer,
  }));
  const ceiling = new Set(((orgModules ?? []) as Array<{ module_code: string }>).map((r) => r.module_code));
  const modulesByGroup = new Map<string, string[]>();
  for (const row of (rights ?? []) as Array<{ group_id: string; key: string }>) {
    const list = modulesByGroup.get(row.group_id) ?? [];
    list.push(row.key);
    modulesByGroup.set(row.group_id, list);
  }
  return ((groups ?? []) as Array<{ id: string; key: string; name: string; is_system: boolean }>).map((g) => {
    const granted = Array.from(new Set(modulesByGroup.get(g.id) ?? [])).sort();
    const effectiveModules = effectiveModuleIntersection(ceiling, granted);
    const unavailableModules = granted.filter((code) => !ceiling.has(code));
    return {
      id: g.id,
      key: g.key,
      name: g.name,
      isSystem: g.is_system === true,
      effectiveModules,
      unavailableModules,
      disabled: granted.length > 0 && effectiveModules.length === 0,
      recommended: recommended.has(g.key),
    };
  });
}

export async function listPeopleWithMemberships(db: PersonOnboardingDb): Promise<OnboardingPerson[]> {
  const [usersRes, membershipsRes, orgsRes, assignmentsRes, groupsRes] = await Promise.all([
    db.from("portal_users").select("id, email, name, phone, role, organisation_id, auth_user_id, is_active, status, last_login_at, invited_at, invited_by, created_at, updated_at").order("name"),
    db.from("organization_memberships").select("user_id, organization_id, is_active, is_primary, created_at").order("created_at"),
    db.from("organisations").select("id, name, code, is_customer, is_trader, is_manufacturer, is_supplier, is_producer"),
    db.from("user_access_groups").select("user_id, organization_id, group_id"),
    db.from("access_groups").select("id, name"),
  ]);
  if (usersRes.error) throw new Error("PEOPLE_FETCH_FAILED");

  type UserRow = { id: string; email: string; name: string; phone: string | null; role: "admin" | "user"; organisation_id: string | null; auth_user_id: string | null; is_active: boolean; status: "created" | "invited" | "active"; last_login_at: string | null; invited_at: string | null; invited_by: string | null; created_at: string; updated_at: string };
  type MembershipRow = { user_id: string; organization_id: string; is_active: boolean; is_primary: boolean };
  type OrgRow = { id: string; name: string; code: string; is_customer: boolean; is_trader: boolean; is_manufacturer: boolean; is_supplier: boolean; is_producer: boolean };
  type AssignmentRow = { user_id: string; organization_id: string; group_id: string };

  const orgs = new Map<string, OrgRow>(((orgsRes.data ?? []) as OrgRow[]).map((o) => [o.id, o]));
  const groupNames = new Map<string, string>(((groupsRes.data ?? []) as Array<{ id: string; name: string }>).map((g) => [g.id, g.name]));
  const membershipsByUser = new Map<string, MembershipRow[]>();
  for (const m of (membershipsRes.data ?? []) as MembershipRow[]) {
    const list = membershipsByUser.get(m.user_id) ?? [];
    list.push(m);
    membershipsByUser.set(m.user_id, list);
  }
  const assignments = new Map<string, Array<{ groupId: string; groupName: string }>>();
  for (const a of (assignmentsRes.data ?? []) as AssignmentRow[]) {
    const key = `${a.user_id}:${a.organization_id}`;
    const list = assignments.get(key) ?? [];
    list.push({ groupId: a.group_id, groupName: groupNames.get(a.group_id) ?? "Unknown" });
    assignments.set(key, list);
  }

  return Promise.all(((usersRes.data ?? []) as UserRow[]).map(async (u) => {
    const rows = [...(membershipsByUser.get(u.id) ?? [])];
    // Compatibility for a pre-migration legacy row. New writes always create a
    // real membership and the migration backfills these rows.
    if (u.organisation_id && !rows.some((m) => m.organization_id === u.organisation_id)) {
      rows.unshift({ user_id: u.id, organization_id: u.organisation_id, is_active: true, is_primary: true });
    }
    const activePrimary = rows.find((m) => m.is_active && m.is_primary)?.organization_id ?? null;
    const memberships = await Promise.all(rows.map(async (m): Promise<OnboardingMembership | null> => {
      const org = orgs.get(m.organization_id);
      if (!org) return null;
      const effective = m.is_active ? Array.from(await getUserEnabledModules(u.id, m.organization_id)).sort() : [];
      return {
        orgId: org.id,
        orgName: org.name,
        orgCode: org.code,
        isActive: m.is_active === true,
        isPrimary: m.is_active === true && m.is_primary === true,
        personas: derivePersonas({
          isCustomer: org.is_customer,
          isTrader: org.is_trader,
          isManufacturer: org.is_manufacturer,
          isSupplier: org.is_supplier,
          isProducer: org.is_producer,
        }),
        groups: m.is_active ? assignments.get(`${u.id}:${org.id}`) ?? [] : [],
        effectiveModules: effective,
      };
    }));
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone ?? null,
      role: u.role,
      isActive: u.is_active === true,
      status: u.status,
      lastLoginAt: u.last_login_at,
      authUserId: u.auth_user_id ?? null,
      invitedAt: u.invited_at ?? null,
      invitedBy: u.invited_by ?? null,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
      primaryOrgId: activePrimary,
      memberships: memberships.filter((m): m is OnboardingMembership => m !== null),
    };
  }));
}

function rpcErrorCode(error: { message?: string } | null): string {
  const message = error?.message ?? "";
  if (message.includes("PRIMARY_OR_ONLY_MEMBERSHIP")) return "PRIMARY_OR_ONLY_MEMBERSHIP";
  if (message.includes("ACCESS_ABOVE_ORG_CEILING")) return "ACCESS_ABOVE_ORG_CEILING";
  if (message.includes("ALREADY_MEMBER")) return "ALREADY_MEMBER";
  if (message.includes("SINGLE_COMPANY_MEMBERSHIP")) return "SINGLE_COMPANY_MEMBERSHIP";
  if (message.includes("duplicate key")) return "DUPLICATE_EMAIL";
  return "ONBOARDING_DENIED";
}

export async function createPersonWithPrimaryMembership(
  db: PersonOnboardingDb,
  input: { email: string; name: string; organisationId: string; invitedBy: string | null },
): Promise<{ ok: true; userId: string } | { ok: false; code: string }> {
  const { data, error } = await db.rpc("admin_create_portal_user", {
    p_email: input.email,
    p_name: input.name,
    p_organization_id: input.organisationId,
    p_invited_by: input.invitedBy,
  });
  return error ? { ok: false, code: rpcErrorCode(error) } : { ok: true, userId: String(data) };
}

export async function attachPersonMembership(
  db: PersonOnboardingDb,
  input: { userId: string; organisationId: string; makePrimary: boolean; invitedBy: string | null },
): Promise<{ ok: true } | { ok: false; code: string }> {
  const { error } = await db.rpc("admin_upsert_user_membership", {
    p_user_id: input.userId,
    p_organization_id: input.organisationId,
    p_make_primary: input.makePrimary,
    p_invited_by: input.invitedBy,
  });
  return error ? { ok: false, code: rpcErrorCode(error) } : { ok: true };
}

export async function setPrimaryMembership(
  db: PersonOnboardingDb,
  userId: string,
  organisationId: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const { error } = await db.rpc("admin_set_primary_membership", {
    p_user_id: userId,
    p_organization_id: organisationId,
  });
  return error ? { ok: false, code: rpcErrorCode(error) } : { ok: true };
}

export async function setMembershipActive(
  db: PersonOnboardingDb,
  userId: string,
  organisationId: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const { error } = await db.rpc("admin_set_membership_active", {
    p_user_id: userId,
    p_organization_id: organisationId,
    p_is_active: isActive,
  });
  return error ? { ok: false, code: rpcErrorCode(error) } : { ok: true };
}

export async function setMembershipGroups(
  db: PersonOnboardingDb,
  userId: string,
  organisationId: string,
  groupIds: string[],
): Promise<{ ok: true; count: number } | { ok: false; code: string }> {
  const { data, error } = await db.rpc("admin_set_membership_groups", {
    p_user_id: userId,
    p_organization_id: organisationId,
    p_group_ids: Array.from(new Set(groupIds)),
  });
  return error ? { ok: false, code: rpcErrorCode(error) } : { ok: true, count: Number(data ?? 0) };
}

export async function setPersonAccountActive(
  db: PersonOnboardingDb,
  userId: string,
  isActive: boolean,
): Promise<{ ok: true; user: Record<string, unknown> } | { ok: false }> {
  const { data, error } = await db.from("portal_users").update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id, email, name, role, organisation_id, auth_user_id, is_active, status, invited_at, invited_by, last_login_at, created_at, updated_at")
    .maybeSingle();
  return error || !data ? { ok: false } : { ok: true, user: data as Record<string, unknown> };
}
