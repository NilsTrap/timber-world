import type { ActionResult } from "../../orders/types";
import type { DbClient } from "../../orders/services/dealModel";
import {
  normaliseProjectName,
  normaliseProjectPath,
  projectPathKey,
} from "../filePaths";
import type { ProjectFileCounts, ProjectFileMeta, ProjectFolderMeta } from "../types";

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
    cleanupStatus: (row.cleanup_status as ProjectFileMeta["cleanupStatus"]) ?? "not_started",
    cleanFileId: (row.clean_file_id as string) ?? null,
    cleanupFindingsCount: Number(row.cleanup_findings_count ?? 0),
    shared: !!row.shared_to_order_id,
    sharedInbound: !!row.shared_inbound,
    officialImagePosition: row.is_thumbnail ? Number(row.thumbnail_sort_order ?? 0) || null : null,
  };
}

const SAFE_FILE_SELECT =
  "id, file_name, relative_path, mime_type, file_size_bytes, lifecycle_status, created_at, cleanup_status, is_thumbnail, thumbnail_sort_order";

/** Original workspace metadata for one visible deal. No storage/source columns. */
export async function listProjectFiles(db: DbClient, dealId: string, revealCleanup = false): Promise<ProjectFileMeta[]> {
  let { data, error } = await db
    .from("order_files")
    .select(SAFE_FILE_SELECT)
    .eq("order_id", dealId)
    .eq("category", PROJECT_CATEGORY)
    .eq("file_variant", ORIGINAL_VARIANT)
    .order("relative_path");
  // Keep the local UI usable before the additive cleanup migration is applied.
  // The cleanup actions themselves remain unavailable until that local schema exists.
  if (error) {
    const legacy = await db.from("order_files").select("id, file_name, relative_path, mime_type, file_size_bytes, lifecycle_status, created_at")
      .eq("order_id", dealId).eq("category", PROJECT_CATEGORY).eq("file_variant", ORIGINAL_VARIANT).order("relative_path");
    data = legacy.data;
    error = legacy.error;
  }
  if (error || !data) return [];
  const originals = data as Array<Record<string, unknown>>;
  const originalIds = originals.map((row) => row.id as string);
  const sourceDerivatives = revealCleanup && originalIds.length ? await db.from("order_files")
    .select("id, source_file_id, cleanup_status, cleanup_findings, shared_to_order_id")
    .in("source_file_id", originalIds).eq("category", PROJECT_CATEGORY).eq("file_variant", "recipient_copy") : { data: [] };
  const inbound = await db.from("order_files")
    .select("id, file_name, relative_path, mime_type, file_size_bytes, lifecycle_status, created_at, cleanup_status, cleanup_findings, shared_to_order_id")
    .eq("shared_to_order_id", dealId).eq("category", PROJECT_CATEGORY).eq("file_variant", "recipient_copy").eq("cleanup_status", "approved");
  const derivatives = new Map(((sourceDerivatives.data ?? []) as Array<Record<string, unknown>>).map((row) => [row.source_file_id as string, row]));
  const own = originals.map((row) => {
    const derivative = derivatives.get(row.id as string);
    return mapFile({ ...row, cleanup_status: derivative?.cleanup_status ?? row.cleanup_status, clean_file_id: derivative?.id, cleanup_findings_count: Array.isArray(derivative?.cleanup_findings) ? derivative.cleanup_findings.length : 0, shared_to_order_id: derivative?.shared_to_order_id });
  });
  const received = ((inbound.data ?? []) as Array<Record<string, unknown>>).map((row) => mapFile({ ...row, clean_file_id: row.id, cleanup_findings_count: 0, shared_inbound: true }));
  return [...own, ...received].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function mapFolder(row: Record<string, unknown>): ProjectFolderMeta {
  return {
    id: row.id as string,
    relativePath: row.relative_path as string,
    createdAt: row.created_at as string,
  };
}

export async function listProjectFolders(db: DbClient, dealId: string): Promise<ProjectFolderMeta[]> {
  const { data, error } = await db
    .from("project_folders")
    .select("id, relative_path, created_at")
    .eq("order_id", dealId)
    .order("relative_path");
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map(mapFolder);
}

interface InternalFileRow {
  id: string;
  order_id: string;
  file_name: string;
  relative_path: string;
  mime_type: string | null;
  file_size_bytes?: number | null;
  storage_path: string;
  lifecycle_status: "uploading" | "ready" | "failed";
}

export interface InternalFolderRow {
  id: string;
  order_id: string;
  relative_path: string;
}

/** Internal-only locator; every caller first validated the current-org deal. */
export async function locateProjectFile(
  db: DbClient,
  fileId: string,
): Promise<InternalFileRow | null> {
  const { data, error } = await db
    .from("order_files")
    .select("id, order_id, file_name, relative_path, mime_type, file_size_bytes, storage_path, lifecycle_status")
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
  const folderKeys = new Set((await listInternalProjectFolders(db, file.order_id)).map((folder) => projectPathKey(folder.relative_path)));
  if (folderKeys.has(projectPathKey(relativePath))) {
    return { success: false, error: "That name is already used in this folder", code: "DUPLICATE_PATH" };
  }
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
  // The RPC collision-checks and updates folder metadata plus all descendants
  // in one database transaction.
  const { data: updated, error: renameError } = await db.rpc(
    "move_project_workspace_folder",
    { p_order_id: orderId, p_from: source.path, p_to: target },
  );
  if (renameError) {
    return {
      success: false,
      error: renameError.code === "23505" ? "That folder name is already used" : "Folder rename failed",
      code: renameError.code === "23505" ? "DUPLICATE_PATH" : "UPDATE_FAILED",
    };
  }
  return { success: true, data: { updated: Number(updated ?? 0) } };
}

export async function createProjectFolder(
  db: DbClient,
  orderId: string,
  relativePath: string,
  createdBy: string | null,
): Promise<ActionResult<ProjectFolderMeta>> {
  const path = normaliseProjectPath(relativePath);
  if (!path.ok) return { success: false, error: path.error, code: "INVALID_PATH" };
  let canonicalPath = path.path;
  if (path.segments.length > 1) {
    const parent = path.segments.slice(0, -1).join("/");
    const parentFolder = (await listInternalProjectFolders(db, orderId)).find(
      (folder) => projectPathKey(folder.relative_path) === projectPathKey(parent),
    );
    if (!parentFolder) {
      return { success: false, error: "Parent folder unavailable", code: "NOT_FOUND" };
    }
    canonicalPath = `${parentFolder.relative_path}/${path.segments.at(-1)!}`;
  }
  const [existingFolders, existingFiles] = await Promise.all([
    listInternalProjectFolders(db, orderId),
    listInternalProjectFiles(db, orderId),
  ]);
  const pathKey = projectPathKey(canonicalPath);
  if (existingFolders.some((folder) => projectPathKey(folder.relative_path) === pathKey)) {
    return { success: false, error: "That folder already exists", code: "FOLDER_EXISTS" };
  }
  if (existingFiles.some((file) => projectPathKey(file.relative_path) === pathKey)) {
    return { success: false, error: "That name is already used", code: "DUPLICATE_PATH" };
  }
  const { data, error } = await db
    .from("project_folders")
    .insert({ order_id: orderId, relative_path: canonicalPath, created_by: createdBy })
    .select("id, relative_path, created_at")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      const foldersNow = await listInternalProjectFolders(db, orderId);
      if (foldersNow.some((folder) => projectPathKey(folder.relative_path) === pathKey)) {
        return { success: false, error: "That folder already exists", code: "FOLDER_EXISTS" };
      }
    }
    return {
      success: false,
      error: error?.code === "23505" ? "That name is already used" : "Folder could not be created",
      code: error?.code === "23505" ? "DUPLICATE_PATH" : "CREATE_FAILED",
    };
  }
  return { success: true, data: mapFolder(data as Record<string, unknown>) };
}

export async function ensureProjectFolders(
  db: DbClient,
  orderId: string,
  filePath: string,
  createdBy: string | null,
): Promise<ActionResult<{ created: number; relativePath: string }>> {
  const path = normaliseProjectPath(filePath);
  if (!path.ok) return { success: false, error: path.error, code: "INVALID_PATH" };
  const folders = path.segments.slice(0, -1).map((_, index) => path.segments.slice(0, index + 1).join("/"));
  if (folders.length === 0) return { success: true, data: { created: 0, relativePath: path.path } };
  const [existingFolders, existingFiles] = await Promise.all([
    listInternalProjectFolders(db, orderId),
    listInternalProjectFiles(db, orderId),
  ]);
  const fileKeys = new Set(existingFiles.map((file) => projectPathKey(file.relative_path)));
  if (folders.some((folder) => fileKeys.has(projectPathKey(folder)))) {
    return { success: false, error: "A file blocks part of this folder path", code: "DUPLICATE_PATH" };
  }
  const existingKeys = new Set(existingFolders.map((folder) => projectPathKey(folder.relative_path)));
  const create = folders.filter((folder) => !existingKeys.has(projectPathKey(folder)));
  if (create.length === 0) {
    const deepest = existingFolders.find((folder) => projectPathKey(folder.relative_path) === projectPathKey(folders.at(-1)!));
    return { success: true, data: { created: 0, relativePath: `${deepest?.relative_path ?? folders.at(-1)!}/${path.segments.at(-1)!}` } };
  }
  let created = 0;
  // Insert ancestors one at a time. A concurrent duplicate then affects only
  // that ancestor instead of rolling back the entire folder chain.
  for (const relativePath of create) {
    const { error } = await db.from("project_folders").insert({
      order_id: orderId,
      relative_path: relativePath,
      created_by: createdBy,
    });
    if (!error) { created += 1; continue; }
    if (error.code !== "23505") {
      return { success: false, error: "Folder structure could not be saved", code: "CREATE_FAILED" };
    }
    const [foldersNow, filesNow] = await Promise.all([
      listInternalProjectFolders(db, orderId),
      listInternalProjectFiles(db, orderId),
    ]);
    if (!foldersNow.some((folder) => projectPathKey(folder.relative_path) === projectPathKey(relativePath))
      || filesNow.some((file) => projectPathKey(file.relative_path) === projectPathKey(relativePath))) {
      return { success: false, error: "A file blocks part of this folder path", code: "DUPLICATE_PATH" };
    }
  }
  const foldersNow = await listInternalProjectFolders(db, orderId);
  const deepest = foldersNow.find((folder) => projectPathKey(folder.relative_path) === projectPathKey(folders.at(-1)!));
  return { success: true, data: { created, relativePath: `${deepest?.relative_path ?? folders.at(-1)!}/${path.segments.at(-1)!}` } };
}

export async function moveProjectFile(
  db: DbClient,
  file: InternalFileRow,
  targetFolder: string,
): Promise<ActionResult<ProjectFileMeta>> {
  const folder = targetFolder === "" ? null : normaliseProjectPath(targetFolder);
  if (folder && !folder.ok) return { success: false, error: folder.error, code: "INVALID_PATH" };
  let canonicalFolder = "";
  if (folder?.ok) {
    const match = (await listInternalProjectFolders(db, file.order_id)).find(
      (item) => projectPathKey(item.relative_path) === projectPathKey(folder.path),
    );
    if (!match) return { success: false, error: "Target folder unavailable", code: "NOT_FOUND" };
    canonicalFolder = match.relative_path;
  }
  const relativePath = canonicalFolder ? `${canonicalFolder}/${file.file_name}` : file.file_name;
  const folderCollision = (await listInternalProjectFolders(db, file.order_id)).some(
    (item) => projectPathKey(item.relative_path) === projectPathKey(relativePath),
  );
  if (folderCollision) return { success: false, error: "That name is already used", code: "DUPLICATE_PATH" };
  const { data, error } = await db
    .from("order_files")
    .update({ relative_path: relativePath })
    .eq("id", file.id)
    .eq("order_id", file.order_id)
    .eq("category", PROJECT_CATEGORY)
    .select(SAFE_FILE_SELECT)
    .single();
  if (error || !data) {
    return {
      success: false,
      error: error?.code === "23505" ? "That name is already used" : "Move failed",
      code: error?.code === "23505" ? "DUPLICATE_PATH" : "UPDATE_FAILED",
    };
  }
  return { success: true, data: mapFile(data as Record<string, unknown>) };
}

export async function moveProjectFolder(
  db: DbClient,
  orderId: string,
  sourcePath: string,
  targetParent: string,
): Promise<ActionResult<{ updated: number; targetPath: string }>> {
  const source = normaliseProjectPath(sourcePath);
  const parent = targetParent === "" ? null : normaliseProjectPath(targetParent);
  if (!source.ok || (parent && !parent.ok)) return { success: false, error: "Folder unavailable", code: "INVALID_PATH" };
  const name = source.segments.at(-1)!;
  let canonicalParent = "";
  if (parent?.ok) {
    const match = (await listInternalProjectFolders(db, orderId)).find(
      (folder) => projectPathKey(folder.relative_path) === projectPathKey(parent.path),
    );
    if (!match) {
      return { success: false, error: "Target folder unavailable", code: "NOT_FOUND" };
    }
    canonicalParent = match.relative_path;
  }
  const targetPath = canonicalParent ? `${canonicalParent}/${name}` : name;
  if (targetPath === source.path) return { success: true, data: { updated: 0, targetPath } };
  const { data, error } = await db.rpc("move_project_workspace_folder", {
    p_order_id: orderId,
    p_from: source.path,
    p_to: targetPath,
  });
  if (error) return { success: false, error: error.code === "23505" ? "That name is already used" : "Move failed", code: error.code === "23505" ? "DUPLICATE_PATH" : "UPDATE_FAILED" };
  return { success: true, data: { updated: Number(data ?? 0), targetPath } };
}

export async function deleteProjectFiles(
  db: DbClient,
  files: readonly InternalFileRow[],
): Promise<ActionResult<{ deleted: number }>> {
  if (files.length === 0) return { success: false, error: "File unavailable", code: "NOT_FOUND" };
  const ids = files.map((file) => file.id);
  const orderId = files[0]!.order_id;
  if (files.some((file) => file.order_id !== orderId)) return { success: false, error: "Files unavailable", code: "NOT_FOUND" };
  const { error } = await db.rpc("delete_project_workspace_files", { p_order_id: orderId, p_file_ids: ids });
  if (error) return { success: false, error: "Delete failed", code: "DELETE_FAILED" };
  await drainProjectStorageCleanup(db, orderId);
  return { success: true, data: { deleted: ids.length } };
}

export async function drainProjectStorageCleanup(db: DbClient, orderId: string): Promise<void> {
  const { data, error } = await db
    .from("project_storage_cleanup")
    .select("id, storage_path")
    .eq("order_id", orderId)
    .lte("not_before", new Date().toISOString())
    .limit(200);
  if (error || !data || data.length === 0) return;
  const rows = data as Array<{ id: string; storage_path: string }>;
  const { error: storageError } = await db.storage.from(STORAGE_BUCKET).remove(rows.map((row) => row.storage_path));
  if (storageError) return;
  await db.rpc("complete_project_storage_cleanup", {
    p_order_id: orderId,
    p_cleanup_ids: rows.map((row) => row.id),
  });
}

export async function expireProjectUploads(db: DbClient, orderId: string): Promise<void> {
  await db.rpc("expire_project_workspace_uploads", { p_order_id: orderId });
  await drainProjectStorageCleanup(db, orderId);
}

export async function cancelProjectUpload(db: DbClient, orderId: string, fileId: string): Promise<void> {
  await db.rpc("cancel_project_workspace_upload", { p_order_id: orderId, p_file_id: fileId });
}

export async function listInternalProjectFiles(
  db: DbClient,
  orderId: string,
): Promise<InternalFileRow[]> {
  const { data, error } = await db
    .from("order_files")
    .select("id, order_id, file_name, relative_path, mime_type, storage_path, lifecycle_status")
    .eq("order_id", orderId)
    .eq("category", PROJECT_CATEGORY)
    .eq("file_variant", ORIGINAL_VARIANT);
  return error ? [] : ((data ?? []) as InternalFileRow[]);
}

export async function listInternalProjectFolders(db: DbClient, orderId: string): Promise<InternalFolderRow[]> {
  const { data, error } = await db
    .from("project_folders")
    .select("id, order_id, relative_path")
    .eq("order_id", orderId);
  return error ? [] : ((data ?? []) as InternalFolderRow[]);
}

export async function deleteProjectFolderTree(
  db: DbClient,
  orderId: string,
  folderPath: string,
  expectedFiles: readonly InternalFileRow[],
): Promise<ActionResult<{ deleted: number }>> {
  const path = normaliseProjectPath(folderPath);
  if (!path.ok) return { success: false, error: "Folder unavailable", code: "NOT_FOUND" };
  const { data, error } = await db.rpc("delete_project_workspace_folder", {
    p_order_id: orderId,
    p_path: path.path,
    p_expected_file_ids: expectedFiles.map((file) => file.id),
  });
  if (error) {
    return {
      success: false,
      error: error.code === "40001" ? "Folder contents changed. Review the files and retry." : "Folder delete failed",
      code: error.code === "40001" ? "CONTENTS_CHANGED" : "DELETE_FAILED",
    };
  }
  await drainProjectStorageCleanup(db, orderId);
  return { success: true, data: { deleted: Number(data ?? 0) } };
}
