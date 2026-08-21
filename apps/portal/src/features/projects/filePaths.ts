export const MAX_PROJECT_FILE_BYTES = 100 * 1024 * 1024;
export const PROJECT_PREVIEW_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
]);

export function isPreviewableProjectMimeType(mimeType: string | null): boolean {
  return !!mimeType && PROJECT_PREVIEW_MIME_TYPES.has(mimeType.toLowerCase());
}

export type StoredUploadSizeValidation =
  | { ok: true; size: number }
  | { ok: false; reason: "missing" | "mismatch" | "too_large" };

/** Validate Storage's persisted object metadata, never caller-supplied bytes. */
export function validateStoredProjectUploadSize(
  storedObject: unknown,
  expectedSize: number,
): StoredUploadSizeValidation {
  if (!storedObject || typeof storedObject !== "object") return { ok: false, reason: "missing" };
  const metadata = (storedObject as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") return { ok: false, reason: "missing" };
  const raw = (metadata as { size?: unknown }).size;
  const size = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0) {
    return { ok: false, reason: "missing" };
  }
  if (size > MAX_PROJECT_FILE_BYTES) return { ok: false, reason: "too_large" };
  if (size !== expectedSize) return { ok: false, reason: "mismatch" };
  return { ok: true, size };
}

export type PathValidation =
  | { ok: true; path: string; segments: string[] }
  | { ok: false; error: string };

/** Strict server-safe relative path. Browser-specific leading slashes are
 * removed by `pathFromBrowserFile` before this boundary. */
export function normaliseProjectPath(input: string): PathValidation {
  if (typeof input !== "string") return { ok: false, error: "Invalid path" };
  const canonical = input.normalize("NFC").replaceAll("\\", "/");
  if (!canonical || canonical.startsWith("/") || /^[a-z]:\//i.test(canonical)) {
    return { ok: false, error: "Path must be relative" };
  }
  const segments = canonical.split("/");
  if (
    segments.some(
      (part) =>
        part.trim().length === 0 ||
        part === "." ||
        part === ".." ||
        part.includes("\0") ||
        part.length > 255,
    )
  ) {
    return { ok: false, error: "Path contains an invalid name" };
  }
  const path = segments.join("/");
  if (path.length > 1024) return { ok: false, error: "Path is too long" };
  return { ok: true, path, segments };
}

export function normaliseProjectName(input: string): string | null {
  const value = input.normalize("NFC").trim();
  if (!value || value === "." || value === ".." || /[/\\\0]/.test(value)) return null;
  return value.length <= 255 ? value : null;
}

export function projectPathKey(path: string): string {
  return path.normalize("NFC").toLocaleLowerCase("en-US");
}

export function pathFromBrowserFile(file: File & { path?: string }): PathValidation {
  const supplied = file.webkitRelativePath || file.path || file.name;
  // file-selector (used by react-dropzone) prefixes dropped paths with `/`.
  // This strips only its transport marker; the strict server boundary above
  // still rejects caller-supplied absolute paths.
  return normaliseProjectPath(supplied.replace(/^\/+/, ""));
}

export function replacePathPrefix(path: string, from: string, to: string): string {
  return path === from ? to : path.startsWith(`${from}/`) ? `${to}${path.slice(from.length)}` : path;
}

export interface ProjectTreeNode {
  kind: "folder" | "file";
  name: string;
  path: string;
  children: ProjectTreeNode[];
  fileId?: string;
}

export function buildProjectTree(
  files: readonly { id?: string; relativePath: string }[],
): ProjectTreeNode[] {
  const root: ProjectTreeNode[] = [];
  const folders = new Map<string, ProjectTreeNode>();
  for (const file of [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
    const valid = normaliseProjectPath(file.relativePath);
    if (!valid.ok) continue;
    let parent = root;
    for (let index = 0; index < valid.segments.length - 1; index++) {
      const path = valid.segments.slice(0, index + 1).join("/");
      let folder = folders.get(path);
      if (!folder) {
        folder = { kind: "folder", name: valid.segments[index]!, path, children: [] };
        folders.set(path, folder);
        parent.push(folder);
      }
      parent = folder.children;
    }
    parent.push({
      kind: "file",
      name: valid.segments.at(-1)!,
      path: valid.path,
      children: [],
      fileId: file.id,
    });
  }
  const sortNodes = (nodes: ProjectTreeNode[]) => {
    nodes.sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1,
    );
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(root);
  return root;
}
