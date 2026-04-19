"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, type ActionResult } from "../types";

const ALLOWED_PDF_TYPE = "application/pdf";
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Create a new specification group
 */
export async function createSpecification(
  title: string,
  description?: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Get max sort order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxData } = await (supabase as any)
    .from("marketing_specifications")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSort = (maxData?.[0]?.sort_order ?? 0) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("marketing_specifications")
    .insert({
      title,
      description: description || null,
      sort_order: nextSort,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create specification:", error);
    return { success: false, error: "Failed to create specification", code: "INSERT_FAILED" };
  }

  return { success: true, data: { id: data.id } };
}

/**
 * Update a specification group
 */
export async function updateSpecification(
  id: string,
  updates: { title?: string; description?: string; isActive?: boolean; sortOrder?: number }
): Promise<ActionResult<{ updated: true }>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description || null;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("marketing_specifications")
    .update(payload)
    .eq("id", id);

  if (error) {
    console.error("Failed to update specification:", error);
    return { success: false, error: "Failed to update specification", code: "UPDATE_FAILED" };
  }

  return { success: true, data: { updated: true } };
}

/**
 * Delete a specification group and all its files
 */
export async function deleteSpecification(
  id: string
): Promise<ActionResult<{ deleted: true }>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Get files to delete from storage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: files } = await (supabase as any)
    .from("marketing_specification_files")
    .select("storage_path")
    .eq("specification_id", id);

  // Delete files from storage
  if (files && files.length > 0) {
    const paths = files.map((f: { storage_path: string }) => f.storage_path);
    await supabase.storage.from("marketing").remove(paths);
  }

  // Delete specification (cascades to files table)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("marketing_specifications")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete specification:", error);
    return { success: false, error: "Failed to delete specification", code: "DELETE_FAILED" };
  }

  return { success: true, data: { deleted: true } };
}

/**
 * Upload a file to a specification
 */
export async function uploadSpecificationFile(
  specificationId: string,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "No file provided", code: "NO_FILE" };
  }

  // Validate file type
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isPdf = file.type === ALLOWED_PDF_TYPE;

  if (!isImage && !isPdf) {
    return {
      success: false,
      error: `Invalid file type: ${file.type}. Allowed: images (JPEG, PNG, WebP) and PDF`,
      code: "INVALID_TYPE",
    };
  }

  // Validate size
  const maxSize = isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024);
    return { success: false, error: `File too large. Maximum: ${maxMB}MB`, code: "FILE_TOO_LARGE" };
  }

  const supabase = await createClient();

  // Get max sort order for this specification's files
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxData } = await (supabase as any)
    .from("marketing_specification_files")
    .select("sort_order")
    .eq("specification_id", specificationId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSort = (maxData?.[0]?.sort_order ?? 0) + 1;

  // Build unique storage path
  const fileExt = file.name.split(".").pop() || "bin";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
  const storagePath = `specification/${specificationId}/${uniqueName}`;

  // Upload to storage
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("marketing")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Failed to upload specification file:", uploadError);
    return { success: false, error: "Failed to upload file", code: "UPLOAD_FAILED" };
  }

  // Insert file record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("marketing_specification_files")
    .insert({
      specification_id: specificationId,
      file_name: uniqueName,
      original_name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      file_size_bytes: file.size,
      sort_order: nextSort,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to insert specification file record:", error);
    // Clean up uploaded file
    await supabase.storage.from("marketing").remove([storagePath]);
    return { success: false, error: "Failed to save file record", code: "INSERT_FAILED" };
  }

  return { success: true, data: { id: data.id } };
}

/**
 * Delete a specification file
 */
export async function deleteSpecificationFile(
  fileId: string
): Promise<ActionResult<{ deleted: true }>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Get file record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: file, error: fetchError } = await (supabase as any)
    .from("marketing_specification_files")
    .select("id, storage_path")
    .eq("id", fileId)
    .single();

  if (fetchError || !file) {
    return { success: false, error: "File not found", code: "NOT_FOUND" };
  }

  // Delete from storage
  await supabase.storage.from("marketing").remove([file.storage_path]);

  // Delete record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("marketing_specification_files")
    .delete()
    .eq("id", fileId);

  if (error) {
    console.error("Failed to delete specification file:", error);
    return { success: false, error: "Failed to delete file", code: "DELETE_FAILED" };
  }

  return { success: true, data: { deleted: true } };
}
