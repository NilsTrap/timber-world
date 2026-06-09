/**
 * True if `candidateOrgId` is a trading partner of `userOrgId` AND has the
 * required role flag AND is active. Used to stop non-admins assigning an order
 * party to an arbitrary org (the UI only filters the dropdown). `roleColumn`
 * is a fixed literal — never user input — so the select interpolation is safe.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isAllowedOrderParty(
  client: any,
  userOrgId: string | null,
  candidateOrgId: string | null | undefined,
  roleColumn: "is_customer" | "is_manufacturer" | "is_producer",
): Promise<boolean> {
  if (!candidateOrgId || !userOrgId) return false;
  const { data: tp } = await client
    .from("organisation_trading_partners")
    .select("partner_organisation_id")
    .eq("organisation_id", userOrgId)
    .eq("partner_organisation_id", candidateOrgId)
    .maybeSingle();
  if (!tp) return false;
  const { data: org } = await client
    .from("organisations")
    .select(`${roleColumn}, is_active`)
    .eq("id", candidateOrgId)
    .maybeSingle();
  return !!org && org[roleColumn] === true && org.is_active === true;
}
