"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { sanitizeStorageFileName } from "@/lib/utils/storage";
import type { ActionResult } from "../../orders/types";
import { isValidUUID } from "../../orders/types";
import { resolveProjectsActor } from "../access";
import type { CleanupFinding } from "../services/fileCleanup";

type CleanupStatus = "not_started" | "processing" | "needs_review" | "approved" | "failed";
export interface CleanedFileResult { fileId: string; cleanFileId: string; cleanupStatus: CleanupStatus; findingsCount: number }

const FILE_SELECT = "id, order_id, file_name, relative_path, mime_type, storage_path, lifecycle_status, file_variant, source_file_id, cleanup_status";

export async function cleanProjectFilesAction(fileIds: string[]): Promise<ActionResult<CleanedFileResult[]>> {
  const ids = [...new Set(fileIds)].filter(isValidUUID).slice(0, 50);
  if (!ids.length) return { success: false, error: "Select files to clean", code: "VALIDATION_ERROR" };
  const actor = await resolveProjectsActor();
  if (!actor.ok) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  const results: CleanedFileResult[] = [];
  for (const fileId of ids) {
    const result = await cleanOne(actor, fileId);
    if (!result.success) return result;
    results.push(result.data);
  }
  return { success: true, data: results };
}

async function cleanOne(actor: Extract<Awaited<ReturnType<typeof resolveProjectsActor>>, { ok: true }>, fileId: string): Promise<ActionResult<CleanedFileResult>> {
  const { data: row } = await actor.db.from("order_files").select(FILE_SELECT).eq("id", fileId).eq("category", "project").eq("file_variant", "original").maybeSingle();
  const file = row as any;
  if (!file || file.lifecycle_status !== "ready") return { success: false, error: "File unavailable", code: "NOT_FOUND" };
  const { data: order } = await actor.db.from("orders").select("id, name, buyer_organisation_id, seller_organisation_id").eq("id", file.order_id).maybeSingle();
  const deal = order as any;
  if (!deal || (!actor.isPlatformAdmin && deal.seller_organisation_id !== actor.orgId)) return { success: false, error: "Only the trader can clean buyer files", code: "FORBIDDEN" };
  const { data: buyer } = await actor.db.from("organisations").select("name, code, email, phone, website, default_signee_name").eq("id", deal.buyer_organisation_id).maybeSingle();
  const { data: setting } = await actor.db.from("platform_settings").select("value").eq("key", "project_file_cleanup").maybeSingle();
  const policy = (((setting as any)?.value ?? {}) as { llmEnabled?: boolean; prompt?: string; extraTerms?: string[] });
  // Load format tooling only while executing cleanup. Keeping DOM/PDF libraries
  // out of the server-action module's initial graph prevents Next from trying
  // to initialise JSDOM while merely rendering the project page.
  const { buildNeutralCleanFileName, cleanDxfText, cleanHtmlText, cleanPdfBytes, cleanPlainText, inferSensitiveFileNameTerms, normaliseSensitiveTerms } = await import("../services/fileCleanup");
  const baseTerms = normaliseSensitiveTerms([deal.name, ...inferSensitiveFileNameTerms(file.file_name), ...(buyer ? Object.values(buyer as Record<string, string | null>) : []), ...(policy.extraTerms ?? [])]);
  await actor.db.from("order_files").update({ cleanup_status: "processing", cleanup_findings: [] }).eq("id", fileId);
  const { data: blob, error: downloadError } = await actor.db.storage.from("orders").download(file.storage_path);
  if (downloadError || !blob) return failCleanup(actor, fileId, "Could not read the original file");
  try {
    const input = await blob.arrayBuffer();
    const text = new TextDecoder("utf-8", { fatal: false }).decode(input);
    const lower = file.file_name.toLowerCase();
    const isPdf = lower.endsWith(".pdf") || file.mime_type === "application/pdf";
    // Do not send binary PDF data to the optional detector. PDF cleanup uses
    // deterministic metadata, title-block, and known-term redaction locally.
    const aiTerms = policy.llmEnabled && !isPdf ? await findTermsWithAi(text, policy.prompt ?? "") : [];
    const terms = normaliseSensitiveTerms([...baseTerms, ...aiTerms]);
    let output: Uint8Array;
    let cleanFileKind: import("../services/fileCleanup").CleanFileKind;
    let findings: CleanupFinding[];
    if (isPdf) { ({ output, findings } = await cleanPdfBytes(input, terms)); cleanFileKind = "pdf"; }
    else if (lower.endsWith(".html") || lower.endsWith(".htm") || file.mime_type === "text/html") {
      const cleaned = cleanHtmlText(text, terms); output = new TextEncoder().encode(cleaned.output); findings = cleaned.findings; cleanFileKind = "html";
    } else if (lower.endsWith(".dxf")) {
      const cleaned = cleanDxfText(text, terms); output = new TextEncoder().encode(cleaned.output); findings = cleaned.findings; cleanFileKind = "dxf";
    } else if (file.mime_type?.startsWith("text/")) {
      const cleaned = cleanPlainText(text, terms); output = new TextEncoder().encode(cleaned.output); findings = cleaned.findings; cleanFileKind = "text";
    } else return failCleanup(actor, fileId, "This file type needs a manually cleaned replacement");
    const cleanFileName = buildNeutralCleanFileName(cleanFileKind);
    const cleanMimeType = cleanFileKind === "html" ? "text/html" : cleanFileKind === "pdf" ? "application/pdf" : cleanFileKind === "dxf" ? "image/vnd.dxf" : "text/plain";
    const storagePath = `${file.order_id}/project/${crypto.randomUUID()}_${sanitizeStorageFileName(cleanFileName)}`;
    const { error: uploadError } = await actor.db.storage.from("orders").upload(storagePath, output, { contentType: cleanMimeType, upsert: false });
    if (uploadError) return failCleanup(actor, fileId, "Could not save the cleaned copy");
    const payload = { order_id: file.order_id, category: "project", file_name: cleanFileName, relative_path: cleanFileName, mime_type: cleanMimeType, file_size_bytes: output.byteLength, storage_path: storagePath, uploaded_by: actor.portalUserId, file_variant: "recipient_copy", source_file_id: file.id, lifecycle_status: "ready", cleanup_status: "needs_review", cleanup_findings: findings, cleaned_at: new Date().toISOString(), approved_at: null, approved_by: null, shared_to_order_id: null, shared_at: null, shared_by: null };
    const { data: existing } = await actor.db.from("order_files").select("id, storage_path").eq("source_file_id", file.id).eq("file_variant", "recipient_copy").maybeSingle();
    let cleanFileId: string;
    if (existing) {
      const { error } = await actor.db.from("order_files").update(payload).eq("id", (existing as any).id);
      if (error) { await actor.db.storage.from("orders").remove([storagePath]); return failCleanup(actor, fileId, "Could not update the cleaned copy"); }
      cleanFileId = (existing as any).id; await actor.db.storage.from("orders").remove([(existing as any).storage_path]);
    } else {
      const { data: inserted, error } = await actor.db.from("order_files").insert(payload).select("id").single();
      if (error || !inserted) { await actor.db.storage.from("orders").remove([storagePath]); return failCleanup(actor, fileId, "Could not register the cleaned copy"); }
      cleanFileId = (inserted as any).id;
    }
    await actor.db.from("order_files").update({ cleanup_status: "needs_review", cleanup_findings: findings, cleaned_at: new Date().toISOString() }).eq("id", file.id);
    revalidatePath(`/projects/${file.order_id}`);
    return { success: true, data: { fileId, cleanFileId, cleanupStatus: "needs_review", findingsCount: findings.length } };
  } catch { return failCleanup(actor, fileId, "Cleanup failed"); }
}

async function failCleanup(actor: Extract<Awaited<ReturnType<typeof resolveProjectsActor>>, { ok: true }>, fileId: string, error: string): Promise<ActionResult<never>> {
  await actor.db.from("order_files").update({ cleanup_status: "failed" }).eq("id", fileId);
  return { success: false, error, code: "CLEANUP_FAILED" };
}

async function findTermsWithAi(text: string, prompt: string): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY || !text.trim()) return [];
  const response = await new Anthropic().messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 800, system: prompt, messages: [{ role: "user", content: text.slice(0, 60_000) }] });
  const value = response.content.filter((block) => block.type === "text").map((block) => block.text).join("");
  try { const parsed = JSON.parse(value.match(/\[[\s\S]*\]/)?.[0] ?? "[]"); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; }
}

export async function approveCleanProjectFileAction(fileId: string): Promise<ActionResult<null>> { return updateCleanState(fileId, "approve"); }
export async function unshareProjectFileAction(fileId: string): Promise<ActionResult<null>> { return updateCleanState(fileId, "unshare"); }
export async function shareProjectFileAction(fileId: string): Promise<ActionResult<null>> { return updateCleanState(fileId, "share"); }

export async function shareProjectFilesAction(fileIds: string[]): Promise<ActionResult<null>> {
  const ids = [...new Set(fileIds)].filter(isValidUUID).slice(0, 50);
  if (!ids.length) return { success: false, error: "Select approved cleaned files", code: "VALIDATION_ERROR" };
  const actor = await resolveProjectsActor(); if (!actor.ok) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  const { data } = await actor.db.from("order_files").select("id, order_id, cleanup_status").in("id", ids).eq("file_variant", "recipient_copy");
  const files = (data ?? []) as Array<{ id: string; order_id: string; cleanup_status: string }>;
  if (files.length !== ids.length || files.some((file) => file.cleanup_status !== "approved") || new Set(files.map((file) => file.order_id)).size !== 1) return { success: false, error: "Every selected file must be approved on this project", code: "NOT_APPROVED" };
  const orderId = files[0]!.order_id;
  const { data: order } = await actor.db.from("orders").select("id, spine_id, seller_organisation_id").eq("id", orderId).maybeSingle();
  const deal = order as any; if (!deal || (!actor.isPlatformAdmin && deal.seller_organisation_id !== actor.orgId)) return { success: false, error: "Only the trader can manage sharing", code: "FORBIDDEN" };
  const { data: next } = await actor.db.from("orders").select("id").eq("spine_id", deal.spine_id).eq("buyer_organisation_id", deal.seller_organisation_id).neq("id", deal.id).neq("lifecycle_stage", "cancelled").limit(1).maybeSingle();
  if (!next) return { success: false, error: "Add the next party before sharing files", code: "NO_NEXT_LEG" };
  const { error } = await actor.db.from("order_files").update({ shared_to_order_id: (next as any).id, shared_at: new Date().toISOString(), shared_by: actor.portalUserId }).in("id", ids);
  if (error) return { success: false, error: "Could not share the selected files", code: "UPDATE_FAILED" };
  revalidatePath(`/projects/${orderId}`); return { success: true, data: null };
}

export async function unshareProjectFilesAction(fileIds: string[]): Promise<ActionResult<null>> {
  const ids = [...new Set(fileIds)].filter(isValidUUID).slice(0, 50); if (!ids.length) return { success: false, error: "Select shared files", code: "VALIDATION_ERROR" };
  const actor = await resolveProjectsActor(); if (!actor.ok) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  const { data } = await actor.db.from("order_files").select("id, order_id").in("id", ids).eq("file_variant", "recipient_copy");
  const files = (data ?? []) as Array<{ id: string; order_id: string }>; if (files.length !== ids.length || new Set(files.map((file) => file.order_id)).size !== 1) return { success: false, error: "Files unavailable", code: "NOT_FOUND" };
  const orderId = files[0]!.order_id; const { data: order } = await actor.db.from("orders").select("seller_organisation_id").eq("id", orderId).maybeSingle();
  if (!order || (!actor.isPlatformAdmin && (order as any).seller_organisation_id !== actor.orgId)) return { success: false, error: "Only the trader can manage sharing", code: "FORBIDDEN" };
  const { error } = await actor.db.from("order_files").update({ shared_to_order_id: null, shared_at: null, shared_by: null }).in("id", ids);
  if (error) return { success: false, error: "Could not unshare the selected files", code: "UPDATE_FAILED" };
  revalidatePath(`/projects/${orderId}`); return { success: true, data: null };
}

export async function getCleanProjectFileUrlAction(fileId: string): Promise<ActionResult<{ url: string; fileName: string; mimeType: string | null }>> {
  if (!isValidUUID(fileId)) return { success: false, error: "Cleaned file unavailable", code: "NOT_FOUND" };
  const actor = await resolveProjectsActor(); if (!actor.ok) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  const { data } = await actor.db.from("order_files").select("id, file_name, mime_type, storage_path, lifecycle_status").eq("id", fileId).eq("category", "project").eq("file_variant", "recipient_copy").maybeSingle();
  const file = data as any; if (!file || file.lifecycle_status !== "ready") return { success: false, error: "Cleaned file unavailable", code: "NOT_FOUND" };
  const { data: signed, error } = await actor.db.storage.from("orders").createSignedUrl(file.storage_path, 120);
  if (error || !signed?.signedUrl) return { success: false, error: "Cleaned file unavailable", code: "NOT_FOUND" };
  return { success: true, data: { url: signed.signedUrl, fileName: file.file_name, mimeType: file.mime_type } };
}

async function updateCleanState(fileId: string, action: "approve" | "share" | "unshare"): Promise<ActionResult<null>> {
  if (!isValidUUID(fileId)) return { success: false, error: "File unavailable", code: "NOT_FOUND" };
  const actor = await resolveProjectsActor(); if (!actor.ok) return { success: false, error: "Not allowed", code: "FORBIDDEN" };
  const { data } = await actor.db.from("order_files").select("id, order_id, source_file_id, cleanup_status").eq("id", fileId).eq("file_variant", "recipient_copy").maybeSingle();
  const clean = data as any; if (!clean) return { success: false, error: "Cleaned file unavailable", code: "NOT_FOUND" };
  const { data: order } = await actor.db.from("orders").select("id, spine_id, seller_organisation_id").eq("id", clean.order_id).maybeSingle();
  const deal = order as any; if (!deal || (!actor.isPlatformAdmin && deal.seller_organisation_id !== actor.orgId)) return { success: false, error: "Only the trader can manage sharing", code: "FORBIDDEN" };
  let update: Record<string, unknown>;
  if (action === "approve") update = { cleanup_status: "approved", approved_at: new Date().toISOString(), approved_by: actor.portalUserId };
  else if (action === "unshare") update = { shared_to_order_id: null, shared_at: null, shared_by: null };
  else {
    if (clean.cleanup_status !== "approved") return { success: false, error: "Preview and approve the cleaned file first", code: "NOT_APPROVED" };
    const { data: next } = await actor.db.from("orders").select("id").eq("spine_id", deal.spine_id).eq("buyer_organisation_id", deal.seller_organisation_id).neq("id", deal.id).neq("lifecycle_stage", "cancelled").limit(1).maybeSingle();
    if (!next) return { success: false, error: "Add the next party before sharing files", code: "NO_NEXT_LEG" };
    update = { shared_to_order_id: (next as any).id, shared_at: new Date().toISOString(), shared_by: actor.portalUserId };
  }
  const { error } = await actor.db.from("order_files").update(update).eq("id", clean.id);
  if (error) return { success: false, error: "Could not update file sharing", code: "UPDATE_FAILED" };
  revalidatePath(`/projects/${clean.order_id}`); return { success: true, data: null };
}
