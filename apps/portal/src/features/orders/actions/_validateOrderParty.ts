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
  roleColumn: "is_customer" | "is_manufacturer" | "is_producer" | "is_trader",
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

/**
 * L2 · The org ids the user is a MEMBER of that are flagged `is_trader` — the
 * set of house trading companies a salesperson's deals may sell from. A
 * salesperson is bound to their trader org(s) via organisation membership; this
 * is the server-trusted list behind the New-deal "Trader" slot. Empty result =
 * the user has no trader binding (customer-side, or a platform admin).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTraderMembershipOrgIds(
  client: any,
  membershipOrgIds: string[],
): Promise<string[]> {
  const ids = membershipOrgIds.filter(Boolean);
  if (ids.length === 0) return [];
  const { data } = await client
    .from("organisations")
    .select("id")
    .in("id", ids)
    .eq("is_trader", true)
    .eq("is_active", true);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

export type PartySlotResult =
  | { ok: true; customerOrgId: string | null; sellerOrgId: string | null }
  | { ok: false; error: string; code: string };

/**
 * Resolve the Customer (buyer) + Trader (seller) org slots for an order,
 * applying the trader-binding + trading-partner walls. Shared by the create
 * path (createOrder) and the H1 draft party-setter (setDealParties) so both
 * enforce the SAME rules — a divergence here would be a security hole.
 *
 * - Admin: free choice — both come straight from input (no wall).
 * - Non-admin bound to trader org(s) (a salesperson): the Trader (seller) must
 *   be one of THEIR trader orgs — auto-defaults to the current org when it is a
 *   trader membership, or the sole membership; they may pick the Customer,
 *   validated as an is_customer trading partner of the chosen trader.
 * - Non-admin with no trader binding (customer-side): own org is FORCED as the
 *   Customer; they may only pick the Trader, validated as an is_trader trading
 *   partner. (Legacy fallback: a pre-trader-flag org that is is_manufacturer is
 *   still treated as seller-side, forced to its own org.)
 *
 * The dropdown filtering is UI-only and never trusted — the picked counterparty
 * is always re-validated here. L3 permits ONE slot to be left null (a deal may
 * be held with a party unset while shopping); a provided slot is still walled.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolvePartySlots(
  client: any,
  ctx: { isAdmin: boolean; userOrgId: string | null; userTraderOrgIds?: string[] },
  input: { customerOrganisationId?: string | null; sellerOrganisationId?: string | null },
): Promise<PartySlotResult> {
  const inputCustomerOrgId = input.customerOrganisationId ?? null;
  const inputSellerOrgId = input.sellerOrganisationId ?? null;

  // Admin: no wall, both slots taken verbatim.
  if (ctx.isAdmin) {
    return { ok: true, customerOrgId: inputCustomerOrgId, sellerOrgId: inputSellerOrgId };
  }

  const userOrgId = ctx.userOrgId;

  // Seller candidates = the user's trader memberships (new model). Legacy
  // fallback: a pre-flag org that is is_manufacturer is still seller-side,
  // forced to its own org, so existing manufacturer-side flows never break.
  let sellerCandidates = ctx.userTraderOrgIds ?? [];
  if (sellerCandidates.length === 0 && userOrgId) {
    const { data: ownOrg } = await client
      .from("organisations")
      .select("is_manufacturer")
      .eq("id", userOrgId)
      .single();
    if (ownOrg?.is_manufacturer === true) sellerCandidates = [userOrgId];
  }

  if (sellerCandidates.length > 0) {
    // Seller-side (salesperson): the Trader must be one of their own orgs.
    let sellerOrgId = inputSellerOrgId;
    if (sellerOrgId) {
      if (!sellerCandidates.includes(sellerOrgId)) {
        return { ok: false, error: "Selected trader is not one of your organisations", code: "FORBIDDEN" };
      }
    } else {
      // Default: the current org when it is a trader membership, else the sole
      // membership (auto-select), else leave null (multi-trader, not yet picked).
      sellerOrgId =
        userOrgId && sellerCandidates.includes(userOrgId)
          ? userOrgId
          : sellerCandidates.length === 1
            ? sellerCandidates[0] ?? null
            : null;
    }
    const customerOrgId = inputCustomerOrgId;
    // The customer must be an is_customer trading partner of the CHOSEN trader.
    const bookOrgId = sellerOrgId ?? userOrgId;
    if (customerOrgId && !(await isAllowedOrderParty(client, bookOrgId, customerOrgId, "is_customer"))) {
      return { ok: false, error: "Selected customer is not an allowed trading partner", code: "FORBIDDEN" };
    }
    return { ok: true, customerOrgId, sellerOrgId };
  }

  // Customer-side: own org forced as the Customer; they pick the Trader.
  const customerOrgId = userOrgId;
  const sellerOrgId = inputSellerOrgId;
  if (sellerOrgId && !(await isAllowedOrderParty(client, userOrgId, sellerOrgId, "is_trader"))) {
    return { ok: false, error: "Selected trader is not an allowed trading partner", code: "FORBIDDEN" };
  }
  return { ok: true, customerOrgId, sellerOrgId };
}
