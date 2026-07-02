"use server";

/**
 * E5 · File-upload catalog field values — storage plumbing for the 'file'
 * field type (images / technical drawings). Uploads to the PRIVATE
 * `catalog-files` bucket and returns the object metadata; the file REFERENCE
 * (value_storage_path + display fields) is persisted onto the EAV row by
 * saveProduct/saveVariant (which round-trip these columns), so the bytes are
 * uploaded first, then the reference is saved with the rest of the product.
 * Reads are via short-lived signed URLs (the bucket is private).
 *
 * Gate mirrors the other catalog actions (admin OR catalogue.view); the
 * bucket's admin-only write RLS is the hard backstop.
 */

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { sanitizeStorageFileName, resolveContentType } from "@/lib/utils/storage";
import type { ActionResult } from "../types";

const BUCKET = "catalog-files";
// Images + common technical-drawing / document formats. No hard cap on exotic
// CAD types — resolveContentType falls back to application/octet-stream.
const MAX_SIZE = 50 * 1024 * 1024;

export interface UploadedFieldFile {
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number;
}

async function gate(): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("catalogue.view")) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }
  return { success: true, data: null };
}

/**
 * Upload a file for a catalog field value. `scope`/`entityId`/`fieldId` only
 * shape the storage path (grouping); the DB reference is saved separately.
 */
export async function uploadFieldValueFile(
  scope: "product" | "variant",
  entityId: string,
  fieldId: string,
  formData: FormData,
): Promise<ActionResult<UploadedFieldFile>> {
  const g = await gate();
  if (!g.success) return g as ActionResult<UploadedFieldFile>;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "No file provided", code: "VALIDATION_ERROR" };
  }
  if (file.size > MAX_SIZE) {
    return { success: false, error: "File too large. Maximum size: 50MB", code: "FILE_TOO_LARGE" };
  }

  const supabase = await createClient();
  const uniqueId = crypto.randomUUID();
  const safeName = sanitizeStorageFileName(file.name);
  const storagePath = `${scope}/${entityId}/${fieldId}/${uniqueId}_${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: resolveContentType(file.type) });
  if (uploadError) {
    console.error("Failed to upload catalog field file:", uploadError);
    return { success: false, error: `Failed to upload file: ${uploadError.message}`, code: "UPLOAD_FAILED" };
  }

  return {
    success: true,
    data: {
      storagePath,
      fileName: file.name,
      mimeType: file.type || null,
      fileSizeBytes: file.size,
    },
  };
}

/** Signed URL (5 min) to view/download a catalog field-value file. */
export async function getFieldValueFileUrl(storagePath: string): Promise<ActionResult<string>> {
  const g = await gate();
  if (!g.success) return g as ActionResult<string>;
  if (!storagePath) return { success: false, error: "No file", code: "VALIDATION_ERROR" };
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) {
    return { success: false, error: "Failed to create download link", code: "URL_FAILED" };
  }
  return { success: true, data: data.signedUrl };
}
