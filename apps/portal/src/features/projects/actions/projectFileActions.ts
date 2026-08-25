"use server";

import { revalidatePath } from "next/cache";
import { sanitizeStorageFileName } from "@/lib/utils/storage";
import type { ActionResult } from "../../orders/types";
import { isValidUUID } from "../../orders/types";
import {
  createProjectFolder,
  cancelProjectUpload,
  deleteProjectFolderTree,
  deleteProjectFiles,
  ensureProjectFolders,
  expireProjectUploads,
  listInternalProjectFiles,
  listInternalProjectFolders,
  locateProjectFile,
  moveProjectFile,
  moveProjectFolder,
  renameProjectFile,
  renameProjectFolder,
} from "../services/projectFiles";
import {
  MAX_PROJECT_FILE_BYTES,
  isPreviewableProjectMimeType,
  normaliseProjectName,
  normaliseProjectMimeType,
  normaliseProjectPath,
  projectPathKey,
  storedProjectMimeType,
  validateStoredProjectUploadSize,
} from "../filePaths";
import type { ProjectFileMeta } from "../types";
import { requireVisibleProject } from "./_projectAccess";
import { resolveProjectsActor } from "../access";
import { authoriseProjectFileWith } from "./_projectFileAccess";

export interface PreparedProjectUpload {
  signedUrl: string;
  uploadId: string;
}

const PREPARED_FILE_SELECT =
  "id, order_id, file_name, relative_path, mime_type, file_size_bytes, storage_path, lifecycle_status, created_at";

async function authoriseProjectFile(fileId: string, write: boolean) {
  return authoriseProjectFileWith(fileId, write, {
    resolveActor: resolveProjectsActor,
    locateFile: locateProjectFile,
    requireProject: requireVisibleProject,
  });
}

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
  const mimeType = normaliseProjectMimeType(input.mimeType);
  if (input.mimeType && !mimeType) {
    return { success: false, error: "File type is invalid", code: "INVALID_FILE_TYPE" };
  }
  await expireProjectUploads(access.actor.db, input.projectId);
  const files = await listInternalProjectFiles(access.actor.db, input.projectId);
  if (files.some((file) => projectPathKey(file.relative_path) === projectPathKey(path.path))) {
    return { success: false, error: "A file already exists at this path", code: "DUPLICATE_PATH" };
  }
  const folders = await listInternalProjectFolders(access.actor.db, input.projectId);
  if (folders.some((folder) => projectPathKey(folder.relative_path) === projectPathKey(path.path))) {
    return { success: false, error: "A folder already exists at this path", code: "DUPLICATE_PATH" };
  }
  const folderResult = await ensureProjectFolders(
    access.actor.db,
    input.projectId,
    path.path,
    access.actor.portalUserId,
  );
  if (!folderResult.success) return folderResult;
  const storagePath = `${input.projectId}/project/${crypto.randomUUID()}_${sanitizeStorageFileName(path.segments.at(-1)!)}`;
  const fileName = path.segments.at(-1)!;
  const { data: prepared, error: prepareError } = await access.actor.db
    .from("order_files")
    .insert({
      order_id: input.projectId,
      category: "project",
      file_name: fileName,
      relative_path: folderResult.data.relativePath,
      storage_path: storagePath,
      mime_type: mimeType,
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
    await cancelProjectUpload(access.actor.db, input.projectId, prepared.id as string);
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
    await cancelProjectUpload(db, projectId, uploadId);
    await db.storage.from("orders").remove([storagePath]);
    return {
      success: false,
      error: storedSize.reason === "too_large"
        ? "File too large. Maximum size: 100MB"
        : "Stored file size did not match the prepared upload. Please retry.",
      code: storedSize.reason === "too_large" ? "FILE_TOO_LARGE" : "UPLOAD_FAILED",
    };
  }
  const expectedMimeType = normaliseProjectMimeType(row.mime_type as string | null);
  const storedMimeType = storedProjectMimeType(object);
  if (expectedMimeType && expectedMimeType !== storedMimeType) {
    await cancelProjectUpload(db, projectId, uploadId);
    await db.storage.from("orders").remove([storagePath]);
    return { success: false, error: "Stored file type did not match the prepared upload. Please retry.", code: "UPLOAD_FAILED" };
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
  await cancelProjectUpload(access.actor.db, projectId, uploadId);
}

export async function renameProjectFileAction(fileId: string, nextName: string) {
  const found = await authoriseProjectFile(fileId, true);
  if (!found.ok) return { success: false, error: found.error, code: found.code } as const;
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

export async function createProjectFolderAction(projectId: string, parentPath: string, nameInput: string) {
  const access = await requireVisibleProject(projectId, true);
  if (!access.ok) return { success: false, error: "Folder unavailable", code: "NOT_FOUND" } as const;
  const name = normaliseProjectName(nameInput);
  if (!name) return { success: false, error: "Enter a valid folder name", code: "INVALID_NAME" } as const;
  const parent = parentPath === "" ? null : normaliseProjectPath(parentPath);
  if (parent && !parent.ok) return { success: false, error: "Folder unavailable", code: "NOT_FOUND" } as const;
  const relativePath = parent?.ok ? `${parent.path}/${name}` : name;
  const result = await createProjectFolder(access.actor.db, projectId, relativePath, access.actor.portalUserId);
  if (result.success) revalidatePath(`/projects/${projectId}`);
  return result;
}

export async function moveProjectFileAction(fileId: string, targetFolder: string) {
  const found = await authoriseProjectFile(fileId, true);
  if (!found.ok) return { success: false, error: found.error, code: found.code } as const;
  const result = await moveProjectFile(found.actor.db, found.file, targetFolder);
  if (result.success) revalidatePath(`/projects/${found.file.order_id}`);
  return result;
}

export async function moveProjectFolderAction(projectId: string, sourcePath: string, targetParent: string) {
  const access = await requireVisibleProject(projectId, true);
  if (!access.ok) return { success: false, error: "Folder unavailable", code: "NOT_FOUND" } as const;
  const result = await moveProjectFolder(access.actor.db, projectId, sourcePath, targetParent);
  if (result.success) revalidatePath(`/projects/${projectId}`);
  return result;
}

export async function deleteProjectFileAction(fileId: string) {
  const found = await authoriseProjectFile(fileId, true);
  if (!found.ok) return { success: false, error: found.error, code: found.code } as const;
  const result = await deleteProjectFiles(found.actor.db, [found.file]);
  if (result.success) revalidatePath(`/projects/${found.file.order_id}`);
  return result;
}

export async function deleteProjectFolderAction(projectId: string, folderPath: string, expectedFileIds: string[]) {
  const access = await requireVisibleProject(projectId, true);
  const path = normaliseProjectPath(folderPath);
  if (!access.ok || !path.ok) return { success: false, error: "Folder unavailable", code: "NOT_FOUND" } as const;
  await expireProjectUploads(access.actor.db, projectId);
  const files = (await listInternalProjectFiles(access.actor.db, projectId)).filter(
    (file) => projectPathKey(file.relative_path).startsWith(`${projectPathKey(path.path)}/`),
  );
  const expected = [...new Set(expectedFileIds)];
  if (expected.some((id) => !isValidUUID(id))
    || expected.length !== files.length
    || expected.some((id) => !files.some((file) => file.id === id))) {
    return { success: false, error: "Folder contents changed. Review the files and retry.", code: "CONTENTS_CHANGED" } as const;
  }
  const folderResult = await deleteProjectFolderTree(access.actor.db, projectId, path.path, files);
  if (folderResult.success) revalidatePath(`/projects/${projectId}`);
  return folderResult;
}

export async function deleteProjectFilesAction(fileIds: string[]) {
  const unique = [...new Set(fileIds)];
  if (unique.length > 200) {
    return { success: false, error: "Delete up to 200 files at a time", code: "TOO_MANY_FILES" } as const;
  }
  if (unique.length === 0 || unique.some((id) => !isValidUUID(id))) {
    return { success: false, error: "Files unavailable", code: "NOT_FOUND" } as const;
  }
  const authorised = await Promise.all(unique.map((id) => authoriseProjectFile(id, true)));
  if (authorised.some((item) => !item.ok)) {
    return { success: false, error: "Files unavailable", code: "NOT_FOUND" } as const;
  }
  const ready = authorised.filter((item): item is Extract<typeof item, { ok: true }> => item.ok);
  const orderId = ready[0]!.file.order_id;
  if (ready.some((item) => item.file.order_id !== orderId)) {
    return { success: false, error: "Files unavailable", code: "NOT_FOUND" } as const;
  }
  const result = await deleteProjectFiles(ready[0]!.actor.db, ready.map((item) => item.file));
  if (result.success) revalidatePath(`/projects/${orderId}`);
  return result;
}

export async function getProjectFileUrlAction(
  fileId: string,
  mode: "preview" | "download",
): Promise<ActionResult<{ url: string; fileName: string; mimeType: string | null }>> {
  const found = await authoriseProjectFile(fileId, false);
  if (!found.ok) return { success: false, error: found.error, code: found.code };
  if (found.file.lifecycle_status !== "ready") {
    return { success: false, error: "File upload is not complete", code: "NOT_READY" };
  }
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
