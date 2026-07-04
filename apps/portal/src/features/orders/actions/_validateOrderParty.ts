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

export type PartySlotResult =
  | { ok: true; customerOrgId: string | null; sellerOrgId: string | null }
  | { ok: false; error: string; code: string };

/**
 * Resolve the Customer (buyer) + Manufacturer (seller) org slots for an order,
 * applying the company-role auto-fill + trading-partner walls. Shared by the
 * create path (createOrder) and the H1 draft party-setter (setDealParties) so
 * both enforce the SAME rules — a divergence here would be a security hole.
 *
 * - Admin: free choice — both come straight from input (no wall).
 * - Non-admin whose own org is a Manufacturer: own org is FORCED as the seller;
 *   they may only pick the Customer, validated as an is_customer trading partner.
 * - Non-admin customer-side: own org is FORCED as the Customer; they may only
 *   pick the Manufacturer, validated as an is_manufacturer trading partner.
 *
 * The dropdown filtering is UI-only and never trusted — the picked counterparty
 * is always re-validated here (isAllowedOrderParty). The forced own-org slot is
 * trusted (the user is a member of it).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolvePartySlots(
  client: any,
  ctx: { isAdmin: boolean; userOrgId: string | null },
  input: { customerOrganisationId?: string | null; sellerOrganisationId?: string | null },
): Promise<PartySlotResult> {
  const inputCustomerOrgId = input.customerOrganisationId ?? null;
  const inputSellerOrgId = input.sellerOrganisationId ?? null;

  // Admin: no wall, both slots taken verbatim.
  if (ctx.isAdmin) {
    return { ok: true, customerOrgId: inputCustomerOrgId, sellerOrgId: inputSellerOrgId };
  }

  const userOrgId = ctx.userOrgId;
  let userIsManufacturer = false;
  if (userOrgId) {
    const { data: ownOrg } = await client
      .from("organisations")
      .select("is_manufacturer")
      .eq("id", userOrgId)
      .single();
    userIsManufacturer = ownOrg?.is_manufacturer === true;
  }

  let customerOrgId: string | null;
  let sellerOrgId: string | null;
  if (userIsManufacturer) {
    sellerOrgId = userOrgId; // own org forced as the Manufacturer (seller)
    customerOrgId = inputCustomerOrgId; // they pick the Customer
    if (customerOrgId && !(await isAllowedOrderParty(client, userOrgId, customerOrgId, "is_customer"))) {
      return { ok: false, error: "Selected customer is not an allowed trading partner", code: "FORBIDDEN" };
    }
  } else {
    customerOrgId = userOrgId; // own org forced as the Customer
    sellerOrgId = inputSellerOrgId; // they pick the Manufacturer
    if (sellerOrgId && !(await isAllowedOrderParty(client, userOrgId, sellerOrgId, "is_manufacturer"))) {
      return { ok: false, error: "Selected manufacturer is not an allowed trading partner", code: "FORBIDDEN" };
    }
  }
  return { ok: true, customerOrgId, sellerOrgId };
}
