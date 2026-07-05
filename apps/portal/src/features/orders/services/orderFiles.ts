/**
 * Deal/order external-file service — the pure `(db, actor)` core behind the portal
 * `uploadOrderFile` / `deleteOrderFile` actions, so the MCP deal surface can attach
 * or remove a file on a deal without a getSession/FormData action.
 *
 * Storage + the `order_files` row are both driven by the passed `db`: the env owner
 * token uses the admin client (bypasses RLS); a per-user key is bounded by storage +
 * row RLS. The caller supplies ALREADY-DECODED bytes — the MCP handler decodes the
 * base64 `content` arg and enforces the ≤5MB decoded cap BEFORE calling in, so an
 * oversized upload is rejected before it touches storage.
 */
import { sanitizeStorageFileName, resolveContentType } from "@/lib/utils/storage";
import type { ActionResult, OrderFile, OrderFileCategory } from "../types";
import { isValidUUID } from "../types";
import type { ActorContext, DbClient } from "./dealModel";

const STORAGE_BUCKET = "orders";

export interface UploadOrderFileInput {
  orderId: string;
  category: OrderFileCategory;
  bytes: Uint8Array;
  fileName: string;
  mimeType: string | null;
}

/** Attach a file to a deal (order_files row + object in the `orders` bucket). */
export async function uploadOrderFile(db: DbClient, actor: ActorContext, input: UploadOrderFileInput): Promise<ActionResult<OrderFile>> {
  if (!isValidUUID(input.orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };
  if (input.category !== "customer" && input.category !== "production" && input.category !== "deal") {
    return { success: false, error: "Invalid category", code: "INVALID_CATEGORY" };
  }
  const supabase = db as DbClient;

  // Unique storage path; sanitize the name so characters Storage rejects don't fail the upload.
  const uniqueId = crypto.randomUUID();
  const safeName = sanitizeStorageFileName(input.fileName);
  const storagePath = `${input.orderId}/${input.category}/${uniqueId}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, input.bytes, { contentType: resolveContentType(input.mimeType) });
  if (uploadError) return { success: false, error: `Failed to upload file: ${uploadError.message}`, code: "UPLOAD_FAILED" };

  const { data: row, error: insertError } = await supabase
    .from("order_files")
    .insert({
      order_id: input.orderId,
      category: input.category,
      file_name: input.fileName,
      storage_path: storagePath,
      mime_type: input.mimeType ?? null,
      file_size_bytes: input.bytes.byteLength,
      uploaded_by: actor.portalUserId ?? null,
    })
    .select("id, order_id, category, file_name, mime_type, file_size_bytes, created_at")
    .single();
  if (insertError || !row) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]); // clean up the orphaned object
    return { success: false, error: "Failed to save file record", code: "INSERT_FAILED" };
  }

  return {
    success: true,
    data: {
      id: row.id,
      orderId: row.order_id,
      category: row.category,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      uploadedByName: null,
      isThumbnail: false,
      createdAt: row.created_at,
    },
  };
}

/** Remove a deal file (storage object + order_files row). Idempotent. */
export async function deleteOrderFile(db: DbClient, _actor: ActorContext, fileId: string): Promise<ActionResult<{ id: string }>> {
  if (!isValidUUID(fileId)) return { success: false, error: "Invalid file id", code: "VALIDATION_ERROR" };
  const supabase = db as DbClient;
  const { data: file, error: fetchError } = await supabase
    .from("order_files")
    .select("id, storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (fetchError) return { success: false, error: fetchError.message, code: "FETCH_FAILED" };
  if (!file) return { success: true, data: { id: fileId } }; // already gone
  if (file.storage_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([file.storage_path as string]); // best-effort
  }
  const { error: deleteError } = await supabase.from("order_files").delete().eq("id", fileId);
  if (deleteError) return { success: false, error: "Failed to delete file", code: "DELETE_FAILED" };
  return { success: true, data: { id: fileId } };
}
