/**
 * Timber MCP · CRM domain — organisations + the access-group / user management
 * surface (E7 read + J3 write).
 *
 * Exports (aggregated by ../tools.ts + ../route.ts): `crmTools` (ToolDef[]),
 * `crmCaps` (USER_WRITE_CAPABILITY entries — all "admin"), and `crmHandlers`
 * (dispatch handlers = the exact former route.ts switch-case bodies, unchanged).
 */
import { listOrgs, getOrg, createOrg, updateOrg } from "@/features/organisations/services/orgService";
import { exclusiveRoleUpdateFromFlags } from "@/features/organisations/services/organisationRolePolicy";
import { listAccessGroups, getAccessGroupDetail, getUserAccessGroups, listPortalUsers } from "@/features/access/services/groupsRead";
import { createAccessGroup, updateAccessGroup, deleteAccessGroup, saveGroupRights, updateUserAccessGroups } from "@/features/access/services/groupsWrite";
import type { GroupRightsInput } from "@/features/access/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkContactAccessForOrgByProfile } from "@/features/counterparties/access";
import {
  attachPersonMembership,
  createPersonWithPrimaryMembership,
  listPeopleWithMemberships,
  setMembershipActive,
  setMembershipGroups,
  setPersonAccountActive,
} from "@/features/organisations/services/personOnboarding";
import { sendPasswordlessInvite } from "@/features/organisations/services/passwordlessInvite";
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
    description: "Create a Timber organisation (3-char code + name + optional company card + one company role). At most one of is_customer/is_manufacturer/is_producer/is_supplier/is_trader may be true. Mirrors to the Oscar CRM when configured and returns the stored org incl. crm_org_id.",
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
      "Update an existing Timber organisation (partial — only the provided fields change). A true role flag selects that one company role and clears the others; multiple true role flags are rejected. The 3-char CODE is immutable. Mirrors card + customer/manufacturer/producer changes to the Oscar CRM when configured.",
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
      "Create a new person with one active primary organisation membership and ceiling-capped access groups. Platform-admin only. No credentials are returned or sent by this tool.",
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
      "Add an existing person to an organisation (or reactivate without restoring old rights) and assign ceiling-capped access groups. Platform-admin only.",
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
      "Deactivate one organisation membership and strip only that organisation's access. Refuses the only/primary membership. Platform-admin only.",
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
      "Resend a passwordless invite without deleting/recreating the auth identity. No link, password, or token is returned. Platform-admin only.",
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
 *  Org-contact writes remain book-scoped. Login-person onboarding is platform-
 *  admin only and delegates to the same membership services as the portal UI. */
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
  // Login-person and membership mutations are platform-admin only.
  timber_create_person: "admin",
  timber_add_person_to_org: "admin",
  timber_remove_person_from_org: "admin",
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
    const roleValidation = exclusiveRoleUpdateFromFlags({
      isCustomer: args?.is_customer,
      isManufacturer: args?.is_manufacturer,
      isProducer: args?.is_producer,
      isSupplier: args?.is_supplier,
      isTrader: args?.is_trader,
    });
    if (!roleValidation.success) return toolErr(roleValidation.error);
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
    // Seed the exclusive role after the company card is created. Input is
    // validated before creation so a conflicting request cannot leave a partial
    // unassigned company behind.
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
      return toolOk(await listPeopleWithMemberships(admin));
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
      const people = await listPeopleWithMemberships(admin);
      const person = people.find((p) => p.id === args.user_id);
      if (!person) return toolErr("Person not found");
      return toolOk(person);
    } catch {
      return toolErr("Failed to load person");
    }
  },
  timber_create_person: async (args, ctx) => {
    const denied = requireAdmin(ctx); if (denied) return toolErr(denied);
    if (!args?.org_id || !UUID_RE.test(args.org_id)) return toolErr("org_id (UUID) is required");
    const name = (args?.name ?? "").trim();
    const email = (args?.email ?? "").trim().toLowerCase();
    if (!name) return toolErr("name is required");
    if (!email) return toolErr("email is required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const created = await createPersonWithPrimaryMembership(admin, { email, name, organisationId: args.org_id, invitedBy: ctx.actor.portalUserId });
    if (!created.ok) return toolErr(created.code === "DUPLICATE_EMAIL" ? "Email already registered" : "Permission denied");
    const groupRes = await setMembershipGroups(admin, created.userId, args.org_id, Array.isArray(args?.group_ids) ? args.group_ids : []);
    if (!groupRes.ok) return toolErr("Selected access is unavailable for this organisation");
    return toolOk({ id: created.userId, organisation_id: args.org_id, status: "created", is_active: true, is_primary: true });
  },
  timber_add_person_to_org: async (args, ctx) => {
    const denied = requireAdmin(ctx); if (denied) return toolErr(denied);
    if (!args?.user_id || !UUID_RE.test(args.user_id)) return toolErr("user_id (UUID) is required");
    if (!args?.org_id || !UUID_RE.test(args.org_id)) return toolErr("org_id (UUID) is required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const attached = await attachPersonMembership(admin, { userId: args.user_id, organisationId: args.org_id, makePrimary: false, invitedBy: ctx.actor.portalUserId });
    if (!attached.ok) return toolErr(attached.code === "ALREADY_MEMBER" ? "User is already a member of this organisation" : "Permission denied");
    const groupRes = await setMembershipGroups(admin, args.user_id, args.org_id, Array.isArray(args?.group_ids) ? args.group_ids : []);
    if (!groupRes.ok) return toolErr("Selected access is unavailable for this organisation");
    return toolOk({ user_id: args.user_id, organisation_id: args.org_id });
  },
  timber_remove_person_from_org: async (args, ctx) => {
    const denied = requireAdmin(ctx); if (denied) return toolErr(denied);
    if (!args?.user_id || !UUID_RE.test(args.user_id)) return toolErr("user_id (UUID) is required");
    if (!args?.org_id || !UUID_RE.test(args.org_id)) return toolErr("org_id (UUID) is required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const changed = await setMembershipActive(admin, args.user_id, args.org_id, false);
    if (!changed.ok) return toolErr(changed.code === "PRIMARY_OR_ONLY_MEMBERSHIP" ? "Choose another primary organisation first" : "Permission denied");
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
    const changed = await setPersonAccountActive(admin, args.user_id, args.is_active);
    return changed.ok ? toolOk(changed.user) : toolErr("Permission denied");
  },
  timber_resend_person_invite: async (args, ctx) => {
    const denied = requireAdmin(ctx); if (denied) return toolErr(denied);
    if (!args?.user_id || !UUID_RE.test(args.user_id)) return toolErr("user_id (UUID) is required");
    const admin = createAdminClient();
    const people = await listPeopleWithMemberships(admin);
    const person = people.find((p) => p.id === args.user_id);
    const orgId = person?.memberships.find((m) => m.isPrimary && m.isActive)?.orgId;
    if (!orgId) return toolErr("Permission denied");
    const result = await sendPasswordlessInvite(admin, admin, args.user_id, orgId, ctx.actor.portalUserId);
    return result.ok ? toolOk({ email: result.email }) : toolErr("Invitation email could not be sent; try again");
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
