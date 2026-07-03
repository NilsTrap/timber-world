/**
 * Shared line-write authorization for the Deal tab (B5).
 *
 * A line item's price + total are `deal_terms` (E4 field wall). Adding, removing,
 * catalog-pricing, OR editing the amounts of a line therefore requires the caller
 * to be able to EDIT the `deal_terms` domain (a Salesperson / Purchasing group) or
 * be a platform admin. ONE check shared by catalogPicker (add/remove) and
 * dealActions.updateDealLineItemAmounts (edit) so they can never drift apart.
 *
 * NOTE — this profile check is deliberately SIDE-BLIND. resolveFieldAccess is
 * profile-global (a Purchasing user "can edit deal_terms" everywhere). The SIDE
 * isolation — Purchasing may price only BUY legs, Salesperson only SELL legs — is
 * enforced by ROW visibility (the `side.buy` / `side.sell` deal-visibility rights,
 * seeded 20260701000009) via RLS on the underlying order/line write. So this gate
 * says "may this actor edit deal terms at all"; RLS says "on WHICH deals".
 */
import { getAccessProfile } from "@/lib/access";
import { resolveFieldAccess } from "../services/dealFields";

export async function requireLineWriteAccess(
  actor: { isPlatformAdmin: boolean; portalUserId: string | null },
  orgId: string | null,
): Promise<boolean> {
  if (actor.isPlatformAdmin) return true;
  const profile = await getAccessProfile(actor.portalUserId, orgId);
  return resolveFieldAccess(profile).domainEditable("deal_terms");
}
