/**
 * Timber Projects — persona labels derived from ORGANISATION ROLE FLAGS.
 *
 * PRESENTATION ONLY. A flag never grants a right: what a user may reach is
 * decided by `gate.ts` (modules) and what they may see inside a deal is decided
 * by RLS + the E4 field wall. These labels only tell the viewer which hat their
 * current organisation wears ("you are here as a Buyer"), and which hat the
 * counterparty on a visible deal wears. Nothing downstream branches on them.
 *
 * Mapping (spec):
 *   buyer                 = is_customer
 *   trader                = is_trader
 *   supplier/manufacturer = is_supplier OR is_manufacturer OR is_producer
 *
 * Multiple flags yield multiple labels (an org can be a client AND a supplier),
 * always in the stable order below. No flags / unknown org → no label at all
 * (never a default persona — deny by default extends to labelling).
 *
 * Pure module: no DB, no next imports — unit-tested in __tests__/.
 */

export type ProjectPersona = "buyer" | "trader" | "supplier";

/** Stable presentation order, so a multi-role org always reads the same way. */
export const PERSONA_ORDER: readonly ProjectPersona[] = ["buyer", "trader", "supplier"] as const;

export const PERSONA_LABEL: Record<ProjectPersona, string> = {
  buyer: "Buyer",
  trader: "Trader",
  supplier: "Supplier / Manufacturer",
};

/** Short label for dense surfaces (table cells, chips next to a name). */
export const PERSONA_SHORT_LABEL: Record<ProjectPersona, string> = {
  buyer: "Buyer",
  trader: "Trader",
  supplier: "Supplier",
};

/** The organisation role flags, as stored on `organisations` (snake_case rows
 *  are normalised by the caller). Every field optional: a row the viewer may
 *  not read simply yields no personas. */
export interface OrgRoleFlags {
  isCustomer?: boolean | null;
  isTrader?: boolean | null;
  isSupplier?: boolean | null;
  isManufacturer?: boolean | null;
  isProducer?: boolean | null;
}

/** Normalise a raw `organisations` row (or anything shaped like one) into flags. */
export function orgRoleFlagsFromRow(row: Record<string, unknown> | null | undefined): OrgRoleFlags {
  if (!row) return {};
  return {
    isCustomer: row.is_customer === true,
    isTrader: row.is_trader === true,
    isSupplier: row.is_supplier === true,
    isManufacturer: row.is_manufacturer === true,
    isProducer: row.is_producer === true,
  };
}

/** The personas an organisation presents as. Empty when nothing is flagged. */
export function personasForOrg(flags: OrgRoleFlags | null | undefined): ProjectPersona[] {
  if (!flags) return [];
  const out: ProjectPersona[] = [];
  if (flags.isCustomer === true) out.push("buyer");
  if (flags.isTrader === true) out.push("trader");
  if (flags.isSupplier === true || flags.isManufacturer === true || flags.isProducer === true) {
    out.push("supplier");
  }
  return out;
}

/** Human list for a header line, e.g. "Buyer · Trader". Empty string when none. */
export function personaSummary(personas: readonly ProjectPersona[]): string {
  return personas.map((p) => PERSONA_LABEL[p]).join(" · ");
}
