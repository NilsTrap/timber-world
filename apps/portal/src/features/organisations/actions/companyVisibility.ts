"use server";

import { logAudit } from "@/features/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";
import { visibilityGroupsForCompany } from "../services/companyVisibilityPolicy";
import type {
  ActionResult,
  CompanyVisibilityData,
  CompanyVisibilityGroup,
  CompanyVisibilityOption,
} from "../types";
import { isValidUUID } from "../types";

const COMPANY_COLUMNS =
  "id, code, name, is_active, is_customer, is_trader, is_supplier, is_manufacturer, is_producer";

interface CompanyRow {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  is_customer: boolean;
  is_trader: boolean;
  is_supplier: boolean;
  is_manufacturer: boolean;
  is_producer: boolean;
}

const emptyGroups = (): Record<CompanyVisibilityGroup, CompanyVisibilityOption[]> => ({
  customers: [],
  traders: [],
  suppliers: [],
});

async function traderAdminContext(traderId: string): Promise<
  // Database generation does not yet include organisation_trading_partners.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { ok: true; admin: any; actorId: string }
  | { ok: false; result: ActionResult<never> }
> {
  const authority = await requirePlatformAdmin();
  if (!authority.ok) return { ok: false, result: ADMIN_DENIED };
  if (!isValidUUID(traderId)) {
    return { ok: false, result: { success: false, error: "Trader not found", code: "NOT_FOUND" } };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: trader } = await admin
    .from("organisations")
    .select("id")
    .eq("id", traderId)
    .eq("is_trader", true)
    .maybeSingle();
  if (!trader) {
    return { ok: false, result: { success: false, error: "Trader not found", code: "NOT_FOUND" } };
  }
  return { ok: true, admin, actorId: authority.session.id };
}

/** Role-separated companies directly visible to one trader. */
export async function getCompanyVisibility(
  traderId: string,
): Promise<ActionResult<CompanyVisibilityData>> {
  const context = await traderAdminContext(traderId);
  if (!context.ok) return context.result;

  const [companiesResult, linksResult] = await Promise.all([
    context.admin.from("organisations").select(COMPANY_COLUMNS).eq("is_active", true).order("name"),
    context.admin
      .from("organisation_trading_partners")
      .select("partner_organisation_id")
      .eq("organisation_id", traderId),
  ]);
  if (companiesResult.error || linksResult.error) {
    console.error("Failed to load company visibility:", companiesResult.error ?? linksResult.error);
    return { success: false, error: "Failed to load company access", code: "FETCH_FAILED" };
  }

  const selected = new Set<string>(
    (linksResult.data ?? []).map((row: { partner_organisation_id: string }) => row.partner_organisation_id),
  );
  const groups = emptyGroups();
  for (const company of (companiesResult.data ?? []) as CompanyRow[]) {
    const option: CompanyVisibilityOption = {
      id: company.id,
      code: company.code,
      name: company.name,
      selected: selected.has(company.id),
    };
    for (const group of visibilityGroupsForCompany(company, traderId)) groups[group].push(option);
  }
  return { success: true, data: { traderId, groups } };
}

/** Replace direct role-classified visibility without touching unrelated legacy links. */
export async function updateCompanyVisibility(
  traderId: string,
  selectedTargetIds: string[],
): Promise<ActionResult<{ selected: number }>> {
  const context = await traderAdminContext(traderId);
  if (!context.ok) return context.result;

  const requested = [...new Set(selectedTargetIds)];
  if (requested.some((id) => id === traderId || !isValidUUID(id))) {
    return { success: false, error: "Invalid company selection", code: "VALIDATION_ERROR" };
  }

  const [companiesResult, currentResult] = await Promise.all([
    context.admin.from("organisations").select(COMPANY_COLUMNS).eq("is_active", true),
    context.admin
      .from("organisation_trading_partners")
      .select("partner_organisation_id")
      .eq("organisation_id", traderId),
  ]);
  if (companiesResult.error || currentResult.error) {
    return { success: false, error: "Failed to update company access", code: "FETCH_FAILED" };
  }

  const shareable = new Set<string>();
  for (const company of (companiesResult.data ?? []) as CompanyRow[]) {
    if (visibilityGroupsForCompany(company, traderId).length > 0) shareable.add(company.id);
  }
  if (requested.some((id) => !shareable.has(id))) {
    return { success: false, error: "Invalid company selection", code: "VALIDATION_ERROR" };
  }

  const requestedSet = new Set(requested);
  const currentManaged = (currentResult.data ?? [])
    .map((row: { partner_organisation_id: string }) => row.partner_organisation_id)
    .filter((id: string) => shareable.has(id));
  const currentSet = new Set(currentManaged);
  const addIds = requested.filter((id) => !currentSet.has(id));
  const removeIds = currentManaged.filter((id: string) => !requestedSet.has(id));

  // Add before removing: a partial failure cannot accidentally revoke existing access.
  if (addIds.length > 0) {
    const { error } = await context.admin.from("organisation_trading_partners").upsert(
      addIds.map((partnerId) => ({
        organisation_id: traderId,
        partner_organisation_id: partnerId,
        created_by: context.actorId,
      })),
      { onConflict: "organisation_id,partner_organisation_id", ignoreDuplicates: true },
    );
    if (error) return { success: false, error: "Failed to update company access", code: "UPDATE_FAILED" };
  }
  if (removeIds.length > 0) {
    const { error } = await context.admin
      .from("organisation_trading_partners")
      .delete()
      .eq("organisation_id", traderId)
      .in("partner_organisation_id", removeIds);
    if (error) return { success: false, error: "Failed to update company access", code: "UPDATE_FAILED" };
  }

  await logAudit({
    action: "company_visibility.update",
    resourceType: "organisation",
    resourceId: traderId,
    organisationId: traderId,
    metadata: { selected: requested.length, added: addIds.length, removed: removeIds.length },
  });
  return { success: true, data: { selected: requested.length } };
}
