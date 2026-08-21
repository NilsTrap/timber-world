import type { ActionResult } from "../../orders/types";
import type { DbClient } from "../../orders/services/dealModel";
import {
  normaliseProjectName,
  normaliseProjectPath,
  projectPathKey,
  replacePathPrefix,
} from "../filePaths";
import type { ProjectFileCounts, ProjectFileMeta } from "../types";

const STORAGE_BUCKET = "orders";
const PROJECT_CATEGORY = "project";
const ORIGINAL_VARIANT = "original";

export interface OrderFileCountRow {
  order_id: string;
  category: string | null;
}

export function summariseFileCounts(
  rows: readonly OrderFileCountRow[],
  visibleIds: readonly string[],
): Map<string, ProjectFileCounts> {
  const out = new Map<string, ProjectFileCounts>();
  for (const id of visibleIds) out.set(id, { total: 0 });
  for (const row of rows) {
    if (row.category !== PROJECT_CATEGORY) continue;
    const counts = out.get(row.order_id);
    if (counts) counts.total += 1;
  }
  return out;
}

export async function countFilesByDeal(
  db: DbClient,
  dealIds: readonly string[],
): Promise<Map<string, ProjectFileCounts>> {
  if (dealIds.length === 0) return new Map();
  const { data, error } = await db
    .from("order_files")
    .select("order_id, category")
    .in("order_id", dealIds as string[])
    .eq("category", PROJECT_CATEGORY)
    .eq("file_variant", ORIGINAL_VARIANT);
  if (error) return summariseFileCounts([], dealIds);
  return summariseFileCounts((data ?? []) as OrderFileCountRow[], dealIds);
}

function mapFile(row: Record<string, unknown>): ProjectFileMeta {
  return {
    id: row.id as string,
    fileName: (row.file_name as string) ?? "",
    relativePath: (row.relative_path as string) ?? (row.file_name as string) ?? "",
    mimeType: (row.mime_type as string) ?? null,
    fileSizeBytes: (row.file_size_bytes as number) ?? null,
    lifecycleStatus:
      row.lifecycle_status === "uploading" || row.lifecycle_status === "failed"
        ? row.lifecycle_status
        : "ready",
    createdAt: row.created_at as string,
  };
}

const SAFE_FILE_SELECT =
  "id, file_name, relative_path, mime_type, file_size_bytes, lifecycle_status, created_at";

/** Original workspace metadata for one visible deal. No storage/source columns. */
export async function listProjectFiles(db: DbClient, dealId: string): Promise<ProjectFileMeta[]> {
  const { data, error } = await db
    .from("order_files")
    .select(SAFE_FILE_SELECT)
    .eq("order_id", dealId)
    .eq("category", PROJECT_CATEGORY)
    .eq("file_variant", ORIGINAL_VARIANT)
    .order("relative_path");
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map(mapFile);
}

interface InternalFileRow {
  id: string;
  order_id: string;
  file_name: string;
  relative_path: string;
  mime_type: string | null;
  storage_path: string;
}

/** Internal-only locator; every caller first validated the current-org deal. */
export async function locateProjectFile(
  db: DbClient,
  fileId: string,
): Promise<InternalFileRow | null> {
  const { data, error } = await db
    .from("order_files")
    .select("id, order_id, file_name, relative_path, mime_type, storage_path")
    .eq("id", fileId)
    .eq("category", PROJECT_CATEGORY)
    .eq("file_variant", ORIGINAL_VARIANT)
    .maybeSingle();
  return error || !data ? null : (data as InternalFileRow);
}

export async function renameProjectFile(
  db: DbClient,
  file: InternalFileRow,
  nextName: string,
): Promise<ActionResult<ProjectFileMeta>> {
  const name = normaliseProjectName(nextName);
  if (!name) return { success: false, error: "Enter a valid file name", code: "INVALID_NAME" };
  const parent = file.relative_path.includes("/")
    ? file.relative_path.slice(0, file.relative_path.lastIndexOf("/"))
    : "";
  const relativePath = parent ? `${parent}/${name}` : name;
  const { data, error } = await db
    .from("order_files")
    .update({ file_name: name, relative_path: relativePath })
    .eq("id", file.id)
    .eq("order_id", file.order_id)
    .eq("category", PROJECT_CATEGORY)
    .select(SAFE_FILE_SELECT)
    .single();
  if (error || !data) {
    return {
      success: false,
      error: error?.code === "23505" ? "That name is already used in this folder" : "Rename failed",
      code: error?.code === "23505" ? "DUPLICATE_PATH" : "UPDATE_FAILED",
    };
  }
  return { success: true, data: mapFile(data as Record<string, unknown>) };
}

export async function renameProjectFolder(
  db: DbClient,
  orderId: string,
  folderPath: string,
  nextName: string,
): Promise<ActionResult<{ updated: number }>> {
  const source = normaliseProjectPath(folderPath);
  const name = normaliseProjectName(nextName);
  if (!source.ok || !name) {
    return { success: false, error: "Enter a valid folder name", code: "INVALID_NAME" };
  }
  const parent = source.path.includes("/") ? source.path.slice(0, source.path.lastIndexOf("/")) : "";
  const target = parent ? `${parent}/${name}` : name;
  const { data: rows, error } = await db
    .from("order_files")
    .select("id, relative_path")
    .eq("order_id", orderId)
    .eq("category", PROJECT_CATEGORY)
    .eq("file_variant", ORIGINAL_VARIANT);
  if (error) return { success: false, error: "Folder unavailable", code: "NOT_FOUND" };
  const all = (rows ?? []) as Array<{ id: string; relative_path: string }>;
  const descendants = all.filter((row) => row.relative_path.startsWith(`${source.path}/`));
  if (descendants.length === 0) return { success: false, error: "Folder unavailable", code: "NOT_FOUND" };
  const descendantIds = new Set(descendants.map((row) => row.id));
  const occupied = new Set(
    all.filter((row) => !descendantIds.has(row.id)).map((row) => projectPathKey(row.relative_path)),
  );
  const updates = descendants.map((row) => ({
    id: row.id,
    relativePath: replacePathPrefix(row.relative_path, source.path, target),
  }));
  if (updates.some((row) => occupied.has(projectPathKey(row.relativePath)))) {
    return { success: false, error: "That folder name would overwrite an existing file", code: "DUPLICATE_PATH" };
  }
  // The RPC performs every descendant update in one SQL statement/transaction.
  const { data: updated, error: renameError } = await db.rpc(
    "rename_project_workspace_folder",
    { p_order_id: orderId, p_from: source.path, p_to: target },
  );
  if (renameError) return { success: false, error: "Folder rename failed", code: "UPDATE_FAILED" };
  return { success: true, data: { updated: Number(updated ?? updates.length) } };
}

export async function deleteProjectFiles(
  db: DbClient,
  files: readonly InternalFileRow[],
): Promise<ActionResult<{ deleted: number }>> {
  if (files.length === 0) return { success: false, error: "File unavailable", code: "NOT_FOUND" };
  const ids = files.map((file) => file.id);
  const { error } = await db.from("order_files").delete().in("id", ids);
  if (error) return { success: false, error: "Delete failed", code: "DELETE_FAILED" };
  // Row deletion is authoritative. A failed object cleanup leaves an
  // unreachable orphan, never metadata that points at a missing file.
  await db.storage.from(STORAGE_BUCKET).remove(files.map((file) => file.storage_path));
  return { success: true, data: { deleted: ids.length } };
}

export async function listInternalProjectFiles(
  db: DbClient,
  orderId: string,
): Promise<InternalFileRow[]> {
  const { data, error } = await db
    .from("order_files")
    .select("id, order_id, file_name, relative_path, mime_type, storage_path")
    .eq("order_id", orderId)
    .eq("category", PROJECT_CATEGORY)
    .eq("file_variant", ORIGINAL_VARIANT);
  return error ? [] : ((data ?? []) as InternalFileRow[]);
}
