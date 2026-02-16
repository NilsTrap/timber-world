"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser, isSuperAdmin } from "@/lib/auth";
import type { ProductionHistoryItem, ActionResult } from "../types";

/**
 * Fetch validated production entries with calculated totals.
 * Ordered by validated_at (newest first).
 *
 * Multi-tenancy:
 * - Organisation users see only their organisation's validated entries
 * - Super Admin sees all validated entries across all organisations (or filtered by orgIds if provided)
 *
 * @param orgIds - Optional org IDs for Super Admin to filter by specific organisations (multi-select)
 */
export async function getValidatedProductions(orgIds?: string[]): Promise<
  ActionResult<ProductionHistoryItem[]>
> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("portal_production_entries")
    .select(
      "id, production_date, total_input_m3, total_output_m3, outcome_percentage, waste_percentage, validated_at, entry_type, organisation_id, created_by, planned_work, actual_work, invoice_number, ref_processes(value, work_unit, price), organisations(code, name)"
    )
    .eq("status", "validated")
    .order("validated_at", { ascending: false });

  // Organisation users: always filter by their own organisation
  if (isOrganisationUser(session)) {
    query = query.eq("organisation_id", session.organisationId);
  } else if (isSuperAdmin(session) && orgIds && orgIds.length > 0) {
    // Super Admin with org filter: filter by selected organisations (multi-select)
    query = query.in("organisation_id", orgIds);
  }
  // Super Admin without org filter: no filter, sees all validated entries

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message, code: "QUERY_FAILED" };
  }

  // Get unique auth user IDs to fetch user names
  const authUserIds = [...new Set((data ?? []).map((row: any) => row.created_by).filter(Boolean))];

  // Fetch user names from portal_users
  let userMap = new Map<string, string>();
  if (authUserIds.length > 0) {
    const { data: users } = await (supabase as any)
      .from("portal_users")
      .select("auth_user_id, name")
      .in("auth_user_id", authUserIds);

    (users ?? []).forEach((u: any) => {
      if (u.auth_user_id) userMap.set(u.auth_user_id, u.name);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: ProductionHistoryItem[] = (data ?? []).map((row: any) => ({
    id: row.id,
    processName: row.ref_processes?.value ?? "Unknown",
    productionDate: row.production_date,
    totalInputM3: row.total_input_m3 ?? 0,
    totalOutputM3: row.total_output_m3 ?? 0,
    outcomePercentage: row.outcome_percentage ?? 0,
    wastePercentage: row.waste_percentage ?? 0,
    validatedAt: row.validated_at,
    entryType: row.entry_type ?? "standard",
    organisationCode: row.organisations?.code ?? null,
    organisationName: row.organisations?.name ?? null,
    createdByName: row.created_by ? userMap.get(row.created_by) ?? null : null,
    plannedWork: row.planned_work ?? null,
    actualWork: row.actual_work ?? null,
    workUnit: row.ref_processes?.work_unit ?? null,
    price: row.ref_processes?.price != null ? Number(row.ref_processes.price) : null,
    invoiceNumber: row.invoice_number ?? null,
  }));

  return { success: true, data: items };
}
