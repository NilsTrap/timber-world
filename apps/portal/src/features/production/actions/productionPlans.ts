"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser } from "@/lib/auth";
import type { ActionResult } from "../types";
import type {
  ProductionPlanListItem,
  ProductionPlanDetail,
  ProductionPlanPackage,
} from "../types-plans";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SessionOk = { session: Awaited<ReturnType<typeof getSession>> & object; orgId: string };
type SessionErr = { error: string; code: string };

/** Resolve the effective org id for the current session (org user). */
async function requireOrgSession(): Promise<SessionOk | SessionErr> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated", code: "UNAUTHENTICATED" };
  const orgId = session.currentOrganizationId || session.organisationId;
  if (!orgId) return { error: "No organisation context", code: "NO_ORGANISATION" };
  return { session, orgId };
}

/* ============================================================
 * LIST plans (with computed totals)
 * ============================================================ */

export async function getProductionPlans(): Promise<ActionResult<ProductionPlanListItem[]>> {
  const r = await requireOrgSession();
  if ("error" in r) return { success: false, error: r.error, code: r.code };
  const { orgId } = r;

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plans, error } = await (supabase as any)
    .from("production_plans")
    .select(`
      id, name, description, created_at, updated_at,
      production_plan_packages(
        inventory_package_id,
        inventory_packages(pieces, volume_m3)
      )
    `)
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message, code: "QUERY_FAILED" };
  }

  const items: ProductionPlanListItem[] = (plans ?? []).map((row: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    production_plan_packages?: { inventory_packages?: { pieces: string | null; volume_m3: number | null } | null }[];
  }) => {
    let totalPieces = 0;
    let totalVolumeM3 = 0;
    const linkRows = row.production_plan_packages ?? [];
    for (const link of linkRows) {
      const pkg = link.inventory_packages;
      if (!pkg) continue;
      const pcs = parseInt(pkg.pieces ?? "0", 10);
      if (!isNaN(pcs)) totalPieces += pcs;
      totalVolumeM3 += Number(pkg.volume_m3) || 0;
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      packageCount: linkRows.length,
      totalPieces,
      totalVolumeM3,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  return { success: true, data: items };
}

/* ============================================================
 * READ one plan (with packages + reference joins for display)
 * ============================================================ */

export async function getProductionPlan(planId: string): Promise<ActionResult<ProductionPlanDetail>> {
  const r = await requireOrgSession();
  if ("error" in r) return { success: false, error: r.error, code: r.code };
  const { session, orgId } = r;

  if (!UUID_REGEX.test(planId)) {
    return { success: false, error: "Invalid plan id", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan, error: planError } = await (supabase as any)
    .from("production_plans")
    .select("id, organisation_id, name, description, created_at, updated_at")
    .eq("id", planId)
    .single();

  if (planError || !plan) {
    return { success: false, error: "Plan not found", code: "NOT_FOUND" };
  }
  if (isOrganisationUser(session) && plan.organisation_id !== orgId) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pkgs, error: pkgError } = await (supabase as any)
    .from("production_plan_packages")
    .select(`
      sort_order, added_at,
      inventory_packages!inner(
        id, package_number, pieces, volume_m3, notes,
        shipments!inventory_packages_shipment_id_fkey(shipment_code),
        ref_product_names!inventory_packages_product_name_id_fkey(value),
        ref_wood_species!inventory_packages_wood_species_id_fkey(value),
        ref_humidity!inventory_packages_humidity_id_fkey(value),
        ref_types!inventory_packages_type_id_fkey(value),
        ref_processing!inventory_packages_processing_id_fkey(value),
        ref_fsc!inventory_packages_fsc_id_fkey(value),
        ref_quality!inventory_packages_quality_id_fkey(value),
        thickness, width, length
      )
    `)
    .eq("plan_id", planId)
    .order("sort_order", { ascending: true })
    .order("added_at", { ascending: true });

  if (pkgError) {
    return { success: false, error: pkgError.message, code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages: ProductionPlanPackage[] = (pkgs ?? []).map((row: any) => ({
    id: row.inventory_packages?.id,
    packageNumber: row.inventory_packages?.package_number ?? null,
    shipmentCode: row.inventory_packages?.shipments?.shipment_code ?? "",
    productName: row.inventory_packages?.ref_product_names?.value ?? null,
    woodSpecies: row.inventory_packages?.ref_wood_species?.value ?? null,
    humidity: row.inventory_packages?.ref_humidity?.value ?? null,
    typeName: row.inventory_packages?.ref_types?.value ?? null,
    processing: row.inventory_packages?.ref_processing?.value ?? null,
    fsc: row.inventory_packages?.ref_fsc?.value ?? null,
    quality: row.inventory_packages?.ref_quality?.value ?? null,
    thickness: row.inventory_packages?.thickness ?? null,
    width: row.inventory_packages?.width ?? null,
    length: row.inventory_packages?.length ?? null,
    pieces: row.inventory_packages?.pieces ?? null,
    volumeM3: row.inventory_packages?.volume_m3 != null ? Number(row.inventory_packages.volume_m3) : null,
    notes: row.inventory_packages?.notes ?? null,
  }));

  return {
    success: true,
    data: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      organisationId: plan.organisation_id,
      createdAt: plan.created_at,
      updatedAt: plan.updated_at,
      packages,
    },
  };
}

/* ============================================================
 * CREATE plan
 * ============================================================ */

export async function createProductionPlan(input: {
  name: string;
  description?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const r = await requireOrgSession();
  if ("error" in r) return { success: false, error: r.error, code: r.code };
  const { session, orgId } = r;

  const name = input.name?.trim();
  if (!name) {
    return { success: false, error: "Name is required", code: "VALIDATION_FAILED" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("production_plans")
    .insert({
      organisation_id: orgId,
      name,
      description: input.description?.trim() || null,
      created_by: session.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Insert failed", code: "INSERT_FAILED" };
  }

  revalidatePath("/production");
  return { success: true, data: { id: data.id } };
}

/* ============================================================
 * UPDATE plan name / description
 * ============================================================ */

export async function updateProductionPlan(
  planId: string,
  patch: { name?: string; description?: string | null }
): Promise<ActionResult<{ id: string }>> {
  const r = await requireOrgSession();
  if ("error" in r) return { success: false, error: r.error, code: r.code };
  const { session, orgId } = r;

  if (!UUID_REGEX.test(planId)) {
    return { success: false, error: "Invalid plan id", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan } = await (supabase as any)
    .from("production_plans")
    .select("organisation_id")
    .eq("id", planId)
    .single();
  if (!plan) return { success: false, error: "Plan not found", code: "NOT_FOUND" };
  if (isOrganisationUser(session) && plan.organisation_id !== orgId) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: any = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { success: false, error: "Name cannot be empty", code: "VALIDATION_FAILED" };
    updatePayload.name = trimmed;
  }
  if (patch.description !== undefined) {
    updatePayload.description = patch.description?.trim() || null;
  }

  if (Object.keys(updatePayload).length === 0) {
    return { success: true, data: { id: planId } };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("production_plans")
    .update(updatePayload)
    .eq("id", planId);
  if (error) {
    return { success: false, error: error.message, code: "UPDATE_FAILED" };
  }

  revalidatePath(`/production/plans/${planId}`);
  revalidatePath("/production");
  return { success: true, data: { id: planId } };
}

/* ============================================================
 * DELETE plan (cascades to junction rows)
 * ============================================================ */

export async function deleteProductionPlan(planId: string): Promise<ActionResult<{ id: string }>> {
  const r = await requireOrgSession();
  if ("error" in r) return { success: false, error: r.error, code: r.code };
  const { session, orgId } = r;

  if (!UUID_REGEX.test(planId)) {
    return { success: false, error: "Invalid plan id", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan } = await (supabase as any)
    .from("production_plans")
    .select("organisation_id")
    .eq("id", planId)
    .single();
  if (!plan) return { success: false, error: "Plan not found", code: "NOT_FOUND" };
  if (isOrganisationUser(session) && plan.organisation_id !== orgId) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("production_plans")
    .delete()
    .eq("id", planId);
  if (error) {
    return { success: false, error: error.message, code: "DELETE_FAILED" };
  }

  revalidatePath("/production");
  return { success: true, data: { id: planId } };
}

/* ============================================================
 * ADD packages to plan
 * ============================================================ */

export async function addPackagesToPlan(
  planId: string,
  packageIds: string[]
): Promise<ActionResult<{ added: number }>> {
  const r = await requireOrgSession();
  if ("error" in r) return { success: false, error: r.error, code: r.code };
  const { session, orgId } = r;

  if (!UUID_REGEX.test(planId) || packageIds.length === 0) {
    return { success: false, error: "Invalid input", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan } = await (supabase as any)
    .from("production_plans")
    .select("organisation_id")
    .eq("id", planId)
    .single();
  if (!plan) return { success: false, error: "Plan not found", code: "NOT_FOUND" };
  if (isOrganisationUser(session) && plan.organisation_id !== orgId) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Get current max sort_order to append new rows at the end.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("production_plan_packages")
    .select("sort_order, inventory_package_id")
    .eq("plan_id", planId);
  const existingIds = new Set<string>((existing ?? []).map((r: { inventory_package_id: string }) => r.inventory_package_id));
  let nextSort =
    (existing ?? []).reduce(
      (max: number, r: { sort_order: number }) => Math.max(max, r.sort_order ?? 0),
      0
    ) + 1;

  const rows = packageIds
    .filter((id) => !existingIds.has(id))
    .map((inventory_package_id) => ({
      plan_id: planId,
      inventory_package_id,
      sort_order: nextSort++,
    }));

  if (rows.length === 0) {
    return { success: true, data: { added: 0 } };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("production_plan_packages")
    .insert(rows);
  if (error) {
    return { success: false, error: error.message, code: "INSERT_FAILED" };
  }

  revalidatePath(`/production/plans/${planId}`);
  revalidatePath("/production");
  return { success: true, data: { added: rows.length } };
}

/* ============================================================
 * REMOVE package from plan
 * ============================================================ */

export async function removePackageFromPlan(
  planId: string,
  packageId: string
): Promise<ActionResult<{ removed: true }>> {
  const r = await requireOrgSession();
  if ("error" in r) return { success: false, error: r.error, code: r.code };
  const { session, orgId } = r;

  if (!UUID_REGEX.test(planId) || !UUID_REGEX.test(packageId)) {
    return { success: false, error: "Invalid input", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan } = await (supabase as any)
    .from("production_plans")
    .select("organisation_id")
    .eq("id", planId)
    .single();
  if (!plan) return { success: false, error: "Plan not found", code: "NOT_FOUND" };
  if (isOrganisationUser(session) && plan.organisation_id !== orgId) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("production_plan_packages")
    .delete()
    .eq("plan_id", planId)
    .eq("inventory_package_id", packageId);
  if (error) {
    return { success: false, error: error.message, code: "DELETE_FAILED" };
  }

  revalidatePath(`/production/plans/${planId}`);
  revalidatePath("/production");
  return { success: true, data: { removed: true } };
}
