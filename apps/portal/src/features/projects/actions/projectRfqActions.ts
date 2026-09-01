"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../../orders/types";
import { getOrderDeal } from "../../orders/services/orderDeals";
import { resolveProjectsActor } from "../access";
import { mapAwardRfqError, mapCreateRfqError } from "../services/projectRfq";
import type { ProjectQuotationPricingMode } from "../services/projectQuotationRows";

const uuid = z.string().uuid();
const requestSchema = z.object({ projectId: uuid, candidateIds: z.array(uuid).min(2).max(20), deadline: z.coerce.date().refine((value) => value.getTime() > Date.now(), "Deadline must be in the future") });
const quoteEntrySchema=z.object({targetType:z.enum(["line","process"]),targetId:uuid,label:z.string().trim().min(1).max(200),quantity:z.coerce.number().finite().positive(),unit:z.string().trim().max(50),unitPriceCents:z.coerce.number().int().nonnegative().max(2147483647)});
const quoteSchema = z.object({ candidateId: uuid, pricingMode:z.enum(["itemized","total"]), entries:z.array(quoteEntrySchema).max(500), totalCents:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(), notes: z.string().trim().max(4000).optional().default("") }).superRefine((input,context)=>{
  if(input.pricingMode==="itemized"&&(input.entries.length<1||input.totalCents!==null))context.addIssue({code:"custom",message:"Itemized quotations require prices and cannot include a project total"});
  if(input.pricingMode==="total"&&(input.entries.length!==0||input.totalCents===null))context.addIssue({code:"custom",message:"Total quotations require one project total and cannot include line prices"});
});
const adminQuoteSchema = quoteSchema;
const awardSchema = z.object({ projectId: uuid, rfqId: uuid, candidateId: uuid });
const directQuoteSchema = z.object({ projectId: uuid });
const marginSchema = z.object({
  projectId: uuid,
  mode: z.enum(["amount", "percentage"]),
  value: z.coerce.number().finite().nonnegative(),
}).superRefine((input, context) => {
  if (input.mode === "percentage" && input.value > 99.99) {
    context.addIssue({ code: "custom", path: ["value"], message: "Margin percentage must not exceed 99.99%" });
  }
});

export type ProjectRfqCandidate = { id: string; organisationId: string; organisationName: string; status: "invited"|"submitted"|"awarded"|"not_awarded"; pricingMode:ProjectQuotationPricingMode|null; quoteTotalCents: number|null; quoteNotes: string|null; submittedAt: string|null; updatedAt:string|null; submitterName:string|null; quoteEnteredAsAdmin:boolean; quoteEntries:ProjectQuoteEntry[] };
export type ProjectQuoteEntry=z.infer<typeof quoteEntrySchema>;
export type ProjectCommercialPricing = { purchaseCostCents:number; marginAmountCents:number|null; marginPercent:number|null; salesAmountCents:number|null };
export type ProjectRfqState = { id: string; deadline: string; status: "open"|"awarded"|"cancelled"; ownerOrganisationId: string; candidates: ProjectRfqCandidate[]; canManage: boolean; ownCandidateId: string|null; commercialPricing?:ProjectCommercialPricing };

export async function getEligibleProjectRfqCandidates(projectId: string): Promise<ActionResult<Array<{id:string;name:string}>>> {
  const owner=await requireOwner(projectId); if(!owner)return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  const admin = createAdminClient();
  const {data,error}=await admin.from("organisations").select("id,name,is_active,is_trader,is_supplier,is_producer,is_manufacturer").eq("is_active",true).neq("id",owner.project.buyer.id).order("name");
  if(error)return{success:false,error:"Could not load candidates",code:"FETCH_FAILED"};
  return{success:true,data:((data??[]) as Array<Record<string,unknown>>).filter((org)=>org.is_trader||org.is_supplier||org.is_producer||org.is_manufacturer).map((org)=>({id:org.id as string,name:org.name as string}))};
}

async function requireOwner(projectId: string) {
  const a = await resolveProjectsActor();
  if (!a.ok) return null;
  const project = await getOrderDeal(a.db, a.actor, projectId);
  if (!project.success) return null;
  if (!project.data.buyer.id || project.data.seller.id) return null;
  if (!a.isPlatformAdmin) {
    if (a.orgId !== project.data.buyer.id) return null;
    const { data: ownOrg } = await a.db.from("organisations").select("is_trader,is_active").eq("id",a.orgId).maybeSingle();
    if (!ownOrg?.is_active || !ownOrg.is_trader) return null;
  }
  return { a, project: project.data };
}

async function requireAwardManager(projectId: string) {
  const a = await resolveProjectsActor();
  if (!a.ok) return null;
  const project = await getOrderDeal(a.db, a.actor, projectId);
  if (!project.success || !project.data.buyer.id) return null;
  if (!a.isPlatformAdmin) {
    if (a.orgId !== project.data.buyer.id) return null;
    const { data: ownOrg } = await a.db.from("organisations").select("is_trader,is_active").eq("id", a.orgId).maybeSingle();
    if (!ownOrg?.is_active || !ownOrg.is_trader) return null;
  }
  return { a, project: project.data };
}

export async function getProjectRfqState(projectId: string): Promise<ActionResult<ProjectRfqState|null>> {
  if (!uuid.safeParse(projectId).success) return { success:false,error:"Invalid project",code:"VALIDATION_ERROR" };
  const a = await resolveProjectsActor();
  if (!a.ok) return { success:false,error:"Not allowed",code:"FORBIDDEN" };
  const { data: rfq, error } = await a.db.from("project_rfqs").select("id, organization_id, deadline, status").eq("order_id",projectId).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if (error) return { success:false,error:"Could not load RFQ",code:"FETCH_FAILED" };
  if (!rfq) return { success:true,data:null };
  const row = rfq as Record<string,unknown>;
  const canManage = a.isPlatformAdmin || (a.orgId != null && row.organization_id === a.orgId);
  const candidateDb = canManage ? createAdminClient() : a.db;
  let { data: candidates, error: candidateError } = await candidateDb.from("project_rfq_candidates").select("id, organization_id, status, pricing_mode, quote_total_cents, quote_notes, submitted_at, updated_at, quote_entered_by, quote_entered_as_admin, quote_entries, organisations!inner(name)").eq("rfq_id",row.id).order("created_at");
  if(candidateError&&/quote_entries|pricing_mode/.test(candidateError.message)){const legacy=await candidateDb.from("project_rfq_candidates").select("id, organization_id, status, quote_total_cents, quote_notes, submitted_at, organisations!inner(name)").eq("rfq_id",row.id).order("created_at");candidates=legacy.data;candidateError=legacy.error}
  if (candidateError) return { success:false,error:"Could not load RFQ candidates",code:"FETCH_FAILED" };
  const enteredByIds=[...new Set(((candidates??[]) as Array<Record<string,unknown>>).map((candidate)=>candidate.quote_entered_by).filter((id):id is string=>typeof id==="string"))];
  const submitterNames=new Map<string,string>();if(enteredByIds.length){const{data:users}=await createAdminClient().from("portal_users").select("id,name").in("id",enteredByIds);for(const user of (users??[]) as Array<{id:string;name:string|null}>)if(user.name)submitterNames.set(user.id,user.name)}
  const mapped:ProjectRfqCandidate[] = ((candidates??[]) as Array<Record<string,unknown>>).map((candidate)=>({ id:candidate.id as string, organisationId:candidate.organization_id as string, organisationName:(candidate.organisations as Record<string,unknown>).name as string, status:candidate.status as ProjectRfqCandidate["status"], pricingMode:candidate.pricing_mode==="itemized"||candidate.pricing_mode==="total"?candidate.pricing_mode:null, quoteTotalCents:candidate.quote_total_cents==null?null:Number(candidate.quote_total_cents), quoteNotes:candidate.quote_notes as string|null, submittedAt:candidate.submitted_at as string|null,updatedAt:candidate.updated_at as string|null,submitterName:typeof candidate.quote_entered_by==="string"?submitterNames.get(candidate.quote_entered_by)??null:null,quoteEnteredAsAdmin:candidate.quote_entered_as_admin===true,quoteEntries:quoteEntries(candidate.quote_entries) }));
  let commercialPricing:ProjectCommercialPricing|undefined;
  if(canManage&&row.status==="awarded"){
    const winner=mapped.find((candidate)=>candidate.status==="awarded");
    const {data:order,error:pricingError}=await candidateDb.from("orders").select("margin_amount_cents,margin_percent,resale_value_cents").eq("id",projectId).is("deleted_at",null).maybeSingle();
    if(pricingError)return{success:false,error:"Could not load trader margin",code:"FETCH_FAILED"};
    if(winner?.quoteTotalCents!=null&&order)commercialPricing={purchaseCostCents:winner.quoteTotalCents,marginAmountCents:order.margin_amount_cents==null?null:Number(order.margin_amount_cents),marginPercent:order.margin_percent==null?null:Number(order.margin_percent),salesAmountCents:order.resale_value_cents==null?null:Number(order.resale_value_cents)};
  }
  return { success:true,data:{ id:row.id as string, deadline:row.deadline as string, status:row.status as ProjectRfqState["status"], ownerOrganisationId:row.organization_id as string, candidates:mapped, canManage, ownCandidateId:mapped.find((candidate)=>candidate.organisationId===a.orgId)?.id??null,...(commercialPricing?{commercialPricing}:{}) } };
}

function quoteEntries(value:unknown):ProjectQuoteEntry[]{if(!Array.isArray(value))return[];return value.flatMap((entry)=>{const parsed=quoteEntrySchema.safeParse(entry);return parsed.success?[parsed.data]:[]})}

export async function requestProjectQuotations(raw: unknown): Promise<ActionResult<{id:string}>> {
  const parsed=requestSchema.safeParse(raw); if(!parsed.success)return{success:false,error:parsed.error.issues[0]?.message??"Invalid RFQ",code:"VALIDATION_ERROR"};
  if(new Set(parsed.data.candidateIds).size!==parsed.data.candidateIds.length)return{success:false,error:"Candidates must be unique",code:"VALIDATION_ERROR"};
  const owner=await requireOwner(parsed.data.projectId); if(!owner)return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  const {data,error}=await owner.a.db.rpc("create_project_rfq",{p_order_id:parsed.data.projectId,p_candidate_ids:parsed.data.candidateIds,p_deadline:parsed.data.deadline.toISOString()});
  if(error)return{success:false,...mapCreateRfqError(error.message)}; revalidatePath(`/projects/${parsed.data.projectId}`); return{success:true,data:{id:data as string}};
}
export async function initializeDirectProjectQuotation(raw: unknown): Promise<ActionResult<{rfqId:string;candidateId:string}>> {
  const parsed=directQuoteSchema.safeParse(raw);if(!parsed.success)return{success:false,error:"Invalid project",code:"VALIDATION_ERROR"};
  const a=await resolveProjectsActor();if(!a.ok||!a.isPlatformAdmin)return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  const {data,error}=await a.db.rpc("initialize_direct_project_quotation",{p_order_id:parsed.data.projectId});
  if(error){
    if(/seller.*required|seller.*eligible|self deal/i.test(error.message))return{success:false,error:"Assign an active eligible seller before creating its quotation",code:"VALIDATION_ERROR"};
    if(/forbidden/i.test(error.message))return{success:false,error:"Not allowed",code:"FORBIDDEN"};
    return{success:false,error:"Could not create supplier quotation",code:"UPDATE_FAILED"};
  }
  const result=data as Record<string,unknown>;
  if(typeof result?.rfqId!=="string"||typeof result?.candidateId!=="string")return{success:false,error:"Quotation identifiers were not returned",code:"UPDATE_FAILED"};
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return{success:true,data:{rfqId:result.rfqId,candidateId:result.candidateId}};
}
export async function submitProjectQuotation(raw: unknown): Promise<ActionResult<true>> {
  const parsed=quoteSchema.safeParse(raw); if(!parsed.success)return{success:false,error:parsed.error.issues[0]?.message??"Invalid quotation",code:"VALIDATION_ERROR"};
  const a=await resolveProjectsActor(); if(!a.ok||(!a.orgId&&!a.isPlatformAdmin))return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  const {error}=await a.db.rpc("submit_project_rfq_quote_entries",{p_candidate_id:parsed.data.candidateId,p_pricing_mode:parsed.data.pricingMode,p_entries:parsed.data.entries,p_total_cents:parsed.data.totalCents,p_notes:parsed.data.notes});
  if(!error)return{success:true,data:true};
  return{success:false,error:"Could not submit quotation",code:"SUBMIT_FAILED"};
}
export async function correctProjectQuotation(raw:unknown):Promise<ActionResult<true>>{
  const parsed=adminQuoteSchema.safeParse(raw);if(!parsed.success)return{success:false,error:parsed.error.issues[0]?.message??"Invalid quotation",code:"VALIDATION_ERROR"};
  const a=await resolveProjectsActor();if(!a.ok||!a.isPlatformAdmin)return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  const{error}=await a.db.rpc("correct_project_rfq_quote_entries",{p_candidate_id:parsed.data.candidateId,p_pricing_mode:parsed.data.pricingMode,p_entries:parsed.data.entries,p_total_cents:parsed.data.totalCents,p_notes:parsed.data.notes});
  if(error)return{success:false,error:"Could not correct quotation",code:"UPDATE_FAILED"};return{success:true,data:true};
}
export async function awardProjectQuotation(raw: unknown): Promise<ActionResult<{projectId:string}>> {
  const parsed=awardSchema.safeParse(raw); if(!parsed.success)return{success:false,error:"Invalid award",code:"VALIDATION_ERROR"};
  const owner=await requireAwardManager(parsed.data.projectId); if(!owner)return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  const { data: rfq, error: lookupError } = await owner.a.db.from("project_rfqs").select("id").eq("id",parsed.data.rfqId).eq("order_id",parsed.data.projectId).maybeSingle();
  if (lookupError || !rfq) return { success:false,error:"Quotation request not found",code:"NOT_FOUND" };
  const {data,error}=await owner.a.db.rpc("award_project_rfq",{p_rfq_id:parsed.data.rfqId,p_candidate_id:parsed.data.candidateId});
  if(error)return{success:false,...mapAwardRfqError(error.message)}; revalidatePath(`/projects/${parsed.data.projectId}`); return{success:true,data:{projectId:data as string}};
}

export async function saveProjectAwardedMargin(raw: unknown): Promise<ActionResult<ProjectCommercialPricing>> {
  const parsed=marginSchema.safeParse(raw);
  if(!parsed.success)return{success:false,error:parsed.error.issues[0]?.message??"Invalid margin",code:"VALIDATION_ERROR"};
  const a=await resolveProjectsActor();
  if(!a.ok)return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  const project=await getOrderDeal(a.db,a.actor,parsed.data.projectId);
  if(!project.success||!project.data.buyer.id)return{success:false,error:"Project leg not found",code:"NOT_FOUND"};
  const buyerId=project.data.buyer.id;
  if(!a.isPlatformAdmin&&a.orgId!==buyerId)return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  if(!a.isPlatformAdmin){
    const {data:buyer}=await a.db.from("organisations").select("is_active,is_trader").eq("id",buyerId).maybeSingle();
    if(!buyer?.is_active||!buyer.is_trader)return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  }
  const rpcValue=parsed.data.mode==="amount"?Math.round(parsed.data.value*100):parsed.data.value;
  if(!Number.isSafeInteger(rpcValue)&&parsed.data.mode==="amount")return{success:false,error:"Margin is too large",code:"VALIDATION_ERROR"};
  const {data,error}=await a.db.rpc("set_project_awarded_margin",{p_order_id:parsed.data.projectId,p_mode:parsed.data.mode,p_value:rpcValue});
  if(error){
    if(/forbidden/i.test(error.message))return{success:false,error:"Not allowed",code:"FORBIDDEN"};
    if(/awarded quotation required/i.test(error.message.replaceAll("_"," ")))return{success:false,error:"An awarded quotation is required",code:"CONFLICT"};
    return{success:false,error:/margin/i.test(error.message)?"Enter a valid margin":"Could not save trader margin",code:"VALIDATION_ERROR"};
  }
  const result=data as Record<string,unknown>;
  const commercialPricing={purchaseCostCents:Number(result.purchaseCostCents),marginAmountCents:Number(result.marginAmountCents),marginPercent:Number(result.marginPercent),salesAmountCents:Number(result.salesAmountCents)};
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath("/projects");
  return{success:true,data:commercialPricing};
}

export async function cancelProjectQuotationRequest(raw: unknown): Promise<ActionResult<true>> {
  const parsed=z.object({projectId:uuid,rfqId:uuid}).safeParse(raw);
  if(!parsed.success)return{success:false,error:"Invalid quotation request",code:"VALIDATION_ERROR"};
  const owner=await requireOwner(parsed.data.projectId); if(!owner)return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  const { data: rfq, error: lookupError } = await owner.a.db.from("project_rfqs").select("id").eq("id",parsed.data.rfqId).eq("order_id",parsed.data.projectId).maybeSingle();
  if(lookupError||!rfq)return{success:false,error:"Quotation request not found",code:"NOT_FOUND"};
  const {error}=await owner.a.db.rpc("cancel_project_rfq",{p_rfq_id:parsed.data.rfqId});
  if(error)return{success:false,error:"Could not close quotation request",code:"CANCEL_FAILED"};
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return{success:true,data:true};
}
