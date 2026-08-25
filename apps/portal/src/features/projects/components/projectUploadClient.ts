"use client";

import {
  cancelProjectFileUpload,
  finaliseProjectFileUpload,
  prepareProjectFileUpload,
} from "../actions/projectFileActions";
import type { ProjectFileMeta } from "../types";

function putSignedFile(
  signedUrl: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.timeout = 5 * 60 * 1000;
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.min(95, Math.round((event.loaded / event.total) * 95)));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 401 || xhr.status === 403) reject(new Error("Upload authorization expired. Please retry."));
      else if (xhr.status === 409) reject(new Error("A file already exists at this location."));
      else if (xhr.status === 413) reject(new Error("File too large. Maximum size: 100MB."));
      else reject(new Error(`Storage rejected the upload (${xhr.status || "network error"}). Please retry.`));
    });
    xhr.addEventListener("error", () => reject(new Error("Storage could not be reached. Please retry.")));
    xhr.addEventListener("timeout", () => reject(new Error("Upload timed out. Please retry.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled.")));
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    xhr.send(body);
  });
}
export async function uploadProjectBrowserFile(
  projectId: string,
  file: File,
  relativePath: string,
  onProgress: (progress: number) => void,
): Promise<ProjectFileMeta> {
  onProgress(1);
  const prepared = await prepareProjectFileUpload({
    projectId,
    relativePath,
    mimeType: file.type || null,
    fileSizeBytes: file.size,
  });
  if (!prepared.success) throw new Error(prepared.error);
  try {
    await putSignedFile(prepared.data.signedUrl, file, onProgress);
    onProgress(97);
    let finalised;
    try {
      finalised = await finaliseProjectFileUpload(projectId, prepared.data.uploadId);
    } catch {
      finalised = await finaliseProjectFileUpload(projectId, prepared.data.uploadId);
    }
    // A network interruption can hide a successful finalisation response.
    // Re-reading the same upload id is idempotent and returns the ready row.
    if (!finalised.success) finalised = await finaliseProjectFileUpload(projectId, prepared.data.uploadId);
    if (!finalised.success) throw new Error(finalised.error);
    onProgress(100);
    return finalised.data;
  } catch (error) {
    await cancelProjectFileUpload(projectId, prepared.data.uploadId);
    throw error;
  }
}
