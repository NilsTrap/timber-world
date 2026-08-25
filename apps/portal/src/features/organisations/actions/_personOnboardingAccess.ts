import { getAccessProfile } from "@/lib/access";
import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth/getSession";
import { createAdminClient } from "@/lib/supabase/admin";
import { canOnboardCompanyPerson } from "../services/personOnboardingAccessPolicy";

type TargetOrganisation = {
  id: string;
  name: string;
  is_customer: boolean;
  is_trader: boolean;
  is_manufacturer: boolean;
  is_supplier: boolean;
  is_producer: boolean;
};

export type PersonOnboardingAccess =
  | { ok: true; mode: "admin" | "trader"; session: SessionUser; target: TargetOrganisation }
  | { ok: false };

/**
 * Exact wall for company-user onboarding.
 *
 * Platform admins may onboard into any active company. A trader needs the
 * explicit person:invite right and may onboard only into its own trader
 * company or a directly assigned customer company.
 */
export async function requirePersonOnboardingAccess(
  organisationId: string,
): Promise<PersonOnboardingAccess> {
  const session = await getSession();
  if (!session) return { ok: false };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: target } = await admin.from("organisations")
    .select("id, name, is_customer, is_trader, is_manufacturer, is_supplier, is_producer")
    .eq("id", organisationId)
    .eq("is_active", true)
    .maybeSingle();
  if (!target) return { ok: false };

  if (session.isPlatformAdmin === true) {
    return { ok: true, mode: "admin", session, target };
  }

  const callerOrgId = session.currentOrganizationId || session.organisationId;
  if (!callerOrgId) return { ok: false };
  const [{ data: caller }, profile] = await Promise.all([
    admin.from("organisations").select("is_trader").eq("id", callerOrgId).eq("is_active", true).maybeSingle(),
    getAccessProfile(session.portalUserId, callerOrgId),
  ]);
  if (canOnboardCompanyPerson({
    platformAdmin: false,
    hasInviteRight: profile.actions.has("person:invite"),
    callerOrgId,
    callerIsTrader: caller?.is_trader === true,
    targetOrgId: organisationId,
    targetIsCustomer: target.is_customer === true,
    targetIsTrader: target.is_trader === true,
    directlyAssigned: callerOrgId === organisationId,
  })) {
    return { ok: true, mode: "trader", session, target };
  }
  if (target.is_customer !== true) return { ok: false };

  const { data: link } = await admin.from("organisation_trading_partners")
    .select("partner_organisation_id")
    .eq("organisation_id", callerOrgId)
    .eq("partner_organisation_id", organisationId)
    .maybeSingle();
  return canOnboardCompanyPerson({
    platformAdmin: false,
    hasInviteRight: profile.actions.has("person:invite"),
    callerOrgId,
    callerIsTrader: caller?.is_trader === true,
    targetOrgId: organisationId,
    targetIsCustomer: target.is_customer === true,
    targetIsTrader: target.is_trader === true,
    directlyAssigned: Boolean(link),
  })
    ? { ok: true, mode: "trader", session, target }
    : { ok: false };
}

export async function canOnboardPeopleForOrganisation(organisationId: string): Promise<boolean> {
  return (await requirePersonOnboardingAccess(organisationId)).ok;
}
