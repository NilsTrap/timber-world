"use server";

/**
 * Template logo/letterhead upload (E6.1). Uploads to the PUBLIC template-assets
 * bucket and returns the public URL — Gotenberg's Chromium fetches it with no
 * bearer. Platform-admin only (the real write guard; storage RLS is just
 * authenticated-write). The URL is stored in the template's page_settings.logoUrl.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const BUCKET = "template-assets";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function requireAdmin(): Promise<{ ok: true } | { ok: false; result: ActionResult<never> }> {
  const session = await getSession();
  if (!session) {
    return { ok: false, result: { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" } };
  }
  if (!isAdmin(session)) {
    return { ok: false, result: { success: false, error: "Only an admin can upload template assets", code: "FORBIDDEN" } };
  }
  return { ok: true };
}

/** Upload a logo image; returns its public URL + storage path. */
export async function uploadTemplateLogo(
  formData: FormData
): Promise<ActionResult<{ url: string; path: string }>> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.result;

  const file = formData.get("file");
  const templateId = String(formData.get("templateId") || "tmp").replace(/[^\w-]/g, "") || "tmp";
  if (!(file instanceof File)) {
    return { success: false, error: "No file provided", code: "VALIDATION" };
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return { success: false, error: "Only PNG, JPG or WEBP images are allowed", code: "VALIDATION" };
  }
  if (file.size > MAX_BYTES) {
    return { success: false, error: "Image must be 2 MB or smaller", code: "VALIDATION" };
  }

  // Unique-enough object path (server action — Date/random allowed here).
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `templates/${templateId}/${stamp}.${ext}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    return { success: false, error: "Upload failed", code: "UPLOAD_FAILED" };
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { success: true, data: { url: data.publicUrl as string, path } };
}

/** Remove a previously-uploaded logo (best-effort cleanup). */
export async function removeTemplateLogo(path: string): Promise<ActionResult<{ path: string }>> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.result;

  if (!path || !path.startsWith("templates/")) {
    return { success: false, error: "Invalid asset path", code: "VALIDATION" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { error } = await admin.storage.from(BUCKET).remove([path]);
  if (error) {
    return { success: false, error: "Delete failed", code: "DELETE_FAILED" };
  }
  return { success: true, data: { path } };
}
