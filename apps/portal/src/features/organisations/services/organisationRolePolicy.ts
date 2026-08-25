export const ORGANISATION_ROLES = [
  "customer",
  "manufacturer",
  "producer",
  "supplier",
  "trader",
] as const;

export type OrganisationRole = (typeof ORGANISATION_ROLES)[number];
export type OrganisationRoleSelection = OrganisationRole | "unassigned" | "multiple";

export interface OrganisationRoleFlags {
  isCustomer?: boolean | null;
  isManufacturer?: boolean | null;
  isProducer?: boolean | null;
  isSupplier?: boolean | null;
  isTrader?: boolean | null;
}

const ROLE_FLAG_KEYS: Record<OrganisationRole, keyof OrganisationRoleFlags> = {
  customer: "isCustomer",
  manufacturer: "isManufacturer",
  producer: "isProducer",
  supplier: "isSupplier",
  trader: "isTrader",
};

const ROLE_DB_COLUMNS: Record<OrganisationRole, string> = {
  customer: "is_customer",
  manufacturer: "is_manufacturer",
  producer: "is_producer",
  supplier: "is_supplier",
  trader: "is_trader",
};

export function isOrganisationRole(value: string): value is OrganisationRole {
  return ORGANISATION_ROLES.includes(value as OrganisationRole);
}

/** Resolve legacy boolean columns into the single role used by the UI. */
export function organisationRoleFromFlags(flags: OrganisationRoleFlags): OrganisationRoleSelection {
  const selected = ORGANISATION_ROLES.filter((role) => flags[ROLE_FLAG_KEYS[role]] === true);
  if (selected.length === 0) return "unassigned";
  if (selected.length > 1) return "multiple";
  return selected[0]!;
}

/** Atomic DB payload: selecting one role always clears every other role column. */
export function exclusiveRoleDbUpdate(role: OrganisationRole | null) {
  return {
    is_customer: role === "customer",
    is_manufacturer: role === "manufacturer",
    is_producer: role === "producer",
    is_supplier: role === "supplier",
    is_trader: role === "trader",
  };
}

/**
 * Convert role-flag input from service/MCP callers into an exclusive update.
 * A single true flag selects that role and clears the rest. Multiple true flags
 * are invalid. False-only input remains a partial clear for backwards-compatible
 * partial updates.
 */
export function exclusiveRoleUpdateFromFlags(flags: OrganisationRoleFlags):
  | { success: true; update: Record<string, boolean> }
  | { success: false; error: string } {
  const provided = ORGANISATION_ROLES.filter((role) => typeof flags[ROLE_FLAG_KEYS[role]] === "boolean");
  const selected = provided.filter((role) => flags[ROLE_FLAG_KEYS[role]] === true);

  if (selected.length > 1) {
    return { success: false, error: "A company can have only one role" };
  }
  if (selected.length === 1) {
    return { success: true, update: exclusiveRoleDbUpdate(selected[0]!) };
  }

  const update: Record<string, boolean> = {};
  for (const role of provided) {
    update[ROLE_DB_COLUMNS[role]] = false;
  }
  return { success: true, update };
}
