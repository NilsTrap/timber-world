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
} from "../filePaths";
import type { ProjectFileMeta } from "../types";
import { requireVisibleProject } from "./_projectAccess";
import { resolveProjectsActor } from "../access";

export interface PreparedProjectUpload {
  signedUrl: string;
  storagePath: string;
  relativePath: string;
  mimeType: string | null;
  fileSizeBytes: number;
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
  const { data, error } = await access.actor.db.storage
    .from("orders")
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data) return { success: false, error: "Upload could not start", code: "UPLOAD_FAILED" };
  return {
    success: true,
    data: {
      signedUrl: data.signedUrl,
      storagePath,
      relativePath: path.path,
      mimeType: input.mimeType || null,
      fileSizeBytes: input.fileSizeBytes,
    },
  };
}

export async function finaliseProjectFileUpload(
  projectId: string,
  prepared: PreparedProjectUpload,
): Promise<ActionResult<ProjectFileMeta>> {
  const access = await requireVisibleProject(projectId, true);
  if (!access.ok) return { success: false, error: access.error, code: access.code };
  const path = normaliseProjectPath(prepared.relativePath);
  if (
    !path.ok ||
    prepared.fileSizeBytes < 0 ||
    prepared.fileSizeBytes > MAX_PROJECT_FILE_BYTES ||
    !prepared.storagePath.startsWith(`${projectId}/project/`) ||
    prepared.storagePath.split("/").length !== 3
  ) {
    return { success: false, error: "Upload unavailable", code: "NOT_FOUND" };
  }
  const db = access.actor.db;
  const storageName = prepared.storagePath.slice(prepared.storagePath.lastIndexOf("/") + 1);
  const { data: stored, error: storageError } = await db.storage
    .from("orders")
    .list(`${projectId}/project`, { limit: 2, search: storageName });
  if (storageError || !stored?.some((item: { name: string }) => item.name === storageName)) {
    return { success: false, error: "Upload did not reach storage. Please retry.", code: "UPLOAD_FAILED" };
  }
  const current = await listInternalProjectFiles(db, projectId);
  const duplicate = current.find(
    (file) => projectPathKey(file.relative_path) === projectPathKey(path.path),
  );
  if (duplicate) {
    if (duplicate.storage_path !== prepared.storagePath) {
      await db.storage.from("orders").remove([prepared.storagePath]);
    }
    const safe = await db
      .from("order_files")
      .select("id, file_name, relative_path, mime_type, file_size_bytes, lifecycle_status, created_at")
      .eq("id", duplicate.id)
      .single();
    if (safe.data) {
      const row = safe.data as Record<string, unknown>;
      return {
        success: true,
        data: {
          id: row.id as string,
          fileName: row.file_name as string,
          relativePath: row.relative_path as string,
          mimeType: (row.mime_type as string) ?? null,
          fileSizeBytes: (row.file_size_bytes as number) ?? null,
          lifecycleStatus: "ready",
          createdAt: row.created_at as string,
        },
      };
    }
  }
  const fileName = path.segments.at(-1)!;
  const { data, error } = await db
    .from("order_files")
    .insert({
      order_id: projectId,
      category: "project",
      file_name: fileName,
      relative_path: path.path,
      storage_path: prepared.storagePath,
      mime_type: prepared.mimeType || null,
      file_size_bytes: prepared.fileSizeBytes,
      uploaded_by: access.actor.portalUserId,
      file_variant: "original",
      source_file_id: null,
      lifecycle_status: "ready",
    })
    .select("id, file_name, relative_path, mime_type, file_size_bytes, lifecycle_status, created_at")
    .single();
  if (error || !data) {
    await db.storage.from("orders").remove([prepared.storagePath]);
    return { success: false, error: error?.code === "23505" ? "A file already exists at this path" : "Upload failed", code: error?.code === "23505" ? "DUPLICATE_PATH" : "INSERT_FAILED" };
  }
  revalidatePath(`/projects/${projectId}`);
  const row = data as Record<string, unknown>;
  return {
    success: true,
    data: {
      id: row.id as string,
      fileName: row.file_name as string,
      relativePath: row.relative_path as string,
      mimeType: (row.mime_type as string) ?? null,
      fileSizeBytes: (row.file_size_bytes as number) ?? null,
      lifecycleStatus: "ready",
      createdAt: row.created_at as string,
    },
  };
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
