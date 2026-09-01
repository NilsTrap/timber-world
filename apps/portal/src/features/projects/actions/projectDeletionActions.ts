"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../../orders/types";
import { resolveProjectsActor } from "../access";
const uuidSchema=z.string().uuid();
function failure(message:string):ActionResult<null>{if(message.includes("ORIGIN_LEG_REQUIRES_PROJECT_DELETE"))return{success:false,error:"The origin leg owns the shared specification. Delete the whole project instead.",code:"CONFLICT"};if(message.includes("RESTORE_PROJECT_FIRST"))return{success:false,error:"Restore the deleted project before restoring this leg.",code:"CONFLICT"};if(message.includes("RESTORE_CONFLICT"))return{success:false,error:"This project cannot be restored because its active state has changed.",code:"CONFLICT"};if(message.includes("NOT_FOUND")||message.includes("DELETED")||message.includes("ACTIVE"))return{success:false,error:"The project changed or no longer exists.",code:"NOT_FOUND"};return{success:false,error:"The project could not be updated. No changes were made.",code:"UPDATE_FAILED"}}
async function mutate(id:unknown,rpc:"soft_delete_project"|"soft_delete_project_leg"|"restore_soft_deleted_project"|"restore_soft_deleted_project_leg",parameter:"p_spine_id"|"p_order_id"):Promise<ActionResult<null>>{const parsed=uuidSchema.safeParse(id);if(!parsed.success)return{success:false,error:"Invalid project identifier.",code:"VALIDATION_ERROR"};const actor=await resolveProjectsActor();if(!actor.ok||!actor.isPlatformAdmin)return{success:false,error:"Not permitted.",code:"FORBIDDEN"};const{error}=await actor.db.rpc(rpc,{[parameter]:parsed.data});if(error)return failure(error.message);revalidatePath("/projects");return{success:true,data:null}}
export async function softDeleteProject(spineId:unknown){return mutate(spineId,"soft_delete_project","p_spine_id")}
export async function softDeleteProjectLeg(orderId:unknown){return mutate(orderId,"soft_delete_project_leg","p_order_id")}
export async function restoreProject(spineId:unknown){return mutate(spineId,"restore_soft_deleted_project","p_spine_id")}
export async function restoreProjectLeg(orderId:unknown){return mutate(orderId,"restore_soft_deleted_project_leg","p_order_id")}
