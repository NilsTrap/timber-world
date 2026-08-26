"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "../../orders/types";
import { createDeal, getOrderDeal } from "../../orders/services/orderDeals";
import { setDealParties } from "../../orders/actions/setDealParties";
import { resolveProjectsActor } from "../access";
import { isValidUUID } from "../../orders/types";

export async function setProjectBuyer(input: { projectId: string; buyerOrganisationId: string }): Promise<ActionResult<{ dealCode: string | null }>> {
  if (!isValidUUID(input.projectId) || !isValidUUID(input.buyerOrganisationId)) return { success: false, error: "Invalid party selection", code: "VALIDATION_ERROR" };
  const a = await resolveProjectsActor();
  if (!a.ok || (!a.isPlatformAdmin && (!a.profile.actions.has("deal:create") || !a.access.domainVisible("customer_identity")))) {
    return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  }
  const origin = await getOrderDeal(a.db, a.actor, input.projectId);
  if (!origin.success) return { success: false, error: "Project not found", code: "NOT_FOUND" };
  if (!origin.data.seller.id || (!a.isPlatformAdmin && origin.data.seller.id !== a.orgId)) {
    return { success: false, error: "Only the represented trader can assign the buyer", code: "FORBIDDEN" };
  }
  if (!a.isPlatformAdmin) {
    const { data: ownOrg } = await a.db.from("organisations").select("is_trader, is_active").eq("id", a.orgId).maybeSingle();
    if (!(ownOrg as { is_trader?: boolean; is_active?: boolean } | null)?.is_trader || !(ownOrg as { is_active?: boolean } | null)?.is_active) {
      return { success: false, error: "Only an active trader can assign the buyer", code: "FORBIDDEN" };
    }
  }
  const result = await setDealParties({ orderId: input.projectId, customerOrganisationId: input.buyerOrganisationId });
  if (result.success) revalidatePath(`/projects/${input.projectId}`);
  return result;
}

export async function setProjectSeller(input: { projectId: string; sellerOrganisationId: string }): Promise<ActionResult<{ id: string; dealCode: string | null }>> {
  if (!isValidUUID(input.projectId) || !isValidUUID(input.sellerOrganisationId)) return { success: false, error: "Invalid party selection", code: "VALIDATION_ERROR" };
  const a = await resolveProjectsActor();
  if (!a.ok) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  if (!a.isPlatformAdmin && (!a.profile.actions.has("deal:create") || !a.access.domainVisible("supplier_identity"))) {
    return { success: false, error: "Supplier access is not available for this role", code: "FORBIDDEN" };
  }
  const origin = await getOrderDeal(a.db, a.actor, input.projectId);
  if (!origin.success) return { success: false, error: "Project not found", code: "NOT_FOUND" };
  const centerOrgId = origin.data.seller.id;
  if (!centerOrgId || (!a.isPlatformAdmin && a.orgId !== centerOrgId)) return { success: false, error: "Only the represented seller can assign the next seller", code: "FORBIDDEN" };
  if (centerOrgId === input.sellerOrganisationId) return { success: false, error: "Buyer and seller must be different companies", code: "SELF_DEAL" };
  if (!a.isPlatformAdmin) {
    const { data: ownOrg } = await a.db.from("organisations").select("is_trader, is_active").eq("id", centerOrgId).maybeSingle();
    if (!(ownOrg as { is_trader?: boolean; is_active?: boolean } | null)?.is_trader || !(ownOrg as { is_active?: boolean } | null)?.is_active) {
      return { success: false, error: "Only an active trader can assign the next seller", code: "FORBIDDEN" };
    }
  }

  const client = a.db;
  const { data: selected } = await client.from("organisations")
    .select("id, is_trader, is_supplier, is_producer, is_active")
    .eq("id", input.sellerOrganisationId).maybeSingle();
  const party = selected as { id: string; is_trader: boolean; is_supplier: boolean; is_producer: boolean; is_active: boolean } | null;
  if (!party?.is_active || !(party.is_trader || party.is_supplier || party.is_producer)) return { success: false, error: "Selected company is not an eligible seller", code: "VALIDATION_ERROR" };
  if (!a.isPlatformAdmin) {
    const { data: relation } = await client.from("organisation_trading_partners").select("partner_organisation_id")
      .eq("organisation_id", centerOrgId).eq("partner_organisation_id", input.sellerOrganisationId).maybeSingle();
    if (!relation) return { success: false, error: "Selected company is not your trading partner", code: "FORBIDDEN" };
  }

  const spineId = origin.data.spineId;
  if (spineId) {
    const { data: existing } = await client.from("orders").select("id, deal_code, seller_organisation_id")
      .eq("spine_id", spineId).eq("buyer_organisation_id", centerOrgId)
      .neq("id", input.projectId).neq("lifecycle_stage", "cancelled").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (existing) {
      const row = existing as { id: string; deal_code: string | null; seller_organisation_id: string | null };
      if (row.seller_organisation_id !== input.sellerOrganisationId) {
        return { success: false, error: "This project already has a seller assigned", code: "ALREADY_SET" };
      }
      return { success: true, data: { id: row.id, dealCode: row.deal_code } };
    }
  }

  const created = await createDeal(a.db, a.actor, {
    originDealId: input.projectId,
    copyLines: true,
    name: origin.data.name ? `${origin.data.name} - purchase` : "Purchase leg",
    customerOrganisationId: centerOrgId,
    buyerOrganisationId: centerOrgId,
    sellerOrganisationId: input.sellerOrganisationId,
    dealKind: "purchase_only",
    idempotencyKey: `project-seller:${input.projectId}:${input.sellerOrganisationId}`,
  });
  if (!created.success) return { success: false, error: created.error, code: created.code };
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath(`/projects/${created.data.id}`);
  return { success: true, data: { id: created.data.id, dealCode: created.data.dealCode } };
}
