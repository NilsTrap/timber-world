"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "../../orders/types";
import { createDeal, getOrderDeal } from "../../orders/services/orderDeals";
import type { DbClient } from "../../orders/services/dealModel";
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
  if (origin.data.lifecycleStage !== "draft") return { success: false, error: "Buyer can only be changed while the project is a draft", code: "NOT_DRAFT" };
  if (origin.data.buyer.id === input.buyerOrganisationId) return { success: true, data: { dealCode: origin.data.dealCode } };
  if (origin.data.seller.id === input.buyerOrganisationId) return { success: false, error: "Buyer and seller must be different companies", code: "SELF_DEAL" };
  if (!a.isPlatformAdmin) {
    const { data: ownOrg } = await a.db.from("organisations").select("is_trader, is_active").eq("id", a.orgId).maybeSingle();
    if (!(ownOrg as { is_trader?: boolean; is_active?: boolean } | null)?.is_trader || !(ownOrg as { is_active?: boolean } | null)?.is_active) {
      return { success: false, error: "Only an active trader can assign the buyer", code: "FORBIDDEN" };
    }
  }
  const { data: selected } = await a.db.from("organisations").select("id, is_customer, is_active").eq("id", input.buyerOrganisationId).maybeSingle();
  const buyerOrg = selected as { id: string; is_customer: boolean; is_active: boolean } | null;
  if (!buyerOrg?.is_active || !buyerOrg.is_customer) return { success: false, error: "Selected company is not an eligible buyer", code: "VALIDATION_ERROR" };
  if (!a.isPlatformAdmin) {
    const { data: relation } = await a.db.from("organisation_trading_partners").select("partner_organisation_id")
      .eq("organisation_id", origin.data.seller.id).eq("partner_organisation_id", input.buyerOrganisationId).maybeSingle();
    if (!relation) return { success: false, error: "Selected company is not this trader's trading partner", code: "FORBIDDEN" };
  }
  const { data: corrected, error } = await a.db.rpc("correct_project_parties", { p_project_id: input.projectId, p_buyer_id: input.buyerOrganisationId, p_trader_id: null });
  if (error) return { success: false, error: projectLegSellerError(error.message), code: "UPDATE_FAILED" };
  await logProjectPartyChange(a.db, input.projectId, a.portalUserId, origin.data.buyer.id ? "Buyer changed" : "Buyer assigned");
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath(`/orders/${input.projectId}`);
  return { success: true, data: { dealCode: (corrected as { dealCode?: string } | null)?.dealCode ?? null } };
}

/** Platform-admin correction of Trader 1. The bilateral sell leg and its adjacent
 * purchase leg are kept consistent; no hidden downstream party is exposed. */
export async function setProjectCenter(input: { projectId: string; traderOrganisationId: string }): Promise<ActionResult<{ dealCode: string | null }>> {
  if (!isValidUUID(input.projectId) || !isValidUUID(input.traderOrganisationId)) return { success: false, error: "Invalid party selection", code: "VALIDATION_ERROR" };
  const a = await resolveProjectsActor();
  if (!a.ok || !a.isPlatformAdmin) return { success: false, error: "Only a platform admin can change the represented trader", code: "FORBIDDEN" };
  const origin = await getOrderDeal(a.db, a.actor, input.projectId);
  if (!origin.success) return { success: false, error: "Project not found", code: "NOT_FOUND" };
  if (origin.data.dealKind === "purchase_only") return { success: false, error: "Only the root selling project can change Trader 1", code: "VALIDATION_ERROR" };
  if (origin.data.lifecycleStage !== "draft") return { success: false, error: "The represented trader can only be changed while the project is a draft", code: "NOT_DRAFT" };
  const oldCenterId = origin.data.seller.id;
  if (!oldCenterId) return { success: false, error: "Project has no represented trader", code: "VALIDATION_ERROR" };
  if (origin.data.buyer.id === input.traderOrganisationId) return { success: false, error: "Buyer and seller must be different companies", code: "SELF_DEAL" };
  if (oldCenterId === input.traderOrganisationId) return { success: true, data: { dealCode: origin.data.dealCode } };
  const { data: selected } = await a.db.from("organisations").select("id, is_trader, is_active").eq("id", input.traderOrganisationId).maybeSingle();
  const trader = selected as { id: string; is_trader: boolean; is_active: boolean } | null;
  if (!trader?.is_active || !trader.is_trader) return { success: false, error: "Selected company is not an active trader", code: "VALIDATION_ERROR" };

  const { data: corrected, error } = await a.db.rpc("correct_project_parties", { p_project_id: input.projectId, p_buyer_id: null, p_trader_id: input.traderOrganisationId });
  if (error) return { success: false, error: error.message, code: "UPDATE_FAILED" };
  await logProjectPartyChange(a.db, input.projectId, a.portalUserId, "Represented trader changed");
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath(`/orders/${input.projectId}`);
  const linkedId = (corrected as { linkedProjectId?: string | null } | null)?.linkedProjectId ?? null;
  if (linkedId) { revalidatePath(`/projects/${linkedId}`); revalidatePath(`/orders/${linkedId}`); }
  return { success: true, data: { dealCode: (corrected as { dealCode?: string } | null)?.dealCode ?? null } };
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
  if (origin.data.lifecycleStage !== "draft") return { success: false, error: "The chain can only be extended while the project is a draft", code: "NOT_DRAFT" };
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
  let appendOriginId = input.projectId;
  let appendBuyerId = centerOrgId;
  let traderCount = 1;
  if (origin.data.spineId) {
    const { data, error } = await client.from("orders").select("id, deal_code, buyer_organisation_id, seller_organisation_id, lifecycle_stage, created_at")
      .eq("spine_id", origin.data.spineId).is("deleted_at",null).neq("id", input.projectId).neq("lifecycle_stage", "cancelled").order("created_at", { ascending: true });
    if (error) return { success: false, error: "Could not read the project chain", code: "QUERY_FAILED" };
    const remaining = [...((data ?? []) as Array<{ id: string; deal_code: string | null; buyer_organisation_id: string; seller_organisation_id: string; lifecycle_stage: string }>)];
    while (true) {
      const matches = remaining.filter((leg) => leg.buyer_organisation_id === appendBuyerId);
      if (matches.length > 1) return { success: false, error: "The project chain is ambiguous", code: "CONFLICT" };
      const leg = matches[0];
      if (!leg) break;
      remaining.splice(remaining.indexOf(leg), 1);
      if (leg.seller_organisation_id === input.sellerOrganisationId) return { success: true, data: { id: leg.id, dealCode: leg.deal_code } };
      const { data: org } = await client.from("organisations").select("is_trader").eq("id", leg.seller_organisation_id).maybeSingle();
      if (!(org as { is_trader?: boolean } | null)?.is_trader) {
        return { success: false, error: "This project chain already ends with a supplier", code: "ALREADY_SET" };
      }
      if (traderCount >= 2) return { success: false, error: "This project already contains two traders", code: "CONFLICT" };
      appendOriginId = leg.id;
      appendBuyerId = leg.seller_organisation_id;
      traderCount += 1;
      if (leg.lifecycle_stage !== "draft") return { success: false, error: "The next leg can only be extended while it is a draft", code: "NOT_DRAFT" };
      if (!a.isPlatformAdmin) return { success: false, error: "This project already has a seller assigned", code: "ALREADY_SET" };
    }
  }
  const { data: selected } = await client.from("organisations")
    .select("id, is_trader, is_supplier, is_producer, is_active")
    .eq("id", input.sellerOrganisationId).maybeSingle();
  const party = selected as { id: string; is_trader: boolean; is_supplier: boolean; is_producer: boolean; is_active: boolean } | null;
  if (!party?.is_active || !(party.is_trader || party.is_supplier || party.is_producer)) return { success: false, error: "Selected company is not an eligible seller", code: "VALIDATION_ERROR" };
  if (party.is_trader && traderCount >= 2) return { success: false, error: "A project can contain at most two traders", code: "VALIDATION_ERROR" };
  if (appendBuyerId === input.sellerOrganisationId) return { success: false, error: "Buyer and seller must be different companies", code: "SELF_DEAL" };
  if (!a.isPlatformAdmin) {
    const { data: relation } = await client.from("organisation_trading_partners").select("partner_organisation_id")
      .eq("organisation_id", appendBuyerId).eq("partner_organisation_id", input.sellerOrganisationId).maybeSingle();
    if (!relation) return { success: false, error: "Selected company is not your trading partner", code: "FORBIDDEN" };
  }

  const created = await createDeal(a.db, a.actor, {
    originDealId: appendOriginId,
    copyLines: true,
    name: origin.data.name ? `${origin.data.name} - purchase` : "Purchase leg",
    customerOrganisationId: appendBuyerId,
    buyerOrganisationId: appendBuyerId,
    sellerOrganisationId: input.sellerOrganisationId,
    dealKind: "purchase_only",
    idempotencyKey: `project-seller:${appendOriginId}:${input.sellerOrganisationId}`,
  });
  if (!created.success) return { success: false, error: created.error, code: created.code };
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath(`/projects/${created.data.id}`);
  return { success: true, data: { id: created.data.id, dealCode: created.data.dealCode } };
}

/** Replace the seller on the selected Draft leg. This is deliberately separate
 * from setProjectSeller, which appends a new purchase leg. */
export async function correctProjectLegSeller(input: { projectId: string; sellerOrganisationId: string }): Promise<ActionResult<{ dealCode: string | null }>> {
  if (!isValidUUID(input.projectId) || !isValidUUID(input.sellerOrganisationId)) return { success: false, error: "Invalid party selection", code: "VALIDATION_ERROR" };
  const a = await resolveProjectsActor();
  if (!a.ok || !a.isPlatformAdmin) return { success: false, error: "Only a platform admin can correct a seller", code: "FORBIDDEN" };
  const leg = await getOrderDeal(a.db, a.actor, input.projectId);
  if (!leg.success) return { success: false, error: "Project not found", code: "NOT_FOUND" };
  if (leg.data.lifecycleStage !== "draft") return { success: false, error: "Seller can only be changed while the project is a draft", code: "NOT_DRAFT" };
  if (leg.data.buyer.id === input.sellerOrganisationId) return { success: false, error: "Buyer and seller must be different companies", code: "SELF_DEAL" };
  if (leg.data.seller.id === input.sellerOrganisationId) return { success: true, data: { dealCode: leg.data.dealCode } };
  const { data: selected } = await a.db.from("organisations").select("id, is_trader, is_supplier, is_producer, is_active").eq("id", input.sellerOrganisationId).maybeSingle();
  const seller = selected as { id: string; is_trader: boolean; is_supplier: boolean; is_producer: boolean; is_active: boolean } | null;
  if (!seller?.is_active || !(seller.is_trader || seller.is_supplier || seller.is_producer)) return { success: false, error: "Selected company is not an eligible seller", code: "VALIDATION_ERROR" };
  const { data: corrected, error } = await a.db.rpc("correct_project_leg_seller", { p_project_id: input.projectId, p_seller_id: input.sellerOrganisationId });
  if (error) return { success: false, error: error.message, code: "UPDATE_FAILED" };
  await logProjectPartyChange(a.db, input.projectId, a.portalUserId, "Seller changed");
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath(`/orders/${input.projectId}`);
  const linkedId = (corrected as { linkedProjectId?: string | null } | null)?.linkedProjectId ?? null;
  if (linkedId) { revalidatePath(`/projects/${linkedId}`); revalidatePath(`/orders/${linkedId}`); }
  return { success: true, data: { dealCode: (corrected as { dealCode?: string | null } | null)?.dealCode ?? null } };
}

function projectLegSellerError(message: string): string {
  if (message.includes("Seller already belongs")) return "That company already belongs to this project spine";
  if (message.includes("Ambiguous downstream")) return "The project chain is ambiguous and cannot be changed safely";
  if (message.includes("linked project must be Draft")) return "The next leg must be a draft before this seller can be changed";
  if (message.includes("Invalid seller")) return "Selected company is not an eligible seller";
  if (message.includes("Buyer and seller must differ") || message.includes("self-deal")) return "Buyer and seller must be different companies";
  return "Could not update the seller";
}

async function logProjectPartyChange(db: DbClient, projectId: string, userId: string | null, action: string): Promise<void> {
  try {
    await db.from("order_activity_log").insert({ order_id: projectId, user_id: userId, action, details: null, tab: "list" });
  } catch { /* audit failure must not undo the authorized party correction */ }
}
