"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../../orders/types";
import { getOrderDeal } from "../../orders/services/orderDeals";
import { resolveProjectsActor } from "../access";
import { mapAwardRfqError, mapCreateRfqError, quoteTotalToCents } from "../services/projectRfq";

const uuid = z.string().uuid();
const requestSchema = z.object({ projectId: uuid, candidateIds: z.array(uuid).min(2).max(20), deadline: z.coerce.date().refine((value) => value.getTime() > Date.now(), "Deadline must be in the future") });
const quoteSchema = z.object({ candidateId: uuid, total: z.coerce.number().finite().nonnegative().max(21474836.47), notes: z.string().trim().max(4000).optional().default("") });
const awardSchema = z.object({ projectId: uuid, rfqId: uuid, candidateId: uuid });

export type ProjectRfqCandidate = { id: string; organisationId: string; organisationName: string; status: "invited"|"submitted"|"awarded"|"not_awarded"; quoteTotalCents: number|null; quoteNotes: string|null; submittedAt: string|null };
export type ProjectRfqState = { id: string; deadline: string; status: "open"|"awarded"|"cancelled"; ownerOrganisationId: string; candidates: ProjectRfqCandidate[]; canManage: boolean; ownCandidateId: string|null };

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
  if (!project.success || project.data.lifecycleStage !== "draft") return null;
  if (!project.data.buyer.id || project.data.seller.id) return null;
  if (!a.isPlatformAdmin) {
    if (a.orgId !== project.data.buyer.id) return null;
    const { data: ownOrg } = await a.db.from("organisations").select("is_trader,is_active").eq("id",a.orgId).maybeSingle();
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
  const { data: candidates, error: candidateError } = await candidateDb.from("project_rfq_candidates").select("id, organization_id, status, quote_total_cents, quote_notes, submitted_at, organisations!inner(name)").eq("rfq_id",row.id).order("created_at");
  if (candidateError) return { success:false,error:"Could not load RFQ candidates",code:"FETCH_FAILED" };
  const mapped = ((candidates??[]) as Array<Record<string,unknown>>).map((candidate)=>({ id:candidate.id as string, organisationId:candidate.organization_id as string, organisationName:(candidate.organisations as Record<string,unknown>).name as string, status:candidate.status as ProjectRfqCandidate["status"], quoteTotalCents:candidate.quote_total_cents==null?null:Number(candidate.quote_total_cents), quoteNotes:candidate.quote_notes as string|null, submittedAt:candidate.submitted_at as string|null }));
  return { success:true,data:{ id:row.id as string, deadline:row.deadline as string, status:row.status as ProjectRfqState["status"], ownerOrganisationId:row.organization_id as string, candidates:mapped, canManage, ownCandidateId:mapped.find((candidate)=>candidate.organisationId===a.orgId)?.id??null } };
}

export async function requestProjectQuotations(raw: unknown): Promise<ActionResult<{id:string}>> {
  const parsed=requestSchema.safeParse(raw); if(!parsed.success)return{success:false,error:parsed.error.issues[0]?.message??"Invalid RFQ",code:"VALIDATION_ERROR"};
  if(new Set(parsed.data.candidateIds).size!==parsed.data.candidateIds.length)return{success:false,error:"Candidates must be unique",code:"VALIDATION_ERROR"};
  const owner=await requireOwner(parsed.data.projectId); if(!owner)return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  const {data,error}=await owner.a.db.rpc("create_project_rfq",{p_order_id:parsed.data.projectId,p_candidate_ids:parsed.data.candidateIds,p_deadline:parsed.data.deadline.toISOString()});
  if(error)return{success:false,...mapCreateRfqError(error.message)}; revalidatePath(`/projects/${parsed.data.projectId}`); return{success:true,data:{id:data as string}};
}
export async function submitProjectQuotation(raw: unknown): Promise<ActionResult<true>> {
  const parsed=quoteSchema.safeParse(raw); if(!parsed.success)return{success:false,error:parsed.error.issues[0]?.message??"Invalid quotation",code:"VALIDATION_ERROR"};
  const a=await resolveProjectsActor(); if(!a.ok||!a.orgId)return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  const {error}=await a.db.rpc("submit_project_rfq_quote",{p_candidate_id:parsed.data.candidateId,p_total_cents:quoteTotalToCents(parsed.data.total),p_notes:parsed.data.notes});
  if(error)return{success:false,error:"Could not submit quotation",code:"SUBMIT_FAILED"}; return{success:true,data:true};
}
export async function awardProjectQuotation(raw: unknown): Promise<ActionResult<{projectId:string}>> {
  const parsed=awardSchema.safeParse(raw); if(!parsed.success)return{success:false,error:"Invalid award",code:"VALIDATION_ERROR"};
  const owner=await requireOwner(parsed.data.projectId); if(!owner)return{success:false,error:"Not allowed",code:"FORBIDDEN"};
  const { data: rfq, error: lookupError } = await owner.a.db.from("project_rfqs").select("id").eq("id",parsed.data.rfqId).eq("order_id",parsed.data.projectId).maybeSingle();
  if (lookupError || !rfq) return { success:false,error:"Quotation request not found",code:"NOT_FOUND" };
  const {data,error}=await owner.a.db.rpc("award_project_rfq",{p_rfq_id:parsed.data.rfqId,p_candidate_id:parsed.data.candidateId});
  if(error)return{success:false,...mapAwardRfqError(error.message)}; revalidatePath(`/projects/${parsed.data.projectId}`); return{success:true,data:{projectId:data as string}};
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
