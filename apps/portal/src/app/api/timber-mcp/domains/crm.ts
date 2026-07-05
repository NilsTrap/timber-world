/**
 * Timber MCP · CRM domain — organisations + the access-group / user management
 * surface (E7 read + J3 write).
 *
 * Exports (aggregated by ../tools.ts + ../route.ts): `crmTools` (ToolDef[]),
 * `crmCaps` (USER_WRITE_CAPABILITY entries — all "admin"), and `crmHandlers`
 * (dispatch handlers = the exact former route.ts switch-case bodies, unchanged).
 */
import { listOrgs, getOrg, createOrg, updateOrg } from "@/features/organisations/services/orgService";
import { listAccessGroups, getAccessGroupDetail, getUserAccessGroups, listPortalUsers } from "@/features/access/services/groupsRead";
import { createAccessGroup, updateAccessGroup, deleteAccessGroup, saveGroupRights, updateUserAccessGroups } from "@/features/access/services/groupsWrite";
import type { GroupRightsInput } from "@/features/access/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkContactAccessForOrgByProfile } from "@/features/counterparties/access";
import { resolveAddPersonScopeByProfile, resolveSystemGroupIdByKey, type AddPersonScope } from "@/features/organisations/actions/_addPersonScope";
import type { ToolDef, ToolHandler, UserWriteCapability, AuthCtx } from "../types";
import { toolOk, toolErr, UUID_RE } from "../types";

export const crmTools: ToolDef[] = [
  {
    name: "timber_list_orgs",
    description: "List Timber organisations (customers/manufacturers/producers) with their company card + CRM link. Optional text query matches name or code.",
    readOnly: true,
    lifecycle: "org",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Filter by name or code (substring)." },
        limit: { type: "integer", description: "Max rows (default 100, cap 200)." },
      },
    },
  },
  {
    name: "timber_get_org",
    description: "Get one Timber organisation by id — full company card (legal address, VAT/registration, country, contact, bank) + role flags + crm_org_id.",
    readOnly: true,
    lifecycle: "org",
    inputSchema: {
      type: "object",
      properties: { org_id: { type: "string", description: "Organisation UUID." } },
      required: ["org_id"],
    },
  },
  {
    name: "timber_create_org",
    description: "Create a Timber organisation (3-char code + name + optional company card + role flags). Set is_customer/is_manufacturer/is_producer/is_supplier/is_trader to seed the org's supply-chain roles at creation (default false; can be changed later via timber_update_org). Mirrors to the Oscar CRM when configured and returns the stored org incl. crm_org_id.",
    readOnly: false,
    lifecycle: "org",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "3-char org code (letter + 2 letters/digits, e.g. SOM)." },
        name: { type: "string", description: "Organisation name." },
        legal_address: { type: "string" },
        vat_number: { type: "string" },
        registration_number: { type: "string" },
        country: { type: "string", description: "ISO-3166 alpha-2 (e.g. LV, GB)." },
        phone: { type: "string" },
        email: { type: "string" },
        website: { type: "string" },
        bank_name: { type: "string" },
        bank_account_number: { type: "string" },
        bank_swift_code: { type: "string" },
        is_customer: { type: "boolean", description: "Role flag: end-buyer (Customer)." },
        is_manufacturer: { type: "boolean", description: "Role flag: orchestrator/Manufacturer." },
        is_producer: { type: "boolean", description: "Role flag: finishing Producer." },
        is_supplier: { type: "boolean", description: "Role flag: appears in the Suppliers book (sourcing supplier)." },
        is_trader: { type: "boolean", description: "Role flag: trader org (Traders book — admin-only surface)." },
      },
      required: ["code", "name"],
    },
  },
  {
    name: "timber_update_org",
    description:
      "Update an existing Timber organisation (partial — only the provided fields change). Edits the company card (name, legal address, VAT/registration, country, contact, bank details, default document signee) AND the role flags (is_customer, is_manufacturer, is_producer, is_supplier, is_trader) + is_active. Flip is_supplier to add/remove the org from the Suppliers book (so it can be picked as a sourcing supplier); flip is_trader to add/remove it from the admin-only Traders book. The 3-char CODE is IMMUTABLE (deal codes embed it) and cannot be changed here. Mirrors card + customer/manufacturer/producer changes to the Oscar CRM when configured (is_supplier, is_trader and signee stay Timber-local).",
    readOnly: false,
    lifecycle: "org",
    inputSchema: {
      type: "object",
      properties: {
        org_id: { type: "string", description: "Organisation UUID to update." },
        name: { type: "string" },
        legal_address: { type: "string" },
        vat_number: { type: "string" },
        registration_number: { type: "string" },
        country: { type: "string", description: "ISO-3166 alpha-2 (e.g. LV, GB)." },
        phone: { type: "string" },
        email: { type: "string" },
        website: { type: "string" },
        bank_name: { type: "string" },
        bank_account_number: { type: "string" },
        bank_swift_code: { type: "string" },
        default_signee_name: { type: "string", description: "Default signatory name for this org's documents (G3)." },
        default_signee_role: { type: "string", description: "Default signatory role/title (G3)." },
        is_customer: { type: "boolean" },
        is_manufacturer: { type: "boolean" },
        is_producer: { type: "boolean" },
        is_supplier: { type: "boolean", description: "Whether the org appears in the Suppliers book (can be picked as a sourcing supplier)." },
        is_trader: { type: "boolean", description: "Whether the org is in the admin-only Traders book (trader-org contacts/people are admin-only)." },
        is_active: { type: "boolean" },
      },
      required: ["org_id"],
    },
  },
  // ── E7: user / access-group management (read surface) ───────────────────────
  {
    name: "timber_list_access_groups",
    description:
      "List the access groups (the thing that grants portal access + deal-field visibility since E4), each with its key, name, system flag and member count. Read-only — group rights are edited in the portal admin UI.",
    readOnly: true,
    lifecycle: "access",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "timber_get_access_group",
    description:
      "Get one access group's full rights: enabled modules, deal-row visibility, deal-field domains (visible/editable), field overrides, deal scope (mine/company/all) and action grants.",
    readOnly: true,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: { group_id: { type: "string", description: "Access group UUID (from timber_list_access_groups)." } },
      required: ["group_id"],
    },
  },
  {
    name: "timber_list_user_access_groups",
    description:
      "List every access group and whether it is assigned to a given user in a given organisation. Use to inspect a user's effective group membership for one org.",
    readOnly: true,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Portal user UUID (from timber_list_users)." },
        organisation_id: { type: "string", description: "Organisation UUID the assignment is scoped to." },
      },
      required: ["user_id", "organisation_id"],
    },
  },
  {
    name: "timber_list_users",
    description:
      "List portal users (id, email, name, role) — the directory for resolving a user before reading their group assignments. Optional substring query on name/email and an optional org filter (active members of that organisation).",
    readOnly: true,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Filter by name or email (substring)." },
        org_id: { type: "string", description: "Restrict to active members of this organisation UUID." },
        limit: { type: "integer", description: "Max rows (default 100, cap 200)." },
      },
    },
  },
  // ── J3: access-group / user-group WRITE surface (full-token only) ────────────
  {
    name: "timber_set_user_groups",
    description:
      "Replace a user's access-group membership in ONE organisation (full replacement — the provided group_ids become the user's complete set of groups in that org; pass [] to remove all). A user's effective rights are the union of their groups' rights, capped by the org's module ceiling. FULL-token only. Note: the portal's cached effective-permissions for that user refresh on their next revalidation, not instantly.",
    readOnly: false,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Portal user UUID (from timber_list_users)." },
        organisation_id: { type: "string", description: "Organisation UUID the membership is scoped to." },
        group_ids: { type: "array", items: { type: "string" }, description: "The user's COMPLETE set of access-group UUIDs in this org (full replace; [] clears)." },
      },
      required: ["user_id", "organisation_id", "group_ids"],
    },
  },
  {
    name: "timber_upsert_access_group",
    description:
      "Create or update an access group. Omit group_id to CREATE (name required; key is slugified from the name); pass group_id to UPDATE its name/description. Optionally set the rights matrix in the same call — `rights` is a FULL REPLACE of the group's rights (omitted sub-fields are cleared), so send the complete matrix. Returns the group id. FULL-token only.",
    readOnly: false,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "Access group UUID to update. Omit to create a new group." },
        name: { type: "string", description: "Group name (required on create)." },
        description: { type: "string", description: "Group description." },
        rights: {
          type: "object",
          description: "OPTIONAL full-replace rights matrix. Omit to leave rights unchanged.",
          properties: {
            modules: { type: "array", items: { type: "string" }, description: "Enabled portal module codes (e.g. 'orders.view', 'counterparties.suppliers')." },
            deal_visibility: { type: "array", items: { type: "string" }, description: "Deal-row visibility keys (e.g. 'side.buy', 'side.sell')." },
            field_domains: { type: "object", description: "Per-domain field grants: { <domain>: { visible: boolean, editable: boolean } }. Domains: pricing, deal_terms, financial_docs, logistics, customer_identity, supplier_identity, chain." },
            field_overrides: { type: "object", description: "Per-field overrides: { <field_key>: { visible: boolean, editable: boolean } }." },
            scope: { type: "string", enum: ["mine", "company", "all"], description: "Deal scope (default 'mine')." },
            actions: { type: "array", items: { type: "string" }, description: "Action grants as '<resource>:<key>' (e.g. 'counterparty:suppliers')." },
          },
        },
      },
    },
  },
  {
    name: "timber_delete_access_group",
    description:
      "Delete an access group. System groups cannot be deleted. If the group has member assignments, the call is refused unless force=true (its members lose the group's rights on delete) — mirroring the portal's destructive-delete confirmation. FULL-token only.",
    readOnly: false,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "Access group UUID to delete." },
        force: { type: "boolean", description: "Set true to confirm deleting a group that still has members." },
      },
      required: ["group_id"],
    },
  },
  // ── T5 · CRM org contacts (org_contacts) — book-scoped (K1) ──────────────────
  {
    name: "timber_list_org_contacts",
    description:
      "List the named contacts on a counterparty organisation (primary-first, then newest). Book-scoped: a per-user key sees an org's contacts only if it has access to a book the org belongs to (clients=is_customer, suppliers=is_supplier/is_producer); trader orgs + platform settings are admin-only. Active-only unless include_inactive.",
    readOnly: true,
    lifecycle: "org",
    inputSchema: {
      type: "object",
      properties: {
        org_id: { type: "string", description: "Organisation UUID." },
        include_inactive: { type: "boolean", description: "Also return archived (is_active=false) contacts." },
      },
      required: ["org_id"],
    },
  },
  {
    name: "timber_upsert_org_contact",
    description:
      "Create or update a contact on a counterparty organisation. Omit contact_id to CREATE; pass contact_id to UPDATE (must belong to org_id). set_primary=true also promotes this contact to the org's primary (clears any other primary first). Book-scoped by the org's address book (admin bypasses).",
    readOnly: false,
    lifecycle: "org",
    inputSchema: {
      type: "object",
      properties: {
        org_id: { type: "string", description: "Organisation UUID the contact belongs to." },
        contact_id: { type: "string", description: "Contact UUID to update. Omit to create a new contact." },
        name: { type: "string", description: "Contact name (required)." },
        role_title: { type: "string", description: "Role / job title." },
        email: { type: "string" },
        phone: { type: "string" },
        notes: { type: "string" },
        is_active: { type: "boolean", description: "Archive/unarchive (default active on create)." },
        set_primary: { type: "boolean", description: "Promote this contact to the org's primary contact." },
      },
      required: ["org_id", "name"],
    },
  },
  {
    name: "timber_delete_org_contact",
    description:
      "Hard-delete a contact from its counterparty organisation. Book-scoped by the contact's org (admin bypasses).",
    readOnly: false,
    lifecycle: "org",
    inputSchema: {
      type: "object",
      properties: { contact_id: { type: "string", description: "Contact UUID to delete." } },
      required: ["contact_id"],
    },
  },
  // ── T5 · People directory + org membership (K2/K3/Q2/Q4) ─────────────────────
  {
    name: "timber_get_people_directory",
    description:
      "The person-centric People directory: every portal user once, with all their organisations (primary flagged) and access groups per org. ADMIN-ONLY (this is the only cross-org people enumeration).",
    readOnly: true,
    lifecycle: "access",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "timber_get_person",
    description:
      "Get one person by portal-user id — profile (name/email/phone/role/status/active), their organisation memberships (primary flagged) and access groups per org. ADMIN-ONLY.",
    readOnly: true,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: { user_id: { type: "string", description: "Portal user UUID." } },
      required: ["user_id"],
    },
  },
  {
    name: "timber_create_person",
    description:
      "Create a new person (portal user) under an organisation (role=user, status=created, no credentials yet). Book-scoped Q2: admins may create for ANY org with an optional group_ids picker; a per-user salesperson/purchasing key may create ONLY for an org in its clients/suppliers book and the access group is FORCED server-side (client / producer) — any group_ids are ignored. Trader orgs are admin-only. No credentials are sent by this tool.",
    readOnly: false,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        org_id: { type: "string", description: "Organisation UUID to create the person under." },
        name: { type: "string", description: "Person name." },
        email: { type: "string", description: "Email (globally unique across portal users)." },
        group_ids: { type: "array", items: { type: "string" }, description: "Access-group UUIDs (admins only; ignored for a scoped non-admin key — the forced book group wins)." },
      },
      required: ["org_id", "name", "email"],
    },
  },
  {
    name: "timber_add_person_to_org",
    description:
      "Add an EXISTING person to an organisation (reactivates an inactive membership if present) and assigns their access groups inline. Same Q2 book scope as create_person (admin=any org + group picker; scoped key=own book with a forced group; trader orgs admin-only).",
    readOnly: false,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Existing portal user UUID." },
        org_id: { type: "string", description: "Organisation UUID to add them to." },
        group_ids: { type: "array", items: { type: "string" }, description: "Access-group UUIDs (admins only; forced for a scoped key)." },
      },
      required: ["user_id", "org_id"],
    },
  },
  {
    name: "timber_remove_person_from_org",
    description:
      "Remove a person from an organisation: deactivates the membership and strips their access groups there. REFUSES to remove the person's only or PRIMARY organisation (set a different primary first). Same Q2 book scope as add/create.",
    readOnly: false,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Portal user UUID." },
        org_id: { type: "string", description: "Organisation UUID to remove them from." },
      },
      required: ["user_id", "org_id"],
    },
  },
  {
    name: "timber_update_person",
    description:
      "Update a person's PROFILE fields — name (required), and optionally email (globally unique) and phone. ADMIN-ONLY. Does NOT touch credentials, login email, role, active status or group membership (use the dedicated tools).",
    readOnly: false,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Portal user UUID." },
        name: { type: "string", description: "Person name (required)." },
        email: { type: "string", description: "New email (globally unique). Updates portal_users.email only, not the auth login." },
        phone: { type: "string", description: "Phone (empty string clears it)." },
      },
      required: ["user_id", "name"],
    },
  },
  {
    name: "timber_toggle_person_active",
    description:
      "Activate or deactivate a person (is_active — a person-level flag; deactivated users cannot log in). ADMIN-ONLY.",
    readOnly: false,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Portal user UUID." },
        is_active: { type: "boolean", description: "true = activate, false = deactivate." },
      },
      required: ["user_id", "is_active"],
    },
  },
  {
    name: "timber_resend_person_invite",
    description:
      "Resend the invite email to a person in 'invited' status who already has an auth identity (rotates their pending auth user and re-sends a magic link to set their password). No secret is transmitted through this tool. ADMIN-ONLY. Reset/set-password and send-credentials are intentionally NOT exposed over MCP.",
    readOnly: false,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: { user_id: { type: "string", description: "Portal user UUID (status must be 'invited')." } },
      required: ["user_id"],
    },
  },
  // ── T5 · Platform settings (E4 key/value store) — admin-only ─────────────────
  {
    name: "timber_get_platform_setting",
    description:
      "Read one platform setting (platform_settings key/value store, e.g. purchasing_may_reuse_clients). ADMIN-ONLY. Returns { key, value } (value is null if unset).",
    readOnly: true,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: { key: { type: "string", description: "Setting key." } },
      required: ["key"],
    },
  },
  {
    name: "timber_set_platform_setting",
    description:
      "Set (upsert) one platform setting. value is stored as JSON. ADMIN-ONLY.",
    readOnly: false,
    lifecycle: "access",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Setting key." },
        value: { description: "Setting value (any JSON — boolean/string/number/object)." },
      },
      required: ["key", "value"],
    },
  },
];

/** T2/T5 · WRITE capabilities for this domain (deny-by-default: every write tool
 *  MUST appear here). Org card + access-group + people-admin + platform-settings
 *  writes are "admin" — a per-user key writes them only if its owner is a REAL
 *  platform admin (route.authorizeUserWrite), else FORBIDDEN.
 *
 *  T5 book-scoped person/contact WRITES (upsert/delete contact, create/add/remove
 *  person) are capped "counterparty" — a COARSE gate (the owner holds the clients OR
 *  suppliers book; wired in route.ts userHasCapability + types.ts + tools-coverage).
 *  The FINE Q2 per-org book check runs in each handler (contactGate /
 *  resolveAddPersonScopeByProfile against the TARGET org): a salesperson key
 *  (counterparty:clients) is REFUSED on supplier/trader orgs, purchasing on clients,
 *  trader-org people are admin-only — the coarse cap alone never authorizes. READS
 *  (list_org_contacts / people) apply the same fine book scope to per-user keys. */
export const crmCaps: Record<string, UserWriteCapability> = {
  timber_create_org: "admin",
  timber_update_org: "admin",
  timber_set_user_groups: "admin",
  timber_upsert_access_group: "admin",
  timber_delete_access_group: "admin",
  // T5 org contacts (book-scoped: coarse `counterparty` route gate + the FINE per-org
  // book check runs in the handler — contactGate/checkContactAccessForOrgByProfile).
  timber_upsert_org_contact: "counterparty",
  timber_delete_org_contact: "counterparty",
  // T5 people (create/add/remove are book-scoped Q2 → coarse `counterparty` + the fine
  // resolveAddPersonScopeByProfile check in the handler; update/toggle/invite are admin)
  timber_create_person: "counterparty",
  timber_add_person_to_org: "counterparty",
  timber_remove_person_from_org: "counterparty",
  timber_update_person: "admin",
  timber_toggle_person_active: "admin",
  timber_resend_person_invite: "admin",
  // T5 platform settings (admin)
  timber_set_platform_setting: "admin",
};

// ── T5 helpers ────────────────────────────────────────────────────────────────

const CONTACT_COLUMNS = "id, organisation_id, name, role_title, email, phone, notes, is_primary, is_active";

/** Trim → null on empty. */
function nn(v: unknown): string | null {
  const t = (typeof v === "string" ? v : "").trim();
  return t === "" ? null : t;
}

/** ADMIN gate for admin-only tools (people directory/get/update/toggle/invite +
 *  platform settings). Returns a FORBIDDEN message, or null when allowed. The env
 *  owner token's actor is a real platform admin; a non-admin per-user key is refused
 *  BEFORE any admin-client read. (WRITE tools are ALSO gated at the route by the
 *  "admin" capability; this is the READ-path + defence-in-depth check.) */
function requireAdmin(ctx: AuthCtx): string | null {
  return ctx.actor.isPlatformAdmin ? null : "FORBIDDEN: this action is restricted to a platform administrator.";
}

/** Book gate for the MCP org-contact tools — the profile-based twin of
 *  orgContacts.requireContactAccessForOrg, fed the request AuthCtx. Env owner
 *  (isPlatformAdmin) passes for any org; a per-user key must have access to a book
 *  the org belongs to (trader orgs admin-only). */
async function contactGate(ctx: AuthCtx, orgId: string) {
  return checkContactAccessForOrgByProfile(ctx.actor.portalUserId, ctx.actor.isPlatformAdmin, ctx.orgId, orgId);
}

/** Promote a contact to primary: clear the org's current primary, then set this one. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setPrimaryContactInline(admin: any, orgId: string, id: string) {
  await admin.from("org_contacts").update({ is_primary: false }).eq("organisation_id", orgId).eq("is_primary", true).neq("id", id);
  await admin.from("org_contacts").update({ is_primary: true, updated_at: new Date().toISOString() }).eq("id", id);
}

/**
 * Q2 access-group assignment for a just-created/added person — the cache-free twin
 * of _addPersonScope.applyAddPersonGroups (the MCP route can't bust the portal's
 * per-member next/cache tags, exactly like the existing timber_set_user_groups
 * write; affected users' cached perms refresh on their next revalidation). Scoped
 * caller ⇒ EXACTLY the forced book group (client-supplied ids ignored); admin ⇒ the
 * requested ids, validated against real groups.
 */
async function applyPersonGroupsNoCache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  scope: Extract<AddPersonScope, { ok: true }>,
  userId: string,
  orgId: string,
  requestedGroupIds: string[] | undefined,
): Promise<{ success: true } | { success: false; error: string }> {
  let groupIds: string[];
  if (scope.mode === "scoped") {
    const forcedId = await resolveSystemGroupIdByKey(admin, scope.forcedGroupKey);
    if (!forcedId) return { success: false, error: `The '${scope.forcedGroupKey}' access group is missing` };
    groupIds = [forcedId]; // forced — requestedGroupIds deliberately ignored
  } else {
    const requested = Array.from(new Set(requestedGroupIds ?? []));
    if (requested.length === 0) {
      groupIds = [];
    } else {
      const { data: valid } = await admin.from("access_groups").select("id").in("id", requested);
      const validIds = new Set(((valid ?? []) as Array<{ id: string }>).map((r) => r.id));
      groupIds = requested.filter((id) => validIds.has(id));
    }
  }
  const res = await updateUserAccessGroups(admin, userId, orgId, groupIds);
  if (!res.success) return { success: false, error: res.error };
  return { success: true };
}

interface DirPersonOrg { id: string; name: string; code: string; isPrimary: boolean }
interface DirPersonGroup { orgId: string; groupId: string; groupName: string }
interface DirPerson {
  id: string; email: string; name: string; phone: string | null;
  role: "admin" | "user"; isActive: boolean; status: string; lastLoginAt: string | null;
  authUserId: string | null; primaryOrgId: string | null; orgs: DirPersonOrg[]; groups: DirPersonGroup[];
}

/** Person-centric People directory (admin surface), batched (one query per
 *  dimension) then mapped in memory — the (db,…) twin of getPeopleDirectory. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildPeopleDirectory(admin: any): Promise<DirPerson[]> {
  const [usersRes, memsRes, orgsRes, uagRes] = await Promise.all([
    admin.from("portal_users").select("id, email, name, phone, role, organisation_id, auth_user_id, is_active, status, last_login_at").order("name", { ascending: true }),
    admin.from("organization_memberships").select("user_id, organization_id, is_primary").eq("is_active", true),
    admin.from("organisations").select("id, name, code"),
    admin.from("user_access_groups").select("user_id, group_id, organization_id"),
  ]);
  if (usersRes.error) throw new Error("Failed to load people");

  const users = (usersRes.data ?? []) as Array<{ id: string; email: string; name: string; phone: string | null; role: "admin" | "user"; organisation_id: string | null; auth_user_id: string | null; is_active: boolean; status: string; last_login_at: string | null }>;
  const mems = (memsRes.data ?? []) as Array<{ user_id: string; organization_id: string; is_primary: boolean }>;
  const orgs = (orgsRes.data ?? []) as Array<{ id: string; name: string; code: string }>;
  const uag = (uagRes.data ?? []) as Array<{ user_id: string; group_id: string; organization_id: string }>;

  const groupIds = Array.from(new Set(uag.map((r) => r.group_id)));
  const groupNames = new Map<string, string>();
  if (groupIds.length) {
    const { data: groups } = await admin.from("access_groups").select("id, name").in("id", groupIds);
    for (const g of (groups ?? []) as Array<{ id: string; name: string }>) groupNames.set(g.id, g.name);
  }

  const orgMap = new Map<string, { name: string; code: string }>();
  for (const o of orgs) orgMap.set(o.id, { name: o.name, code: o.code });

  const memsByUser = new Map<string, Array<{ orgId: string; isPrimary: boolean }>>();
  for (const m of mems) {
    const list = memsByUser.get(m.user_id) ?? [];
    list.push({ orgId: m.organization_id, isPrimary: m.is_primary === true });
    memsByUser.set(m.user_id, list);
  }
  const groupsByUser = new Map<string, DirPersonGroup[]>();
  for (const r of uag) {
    const list = groupsByUser.get(r.user_id) ?? [];
    list.push({ orgId: r.organization_id, groupId: r.group_id, groupName: groupNames.get(r.group_id) ?? "?" });
    groupsByUser.set(r.user_id, list);
  }

  return users.map((u) => {
    const legacy = u.organisation_id && orgMap.has(u.organisation_id) ? u.organisation_id : null;
    const orgRefs: DirPersonOrg[] = [];
    const seen = new Set<string>();
    if (legacy) { orgRefs.push({ id: legacy, ...orgMap.get(legacy)!, isPrimary: false }); seen.add(legacy); }
    for (const m of memsByUser.get(u.id) ?? []) {
      if (seen.has(m.orgId) || !orgMap.has(m.orgId)) continue;
      orgRefs.push({ id: m.orgId, ...orgMap.get(m.orgId)!, isPrimary: false });
      seen.add(m.orgId);
    }
    let primaryOrgId: string | null = legacy;
    if (!primaryOrgId) {
      const primMem = (memsByUser.get(u.id) ?? []).find((m) => m.isPrimary && orgMap.has(m.orgId));
      primaryOrgId = primMem?.orgId ?? orgRefs[0]?.id ?? null;
    }
    for (const r of orgRefs) r.isPrimary = r.id === primaryOrgId;
    return {
      id: u.id, email: u.email, name: u.name, phone: u.phone ?? null, role: u.role,
      isActive: u.is_active, status: u.status, lastLoginAt: u.last_login_at, authUserId: u.auth_user_id ?? null,
      primaryOrgId, orgs: orgRefs, groups: groupsByUser.get(u.id) ?? [],
    };
  });
}

/**
 * CRM dispatch handlers — each is the exact body of the former route.ts switch case
 * for that tool (arg validation + service call), unchanged. T5 adds the org-contact,
 * people and platform-setting handlers (book-scoped / admin per the NOTE on crmCaps).
 */
export const crmHandlers: Record<string, ToolHandler> = {
  timber_list_orgs: async (args, ctx) => {
    const { db } = ctx;
    const res = await listOrgs(db, { query: args?.query, limit: args?.limit });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_get_org: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.org_id) return toolErr("org_id is required");
    const res = await getOrg(db, args.org_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_create_org: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.code || !args?.name) return toolErr("code and name are required");
    const res = await createOrg(db, {
      code: args.code,
      name: args.name,
      legalAddress: args?.legal_address,
      vatNumber: args?.vat_number,
      registrationNumber: args?.registration_number,
      country: args?.country,
      phone: args?.phone,
      email: args?.email,
      website: args?.website,
      bankName: args?.bank_name,
      bankAccountNumber: args?.bank_account_number,
      bankSwiftCode: args?.bank_swift_code,
    });
    if (!res.success) return toolErr(res.error);
    // T3 · seed the role flags at create. createOrg's service writes only the
    // company card; the role flags reuse the updateOrg twin (same columns the
    // Roles toggle writes) so create can set is_customer/manufacturer/producer/
    // supplier/trader in one call. Only applied when at least one flag is provided.
    const flags: Record<string, boolean> = {};
    if (typeof args?.is_customer === "boolean") flags.isCustomer = args.is_customer;
    if (typeof args?.is_manufacturer === "boolean") flags.isManufacturer = args.is_manufacturer;
    if (typeof args?.is_producer === "boolean") flags.isProducer = args.is_producer;
    if (typeof args?.is_supplier === "boolean") flags.isSupplier = args.is_supplier;
    if (typeof args?.is_trader === "boolean") flags.isTrader = args.is_trader;
    if (Object.keys(flags).length > 0) {
      const upd = await updateOrg(db, res.data.id, flags);
      return upd.success ? toolOk(upd.data) : toolErr(upd.error);
    }
    return toolOk(res.data);
  },
  timber_update_org: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.org_id) return toolErr("org_id is required");
    const res = await updateOrg(db, args.org_id, {
      // Pass code through so an explicit change attempt is REJECTED (immutable),
      // rather than silently ignored — the tool schema doesn't advertise it.
      code: args?.code,
      name: args?.name,
      legalAddress: args?.legal_address,
      vatNumber: args?.vat_number,
      registrationNumber: args?.registration_number,
      country: args?.country,
      phone: args?.phone,
      email: args?.email,
      website: args?.website,
      bankName: args?.bank_name,
      bankAccountNumber: args?.bank_account_number,
      bankSwiftCode: args?.bank_swift_code,
      defaultSigneeName: args?.default_signee_name,
      defaultSigneeRole: args?.default_signee_role,
      isCustomer: args?.is_customer,
      isManufacturer: args?.is_manufacturer,
      isProducer: args?.is_producer,
      isSupplier: args?.is_supplier,
      isTrader: args?.is_trader,
      isActive: args?.is_active,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  // ── E7: user / access-group management (read surface) ─────────────────────
  timber_list_access_groups: async (_args, ctx) => {
    const { db } = ctx;
    const res = await listAccessGroups(db);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_get_access_group: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.group_id) return toolErr("group_id is required");
    const res = await getAccessGroupDetail(db, args.group_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_list_user_access_groups: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.user_id || !args?.organisation_id) return toolErr("user_id and organisation_id are required");
    const res = await getUserAccessGroups(db, args.user_id, args.organisation_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_list_users: async (args, ctx) => {
    const { db } = ctx;
    const res = await listPortalUsers(db, { query: args?.query, orgId: args?.org_id, limit: args?.limit });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  // ── J3: access-group / user-group WRITES (full-token only) ────────────────
  // NOTE: these mutate the DB directly and cannot bust the portal's per-member
  // next/cache tags (only a request-scoped action can) — affected users' cached
  // effective permissions refresh on their next natural revalidation.
  timber_set_user_groups: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.user_id || !args?.organisation_id || !Array.isArray(args?.group_ids)) {
      return toolErr("user_id, organisation_id and group_ids[] are required");
    }
    const res = await updateUserAccessGroups(db, args.user_id, args.organisation_id, args.group_ids);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_upsert_access_group: async (args, ctx) => {
    const { db } = ctx;
    let groupId: string | undefined = args?.group_id;
    if (groupId) {
      // Update name/description if provided.
      if (args?.name !== undefined || args?.description !== undefined) {
        const upd = await updateAccessGroup(db, groupId, { name: args?.name, description: args?.description });
        if (!upd.success) return toolErr(upd.error);
      }
    } else {
      if (!args?.name) return toolErr("name is required to create a group (or pass group_id to update)");
      const created = await createAccessGroup(db, { name: args.name, description: args?.description });
      if (!created.success) return toolErr(created.error);
      groupId = created.data.id;
    }
    // Optional FULL-REPLACE of the rights matrix.
    if (args?.rights && typeof args.rights === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = args.rights as any;
      const rights: GroupRightsInput = {
        modules: Array.isArray(r.modules) ? r.modules : [],
        dealVisibility: Array.isArray(r.deal_visibility) ? r.deal_visibility : [],
        fieldDomains: r.field_domains && typeof r.field_domains === "object" ? r.field_domains : {},
        fieldOverrides: r.field_overrides && typeof r.field_overrides === "object" ? r.field_overrides : {},
        scope: r.scope === "company" || r.scope === "all" ? r.scope : "mine",
        actions: Array.isArray(r.actions) ? r.actions : [],
      };
      const saved = await saveGroupRights(db, groupId, rights);
      if (!saved.success) return toolErr(saved.error);
    }
    return toolOk({ id: groupId });
  },
  timber_delete_access_group: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.group_id) return toolErr("group_id is required");
    // Mirror the UI's destructive warning: refuse if the group has members unless
    // force is set (the UI shows "N user assignments will be removed" + confirm).
    if (!args?.force) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (db as any)
        .from("user_access_groups")
        .select("user_id", { count: "exact", head: true })
        .eq("group_id", args.group_id);
      if ((count ?? 0) > 0) {
        return toolErr(`This group has ${count} user assignment(s); deleting removes them. Re-call with force=true to confirm.`);
      }
    }
    const res = await deleteAccessGroup(db, args.group_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },

  // ── T5 · CRM org contacts (book-scoped; reads apply the fine book wall to
  //         per-user keys, writes are admin-capped at the route — see crmCaps NOTE).
  //         Post-gate reads/writes use the service-role client, mirroring the portal's
  //         "the gate is the wall" pattern for orgContacts (RLS is bypassed after the gate).
  timber_list_org_contacts: async (args, ctx) => {
    if (!args?.org_id || !UUID_RE.test(args.org_id)) return toolErr("org_id (UUID) is required");
    const g = await contactGate(ctx, args.org_id);
    if (!g.ok) return toolErr(g.error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    let q = admin
      .from("org_contacts")
      .select(CONTACT_COLUMNS)
      .eq("organisation_id", args.org_id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });
    if (args?.include_inactive !== true) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (error) return toolErr("Failed to load contacts");
    return toolOk(data ?? []);
  },
  timber_upsert_org_contact: async (args, ctx) => {
    if (!args?.org_id || !UUID_RE.test(args.org_id)) return toolErr("org_id (UUID) is required");
    const g = await contactGate(ctx, args.org_id);
    if (!g.ok) return toolErr(g.error);
    const name = (args?.name ?? "").trim();
    if (!name) return toolErr("name is required");
    const setPrimary = args?.set_primary === true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;

    if (args?.contact_id) {
      if (!UUID_RE.test(args.contact_id)) return toolErr("contact_id must be a UUID");
      const { data: existing } = await admin.from("org_contacts").select("id, organisation_id").eq("id", args.contact_id).maybeSingle();
      if (!existing || existing.organisation_id !== args.org_id) return toolErr("Contact not found for this organisation");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = {
        name, role_title: nn(args?.role_title), email: nn(args?.email), phone: nn(args?.phone), notes: nn(args?.notes),
        updated_at: new Date().toISOString(),
      };
      if (typeof args?.is_active === "boolean") patch.is_active = args.is_active;
      const { data, error } = await admin.from("org_contacts").update(patch).eq("id", args.contact_id).select(CONTACT_COLUMNS).single();
      if (error || !data) return toolErr("Failed to update contact");
      if (setPrimary) { await setPrimaryContactInline(admin, args.org_id, args.contact_id); return toolOk({ ...data, is_primary: true }); }
      return toolOk(data);
    }

    // Create. An explicit set_primary clears the current primary first so the new row wins.
    if (setPrimary) {
      await admin.from("org_contacts").update({ is_primary: false }).eq("organisation_id", args.org_id).eq("is_primary", true);
    }
    const { data, error } = await admin
      .from("org_contacts")
      .insert({
        organisation_id: args.org_id, name,
        role_title: nn(args?.role_title), email: nn(args?.email), phone: nn(args?.phone), notes: nn(args?.notes),
        is_primary: setPrimary, is_active: args?.is_active !== false,
      })
      .select(CONTACT_COLUMNS)
      .single();
    if (error || !data) return toolErr("Failed to create contact");
    return toolOk(data);
  },
  timber_delete_org_contact: async (args, ctx) => {
    if (!args?.contact_id || !UUID_RE.test(args.contact_id)) return toolErr("contact_id (UUID) is required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: existing } = await admin.from("org_contacts").select("id, organisation_id").eq("id", args.contact_id).maybeSingle();
    if (!existing) return toolErr("Contact not found");
    const g = await contactGate(ctx, existing.organisation_id);
    if (!g.ok) return toolErr(g.error);
    const { error } = await admin.from("org_contacts").delete().eq("id", args.contact_id);
    if (error) return toolErr("Failed to delete contact");
    return toolOk({ id: args.contact_id });
  },

  // ── T5 · People (K2/K3/Q2/Q4) ──────────────────────────────────────────────
  timber_get_people_directory: async (_args, ctx) => {
    const denied = requireAdmin(ctx); if (denied) return toolErr(denied);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    try {
      return toolOk(await buildPeopleDirectory(admin));
    } catch {
      return toolErr("Failed to load people");
    }
  },
  timber_get_person: async (args, ctx) => {
    const denied = requireAdmin(ctx); if (denied) return toolErr(denied);
    if (!args?.user_id || !UUID_RE.test(args.user_id)) return toolErr("user_id (UUID) is required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    try {
      const people = await buildPeopleDirectory(admin);
      const person = people.find((p) => p.id === args.user_id);
      if (!person) return toolErr("Person not found");
      return toolOk(person);
    } catch {
      return toolErr("Failed to load person");
    }
  },
  timber_create_person: async (args, ctx) => {
    if (!args?.org_id || !UUID_RE.test(args.org_id)) return toolErr("org_id (UUID) is required");
    // Q2 wall — admin | scoped (forced book group) | no.
    const scope = await resolveAddPersonScopeByProfile(ctx.actor.portalUserId, ctx.orgId, ctx.actor.isPlatformAdmin, args.org_id);
    if (!scope.ok) return toolErr(scope.error);
    const name = (args?.name ?? "").trim();
    const email = (args?.email ?? "").trim().toLowerCase();
    if (!name) return toolErr("name is required");
    if (!email) return toolErr("email is required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: dup } = await admin.from("portal_users").select("id").eq("email", email).maybeSingle();
    if (dup) return toolErr("Email already registered");
    const { data: org } = await admin.from("organisations").select("id").eq("id", args.org_id).maybeSingle();
    if (!org) return toolErr("Organisation not found");
    const { data, error } = await admin
      .from("portal_users")
      .insert({ email, name, role: "user", organisation_id: args.org_id, is_active: true, status: "created" })
      .select("id, email, name, role, organisation_id, auth_user_id, is_active, status, created_at, updated_at")
      .single();
    if (error || !data) return toolErr("Failed to create user");
    const groupRes = await applyPersonGroupsNoCache(admin, scope, data.id as string, args.org_id, args?.group_ids);
    if (!groupRes.success) return toolErr(`User created but group assignment failed: ${groupRes.error}`);
    return toolOk(data);
  },
  timber_add_person_to_org: async (args, ctx) => {
    if (!args?.user_id || !UUID_RE.test(args.user_id)) return toolErr("user_id (UUID) is required");
    if (!args?.org_id || !UUID_RE.test(args.org_id)) return toolErr("org_id (UUID) is required");
    const scope = await resolveAddPersonScopeByProfile(ctx.actor.portalUserId, ctx.orgId, ctx.actor.isPlatformAdmin, args.org_id);
    if (!scope.ok) return toolErr(scope.error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: user } = await admin.from("portal_users").select("id, organisation_id").eq("id", args.user_id).maybeSingle();
    if (!user) return toolErr("User not found");
    const { data: org } = await admin.from("organisations").select("id").eq("id", args.org_id).maybeSingle();
    if (!org) return toolErr("Organisation not found");
    const { data: existingMem } = await admin.from("organization_memberships").select("id, is_active").eq("user_id", args.user_id).eq("organization_id", args.org_id).maybeSingle();
    if (existingMem) {
      if (existingMem.is_active) return toolErr("User is already a member of this organisation");
      const { error } = await admin.from("organization_memberships").update({ is_active: true }).eq("id", existingMem.id);
      if (error) return toolErr("Failed to add user to organisation");
    } else if (user.organisation_id === args.org_id) {
      return toolErr("User is already a member of this organisation");
    } else {
      const { error } = await admin.from("organization_memberships").insert({
        user_id: args.user_id, organization_id: args.org_id, is_active: true, is_primary: false, invited_at: new Date().toISOString(),
      });
      if (error) return toolErr("Failed to add user to organisation");
    }
    const groupRes = await applyPersonGroupsNoCache(admin, scope, args.user_id, args.org_id, args?.group_ids);
    if (!groupRes.success) return toolErr(`User added but group assignment failed: ${groupRes.error}`);
    return toolOk({ user_id: args.user_id, organisation_id: args.org_id });
  },
  timber_remove_person_from_org: async (args, ctx) => {
    if (!args?.user_id || !UUID_RE.test(args.user_id)) return toolErr("user_id (UUID) is required");
    if (!args?.org_id || !UUID_RE.test(args.org_id)) return toolErr("org_id (UUID) is required");
    const scope = await resolveAddPersonScopeByProfile(ctx.actor.portalUserId, ctx.orgId, ctx.actor.isPlatformAdmin, args.org_id);
    if (!scope.ok) return toolErr(scope.error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: memsData, error: memErr } = await admin.from("organization_memberships").select("id, organization_id, is_primary").eq("user_id", args.user_id).eq("is_active", true);
    if (memErr) return toolErr("Failed to load memberships");
    const active = (memsData ?? []) as Array<{ id: string; organization_id: string; is_primary: boolean }>;
    const { data: pu } = await admin.from("portal_users").select("organisation_id").eq("id", args.user_id).maybeSingle();
    const legacyOrgId = (pu?.organisation_id as string | null) ?? null;
    const target = active.find((m) => m.organization_id === args.org_id) ?? null;
    if (!target) {
      if (legacyOrgId === args.org_id) return toolErr("This is the user's home organisation and cannot be removed. Set a different primary organisation first.");
      return toolErr("User is not a member of this organisation");
    }
    const orgSet = new Set(active.map((m) => m.organization_id));
    if (legacyOrgId) orgSet.add(legacyOrgId);
    if (orgSet.size <= 1) return toolErr("Cannot remove the user's only organisation — deactivate or delete the user instead.");
    if (target.is_primary || legacyOrgId === args.org_id) return toolErr("This is the user's primary organisation. Set a different primary first, then remove.");
    const { error: updErr } = await admin.from("organization_memberships").update({ is_active: false }).eq("id", target.id);
    if (updErr) return toolErr("Failed to remove user from organisation");
    await updateUserAccessGroups(admin, args.user_id, args.org_id, []);
    return toolOk({ user_id: args.user_id, organisation_id: args.org_id });
  },
  timber_update_person: async (args, ctx) => {
    const denied = requireAdmin(ctx); if (denied) return toolErr(denied);
    if (!args?.user_id || !UUID_RE.test(args.user_id)) return toolErr("user_id (UUID) is required");
    const name = (args?.name ?? "").trim();
    if (!name) return toolErr("name is required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: existing } = await admin.from("portal_users").select("id, email").eq("id", args.user_id).maybeSingle();
    if (!existing) return toolErr("User not found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = { name };
    if (args?.email !== undefined) {
      const email = String(args.email).trim().toLowerCase();
      if (email && email !== existing.email) {
        const { data: clash } = await admin.from("portal_users").select("id").eq("email", email).neq("id", args.user_id).maybeSingle();
        if (clash) return toolErr("Email already registered");
        payload.email = email;
      }
    }
    if (args?.phone !== undefined) {
      const p = String(args.phone).trim();
      payload.phone = p === "" ? null : p;
    }
    const { data, error } = await admin.from("portal_users").update(payload).eq("id", args.user_id)
      .select("id, email, name, phone, role, organisation_id, is_active, status, updated_at").single();
    if (error || !data) return toolErr("Failed to update user");
    return toolOk(data);
  },
  timber_toggle_person_active: async (args, ctx) => {
    const denied = requireAdmin(ctx); if (denied) return toolErr(denied);
    if (!args?.user_id || !UUID_RE.test(args.user_id)) return toolErr("user_id (UUID) is required");
    if (typeof args?.is_active !== "boolean") return toolErr("is_active (boolean) is required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: existing } = await admin.from("portal_users").select("id").eq("id", args.user_id).maybeSingle();
    if (!existing) return toolErr("User not found");
    const { data, error } = await admin.from("portal_users").update({ is_active: args.is_active }).eq("id", args.user_id)
      .select("id, email, name, is_active, status").single();
    if (error || !data) return toolErr("Failed to update user status");
    return toolOk(data);
  },
  timber_resend_person_invite: async (args, ctx) => {
    const denied = requireAdmin(ctx); if (denied) return toolErr(denied);
    if (!args?.user_id || !UUID_RE.test(args.user_id)) return toolErr("user_id (UUID) is required");
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any;
    const { data: pu } = await db.from("portal_users").select("id, email, name, role, auth_user_id, status").eq("id", args.user_id).maybeSingle();
    if (!pu) return toolErr("User not found");
    if (pu.status !== "invited") return toolErr("User is not in invited status. Reset/set-password is not available over MCP.");
    if (!pu.auth_user_id) return toolErr("User does not have login credentials yet (send-credentials is not available over MCP).");
    const del = await admin.auth.admin.deleteUser(pu.auth_user_id as string);
    if (del.error) return toolErr("Failed to reset user credentials. Please try again.");
    const { data: authData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(pu.email as string, {
      data: { name: pu.name as string, role: pu.role as string },
      redirectTo: "https://timber-world-portal.vercel.app/accept-invite",
    });
    if (inviteError || !authData?.user) {
      if (inviteError?.message?.includes("rate limit") || inviteError?.message?.includes("exceeded")) {
        return toolErr("Email rate limit reached (4 invites/hour). Please try again later.");
      }
      return toolErr(inviteError?.message || "Failed to resend invite email");
    }
    await db.from("portal_users").update({ auth_user_id: authData.user.id, invited_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", args.user_id);
    return toolOk({ email: pu.email });
  },

  // ── T5 · Platform settings (E4) — admin-only ────────────────────────────────
  timber_get_platform_setting: async (args, ctx) => {
    const denied = requireAdmin(ctx); if (denied) return toolErr(denied);
    if (!args?.key || typeof args.key !== "string") return toolErr("key is required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data, error } = await admin.from("platform_settings").select("key, value").eq("key", args.key).maybeSingle();
    if (error) return toolErr("Failed to load setting");
    return toolOk({ key: args.key, value: data?.value ?? null });
  },
  timber_set_platform_setting: async (args, ctx) => {
    const denied = requireAdmin(ctx); if (denied) return toolErr(denied);
    if (!args?.key || typeof args.key !== "string") return toolErr("key is required");
    if (args?.value === undefined) return toolErr("value is required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { error } = await admin.from("platform_settings").upsert({ key: args.key, value: args.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return toolErr("Failed to save setting");
    return toolOk({ key: args.key });
  },
};
