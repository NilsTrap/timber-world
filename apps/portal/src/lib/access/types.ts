/**
 * E4 · Group-and-rights access — shared types.
 *
 * A user's effective access in an organisation is the UNION of the rights
 * of the groups assigned to them for that org (user_access_groups), with
 * module rights additionally capped by the org ceiling (organization_modules).
 * Platform admins (session.role === "admin" in-app, is_platform_admin in RLS)
 * bypass everything, exactly as before E4.
 */

/** Field-domain keys — the registry mapping deal fields to domains lives in
 * features/orders/services/dealFields.ts. Deny by default: a domain absent
 * from the profile is invisible (except `general`, which is visible to
 * anyone who can see the row at all). */
export const FIELD_DOMAINS = [
  "general",
  "deal_terms",
  "production",
  "margin",
  "financial_docs",
  "logistics",
  "customer_identity",
  "supplier_identity",
  "chain",
] as const;

export type FieldDomain = (typeof FIELD_DOMAINS)[number];

export type DealScope = "mine" | "company" | "all";

export interface FieldGrant {
  visible: boolean;
  editable: boolean;
}

export interface AccessProfile {
  /** Group ids backing this profile (for cache-bust bookkeeping). */
  groupIds: string[];
  /** Effective module codes: org ceiling ∩ union of group module rights. */
  modules: Set<string>;
  /** Row-level deal visibility keys: side.sell / side.buy / legacy.producer / spine.status. */
  dealVisibility: Set<string>;
  /** Field-domain grants (visibility/deal_fields rows). */
  fieldDomains: Partial<Record<FieldDomain, FieldGrant>>;
  /** Per-field overrides (field/deal rows); win over the domain grant. */
  fieldOverrides: Record<string, FieldGrant>;
  /** Widest deal scope across groups; defaults to "company". */
  scope: DealScope;
  /** Action rights as "<resource>:<key>", e.g. "counterparty:clients", "deal:create". */
  actions: Set<string>;
}

/** Profile used for platform admins and the MCP service agent: everything. */
export function fullAccessProfile(): AccessProfile {
  const domains: Partial<Record<FieldDomain, FieldGrant>> = {};
  for (const d of FIELD_DOMAINS) domains[d] = { visible: true, editable: true };
  return {
    groupIds: [],
    modules: new Set(),
    dealVisibility: new Set(["side.sell", "side.buy", "legacy.producer", "spine.status"]),
    fieldDomains: domains,
    fieldOverrides: {},
    scope: "all",
    actions: new Set(["counterparty:clients", "counterparty:suppliers", "deal:create"]),
  };
}

/** Profile with no rights at all (unauthenticated / no groups). */
export function emptyAccessProfile(): AccessProfile {
  return {
    groupIds: [],
    modules: new Set(),
    dealVisibility: new Set(),
    fieldDomains: {},
    fieldOverrides: {},
    scope: "company",
    actions: new Set(),
  };
}
