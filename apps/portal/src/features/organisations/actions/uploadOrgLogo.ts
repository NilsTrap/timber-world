"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Upload Organisation Logo
 *
 * Uploads a logo to Supabase Storage (marketing bucket, org-logos/ prefix)
 * and updates the organisation's logo_url field.
 */
export async function uploadOrgLogo(
  organisationId: string,
  formData: FormData
): Promise<ActionResult<{ logoUrl: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "No file provided", code: "NO_FILE" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`,
      code: "INVALID_TYPE",
    };
  }

  if (file.size > MAX_SIZE) {
    return { success: false, error: "File too large. Maximum 5MB.", code: "FILE_TOO_LARGE" };
  }

  const supabase = await createClient();

  // Build storage path
  const fileExt = file.name.split(".").pop() || "png";
  const storagePath = `org-logos/${organisationId}.${fileExt}`;

  // Upload (upsert to replace existing)
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("marketing")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("Failed to upload logo:", uploadError);
    return { success: false, error: "Failed to upload file", code: "UPLOAD_FAILED" };
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("marketing")
    .getPublicUrl(storagePath);

  const logoUrl = urlData?.publicUrl;
  if (!logoUrl) {
    return { success: false, error: "Failed to generate URL", code: "URL_FAILED" };
  }

  // Update organisation record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("organisations")
    .update({ logo_url: logoUrl })
    .eq("id", organisationId);

  if (updateError) {
    console.error("Failed to update organisation logo:", updateError);
    return { success: false, error: "Failed to save logo URL", code: "UPDATE_FAILED" };
  }

  return { success: true, data: { logoUrl } };
}
