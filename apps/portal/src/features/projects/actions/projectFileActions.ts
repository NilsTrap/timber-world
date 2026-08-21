"use server";

import { revalidatePath } from "next/cache";
import { sanitizeStorageFileName } from "@/lib/utils/storage";
import type { ActionResult } from "../../orders/types";
import { isValidUUID } from "../../orders/types";
import {
  deleteProjectFiles,
  listInternalProjectFiles,
  locateProjectFile,
  renameProjectFile,
  renameProjectFolder,
} from "../services/projectFiles";
import {
  MAX_PROJECT_FILE_BYTES,
  isPreviewableProjectMimeType,
  normaliseProjectPath,
  projectPathKey,
  validateStoredProjectUploadSize,
} from "../filePaths";
import type { ProjectFileMeta } from "../types";
import { requireVisibleProject } from "./_projectAccess";
import { resolveProjectsActor } from "../access";

export interface PreparedProjectUpload {
  signedUrl: string;
  uploadId: string;
}

const PREPARED_FILE_SELECT =
  "id, order_id, file_name, relative_path, mime_type, file_size_bytes, storage_path, lifecycle_status, created_at";

function publicFile(row: Record<string, unknown>): ProjectFileMeta {
  return {
    id: row.id as string,
    fileName: row.file_name as string,
    relativePath: row.relative_path as string,
    mimeType: (row.mime_type as string) ?? null,
    fileSizeBytes: (row.file_size_bytes as number) ?? null,
    lifecycleStatus: row.lifecycle_status === "uploading" ? "uploading" : "ready",
    createdAt: row.created_at as string,
  };
}

export async function prepareProjectFileUpload(input: {
  projectId: string;
  relativePath: string;
  mimeType: string | null;
  fileSizeBytes: number;
}): Promise<ActionResult<PreparedProjectUpload>> {
  const access = await requireVisibleProject(input.projectId, true);
  if (!access.ok) return { success: false, error: access.error, code: access.code };
  const path = normaliseProjectPath(input.relativePath);
  if (!path.ok) return { success: false, error: path.error, code: "INVALID_PATH" };
  if (!Number.isSafeInteger(input.fileSizeBytes) || input.fileSizeBytes < 0 || input.fileSizeBytes > MAX_PROJECT_FILE_BYTES) {
    return { success: false, error: "File too large. Maximum size: 100MB", code: "FILE_TOO_LARGE" };
  }
  const files = await listInternalProjectFiles(access.actor.db, input.projectId);
  if (files.some((file) => projectPathKey(file.relative_path) === projectPathKey(path.path))) {
    return { success: false, error: "A file already exists at this path", code: "DUPLICATE_PATH" };
  }
  const storagePath = `${input.projectId}/project/${crypto.randomUUID()}_${sanitizeStorageFileName(path.segments.at(-1)!)}`;
  const fileName = path.segments.at(-1)!;
  const { data: prepared, error: prepareError } = await access.actor.db
    .from("order_files")
    .insert({
      order_id: input.projectId,
      category: "project",
      file_name: fileName,
      relative_path: path.path,
      storage_path: storagePath,
      mime_type: input.mimeType || null,
      file_size_bytes: input.fileSizeBytes,
      uploaded_by: access.actor.portalUserId,
      file_variant: "original",
      source_file_id: null,
      lifecycle_status: "uploading",
    })
    .select("id")
    .single();
  if (prepareError || !prepared) {
    return {
      success: false,
      error: prepareError?.code === "23505" ? "A file already exists at this path" : "Upload could not start",
      code: prepareError?.code === "23505" ? "DUPLICATE_PATH" : "UPLOAD_FAILED",
    };
  }
  const { data, error } = await access.actor.db.storage
    .from("orders")
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data) {
    await access.actor.db.from("order_files").delete().eq("id", prepared.id);
    return { success: false, error: "Upload could not start", code: "UPLOAD_FAILED" };
  }
  return {
    success: true,
    data: {
      signedUrl: data.signedUrl,
      uploadId: prepared.id as string,
    },
  };
}

export async function finaliseProjectFileUpload(
  projectId: string,
  uploadId: string,
): Promise<ActionResult<ProjectFileMeta>> {
  if (!isValidUUID(projectId) || !isValidUUID(uploadId)) {
    return { success: false, error: "Upload unavailable", code: "NOT_FOUND" };
  }
  const access = await requireVisibleProject(projectId, true);
  if (!access.ok) return { success: false, error: access.error, code: access.code };
  const db = access.actor.db;
  const { data: prepared, error: preparedError } = await db
    .from("order_files")
    .select(PREPARED_FILE_SELECT)
    .eq("id", uploadId)
    .eq("order_id", projectId)
    .eq("category", "project")
    .eq("file_variant", "original")
    .maybeSingle();
  if (preparedError || !prepared) {
    return { success: false, error: "Upload unavailable", code: "NOT_FOUND" };
  }
  const row = prepared as Record<string, unknown>;
  if (row.lifecycle_status === "ready") return { success: true, data: publicFile(row) };
  const storagePath = row.storage_path as string;
  const expectedSize = Number(row.file_size_bytes);
  if (
    row.lifecycle_status !== "uploading" ||
    !Number.isSafeInteger(expectedSize) ||
    expectedSize < 0 ||
    expectedSize > MAX_PROJECT_FILE_BYTES ||
    !storagePath.startsWith(`${projectId}/project/`) ||
    storagePath.split("/").length !== 3
  ) {
    return { success: false, error: "Upload unavailable", code: "NOT_FOUND" };
  }
  const storageName = storagePath.slice(storagePath.lastIndexOf("/") + 1);
  const { data: stored, error: storageError } = await db.storage
    .from("orders")
    .list(`${projectId}/project`, { limit: 2, search: storageName });
  const object = stored?.find((item: { name: string }) => item.name === storageName);
  if (storageError || !object) {
    return { success: false, error: "Upload did not reach storage. Please retry.", code: "UPLOAD_FAILED" };
  }
  const storedSize = validateStoredProjectUploadSize(object, expectedSize);
  if (!storedSize.ok) {
    await db.storage.from("orders").remove([storagePath]);
    await db.from("order_files").delete().eq("id", uploadId).eq("lifecycle_status", "uploading");
    return {
      success: false,
      error: storedSize.reason === "too_large"
        ? "File too large. Maximum size: 100MB"
        : "Stored file size did not match the prepared upload. Please retry.",
      code: storedSize.reason === "too_large" ? "FILE_TOO_LARGE" : "UPLOAD_FAILED",
    };
  }
  const actualSize = storedSize.size;
  const { data, error } = await db
    .from("order_files")
    .update({
      file_size_bytes: actualSize,
      lifecycle_status: "ready",
    })
    .eq("id", uploadId)
    .eq("order_id", projectId)
    .eq("category", "project")
    .eq("lifecycle_status", "uploading")
    .select("id, file_name, relative_path, mime_type, file_size_bytes, lifecycle_status, created_at")
    .single();
  if (error || !data) {
    return { success: false, error: "Upload failed", code: "UPDATE_FAILED" };
  }
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: publicFile(data as Record<string, unknown>) };
}

export async function cancelProjectFileUpload(projectId: string, uploadId: string): Promise<void> {
  if (!isValidUUID(projectId) || !isValidUUID(uploadId)) return;
  const access = await requireVisibleProject(projectId, true);
  if (!access.ok) return;
  const { data } = await access.actor.db
    .from("order_files")
    .select("storage_path")
    .eq("id", uploadId)
    .eq("order_id", projectId)
    .eq("category", "project")
    .eq("file_variant", "original")
    .eq("lifecycle_status", "uploading")
    .maybeSingle();
  if (!data) return;
  await access.actor.db.from("order_files").delete().eq("id", uploadId).eq("lifecycle_status", "uploading");
  await access.actor.db.storage.from("orders").remove([(data as { storage_path: string }).storage_path]);
}

async function authorisedFile(fileId: string, write: boolean) {
  if (!isValidUUID(fileId)) return null;
  const actor = await resolveProjectsActor();
  if (!actor.ok) return null;
  const file = await locateProjectFile(actor.db, fileId);
  if (!file) return null;
  const access = await requireVisibleProject(file.order_id, write);
  if (!access.ok) return null;
  return { actor: access.actor, file };
}

export async function renameProjectFileAction(fileId: string, nextName: string) {
  const found = await authorisedFile(fileId, true);
  if (!found) return { success: false, error: "File unavailable", code: "NOT_FOUND" } as const;
  const result = await renameProjectFile(found.actor.db, found.file, nextName);
  if (result.success) revalidatePath(`/projects/${found.file.order_id}`);
  return result;
}

export async function renameProjectFolderAction(projectId: string, folderPath: string, nextName: string) {
  const access = await requireVisibleProject(projectId, true);
  if (!access.ok) return { success: false, error: "Folder unavailable", code: "NOT_FOUND" } as const;
  const result = await renameProjectFolder(access.actor.db, projectId, folderPath, nextName);
  if (result.success) revalidatePath(`/projects/${projectId}`);
  return result;
}

export async function deleteProjectFileAction(fileId: string) {
  const found = await authorisedFile(fileId, true);
  if (!found) return { success: false, error: "File unavailable", code: "NOT_FOUND" } as const;
  const result = await deleteProjectFiles(found.actor.db, [found.file]);
  if (result.success) revalidatePath(`/projects/${found.file.order_id}`);
  return result;
}

export async function deleteProjectFolderAction(projectId: string, folderPath: string) {
  const access = await requireVisibleProject(projectId, true);
  const path = normaliseProjectPath(folderPath);
  if (!access.ok || !path.ok) return { success: false, error: "Folder unavailable", code: "NOT_FOUND" } as const;
  const files = (await listInternalProjectFiles(access.actor.db, projectId)).filter(
    (file) => file.relative_path.startsWith(`${path.path}/`),
  );
  const result = await deleteProjectFiles(access.actor.db, files);
  if (result.success) revalidatePath(`/projects/${projectId}`);
  return result;
}

export async function getProjectFileUrlAction(
  fileId: string,
  mode: "preview" | "download",
): Promise<ActionResult<{ url: string; fileName: string; mimeType: string | null }>> {
  const found = await authorisedFile(fileId, false);
  if (!found) return { success: false, error: "File unavailable", code: "NOT_FOUND" };
  const mimeType = found.file.mime_type?.toLowerCase() ?? null;
  if (mode === "preview" && !isPreviewableProjectMimeType(mimeType)) {
    return { success: false, error: "Preview is unavailable for this file type", code: "PREVIEW_UNAVAILABLE" };
  }
  const { data, error } = await found.actor.db.storage.from("orders").createSignedUrl(
    found.file.storage_path,
    120,
    mode === "download" ? { download: found.file.file_name } : undefined,
  );
  if (error || !data?.signedUrl) return { success: false, error: "File unavailable", code: "NOT_FOUND" };
  return { success: true, data: { url: data.signedUrl, fileName: found.file.file_name, mimeType } };
}
