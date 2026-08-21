/**
 * Timber Projects — organisation persona lookup.
 *
 * Reads the role flags of orgs that are ALREADY part of the viewer's payload
 * (their current organisation, and the parties on deals they can see) through
 * the AUTHENTICATED client, so `organisations_select` RLS decides what comes
 * back. An org the viewer may not read simply yields no entry, which
 * `personasForOrg` turns into "no labels" — never a default persona.
 *
 * This is presentation data only: nothing downstream branches on the result.
 */
import type { DbClient } from "../../orders/services/dealModel";
import { orgRoleFlagsFromRow, personasForOrg, type ProjectPersona } from "../personas";

/** org id → personas. Missing key = not readable / no flags. */
export async function loadOrgPersonas(
  db: DbClient,
  orgIds: readonly (string | null | undefined)[],
): Promise<Map<string, ProjectPersona[]>> {
  const ids = Array.from(new Set(orgIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return new Map();

  const { data, error } = await db
    .from("organisations")
    .select("id, is_customer, is_trader, is_supplier, is_manufacturer, is_producer")
    .in("id", ids);
  if (error || !data) return new Map();

  const out = new Map<string, ProjectPersona[]>();
  for (const row of data as Array<Record<string, unknown>>) {
    const id = row.id as string;
    if (!id) continue;
    out.set(id, personasForOrg(orgRoleFlagsFromRow(row)));
  }
  return out;
}
