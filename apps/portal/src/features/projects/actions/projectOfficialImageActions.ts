"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../../orders/types";
import { requireVisibleProject } from "./_projectAccess";
import { nextOfficialImagePosition } from "../officialImagePolicy";

const uuid = z.string().uuid();

async function mayManageOfficialImages(access: Extract<Awaited<ReturnType<typeof requireVisibleProject>>, { ok: true }>, project: { seller_organisation_id: string | null }) {
  if (access.actor.isPlatformAdmin) return true;
  if (!access.actor.orgId || project.seller_organisation_id !== access.actor.orgId) return false;
  const { data } = await access.actor.db.from("organisations").select("is_trader").eq("id", access.actor.orgId).maybeSingle();
  return data?.is_trader === true;
}

export async function checkProjectOfficialImageSlot(projectId: string): Promise<ActionResult<{ position: number }>> {
  if (!uuid.safeParse(projectId).success) return { success:false,error:"Image unavailable",code:"NOT_FOUND" };
  const access = await requireVisibleProject(projectId, true);
  if (!access.ok) return { success:false,error:access.error,code:access.code };
  const { data: project } = await access.actor.db.from("orders").select("id,spine_id,seller_organisation_id,spines!orders_spine_id_fkey(origin_order_id)").eq("id",projectId).maybeSingle();
  if (!project?.spine_id || (project.spines as unknown as {origin_order_id:string|null}|null)?.origin_order_id!==projectId) return { success:false,error:"Official images can only be managed on the original project leg",code:"FORBIDDEN" };
  if (!await mayManageOfficialImages(access, project)) return { success:false,error:"Official images can only be managed by the responsible trader",code:"FORBIDDEN" };
  const { data, error } = await access.actor.db.from("order_files").select("thumbnail_sort_order").eq("order_id",projectId).eq("is_thumbnail",true);
  if (error) return { success:false,error:"Could not check project image availability",code:"UPDATE_FAILED" };
  const position = nextOfficialImagePosition((data??[]).map((row: {thumbnail_sort_order:number|null})=>row.thumbnail_sort_order));
  return position ? { success:true,data:{position} } : { success:false,error:"A project can have up to three official images",code:"LIMIT_REACHED" };
}

export async function completeProjectOfficialImage(projectId: string, fileId: string): Promise<ActionResult<{ position: number }>> {
  return addProjectOfficialImage(projectId, fileId);
}

export async function addProjectOfficialImage(projectId: string, fileId: string): Promise<ActionResult<{ position: number }>> {
  if (!uuid.safeParse(projectId).success || !uuid.safeParse(fileId).success) return { success:false,error:"Image unavailable",code:"NOT_FOUND" };
  const access = await requireVisibleProject(projectId, true);
  if (!access.ok) return { success:false,error:access.error,code:access.code };
  const { data: project } = await access.actor.db.from("orders").select("id,spine_id,seller_organisation_id,spines!orders_spine_id_fkey(origin_order_id)").eq("id",projectId).maybeSingle();
  if (!project?.spine_id) return { success:false,error:"Official images belong to the original project leg",code:"VALIDATION_ERROR" };
  if ((project.spines as unknown as {origin_order_id:string|null}|null)?.origin_order_id!==projectId) return { success:false,error:"Official images can only be managed on the original project leg",code:"FORBIDDEN" };
  if (!await mayManageOfficialImages(access, project)) return { success:false,error:"Official images can only be managed by the responsible trader",code:"FORBIDDEN" };
  const { data: file } = await access.actor.db.from("order_files").select("id,mime_type,lifecycle_status")
    .eq("id",fileId).eq("order_id",projectId).eq("category","project").eq("file_variant","original").maybeSingle();
  if (!file || file.lifecycle_status!=="ready" || !String(file.mime_type??"").startsWith("image/")) return { success:false,error:"Choose a completed image upload",code:"VALIDATION_ERROR" };
  const { data: existingData, error: existingError } = await access.actor.db.from("order_files").select("id,thumbnail_sort_order")
    .eq("order_id",projectId).eq("is_thumbnail",true).order("thumbnail_sort_order");
  if (existingError) return { success:false,error:"Could not check project image availability",code:"UPDATE_FAILED" };
  const existing = (existingData??[]) as Array<{id:string;thumbnail_sort_order:number|null}>;
  if (existing.some((row)=>row.id===fileId)) return { success:true,data:{position:Number(existing.find((row)=>row.id===fileId)?.thumbnail_sort_order??1)} };
  const position = nextOfficialImagePosition(existing.map((row)=>row.thumbnail_sort_order));
  if (!position) return { success:false,error:"A project can have up to three official images",code:"LIMIT_REACHED" };
  const { data: updated, error } = await access.actor.db.from("order_files").update({is_thumbnail:true,thumbnail_sort_order:position}).eq("id",fileId).eq("order_id",projectId).eq("category","project").eq("file_variant","original").select("id").maybeSingle();
  if (error||!updated) return { success:false,error:"Could not add official image",code:"UPDATE_FAILED" };
  revalidatePath(`/projects/${projectId}`); revalidatePath("/projects");
  return { success:true,data:{position} };
}

export async function removeProjectOfficialImage(projectId: string, fileId: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(projectId).success || !uuid.safeParse(fileId).success) return { success:false,error:"Image unavailable",code:"NOT_FOUND" };
  const access = await requireVisibleProject(projectId, true);
  if (!access.ok) return { success:false,error:access.error,code:access.code };
  const { data: project } = await access.actor.db.from("orders").select("id,spine_id,seller_organisation_id,spines!orders_spine_id_fkey(origin_order_id)").eq("id",projectId).maybeSingle();
  if (!project?.spine_id) return { success:false,error:"Official images belong to the original project leg",code:"VALIDATION_ERROR" };
  if ((project.spines as unknown as {origin_order_id:string|null}|null)?.origin_order_id!==projectId) return { success:false,error:"Official images can only be managed on the original project leg",code:"FORBIDDEN" };
  if (!await mayManageOfficialImages(access, project)) return { success:false,error:"Official images can only be managed by the responsible trader",code:"FORBIDDEN" };
  const { data: updated,error } = await access.actor.db.from("order_files").update({is_thumbnail:false,thumbnail_sort_order:null}).eq("id",fileId).eq("order_id",projectId).eq("category","project").eq("file_variant","original").eq("is_thumbnail",true).select("id").maybeSingle();
  if (error||!updated) return { success:false,error:"Could not remove official image",code:"UPDATE_FAILED" };
  revalidatePath(`/projects/${projectId}`); revalidatePath("/projects");
  return { success:true,data:null };
}
