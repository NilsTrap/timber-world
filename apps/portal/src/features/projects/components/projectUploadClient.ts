"use client";

import {
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
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.min(95, Math.round((event.loaded / event.total) * 95)));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Upload failed. Please retry."));
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed. Please retry.")));
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
  await putSignedFile(prepared.data.signedUrl, file, onProgress);
  onProgress(97);
  const finalised = await finaliseProjectFileUpload(projectId, prepared.data);
  if (!finalised.success) throw new Error(finalised.error);
  onProgress(100);
  return finalised.data;
}
