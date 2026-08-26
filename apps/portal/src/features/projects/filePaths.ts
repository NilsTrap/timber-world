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

export function normaliseProjectMimeType(value: string | null): string | null {
  if (!value) return null;
  const mimeType = value.normalize("NFC").trim().toLowerCase().split(";", 1)[0] ?? "";
  return mimeType.length <= 255 && /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(mimeType)
    ? mimeType
    : null;
}

export function storedProjectMimeType(storedObject: unknown): string | null {
  if (!storedObject || typeof storedObject !== "object") return null;
  const metadata = (storedObject as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as { mimetype?: unknown; contentType?: unknown }).mimetype
    ?? (metadata as { contentType?: unknown }).contentType;
  return typeof raw === "string" ? normaliseProjectMimeType(raw) : null;
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
  // file-selector (used by react-dropzone) represents an ordinary selected
  // file as `./name.ext` and dropped entries with a leading `/`. Strip exactly
  // those browser transport markers; the strict boundary still rejects `../`.
  const browserPath = supplied.startsWith("./")
    ? supplied.slice(2)
    : supplied.replace(/^\/+/, "");
  return normaliseProjectPath(browserPath);
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
  folders: readonly { relativePath: string }[] = [],
): ProjectTreeNode[] {
  const root: ProjectTreeNode[] = [];
  const folderNodes = new Map<string, ProjectTreeNode>();
  const ensureFolder = (segments: string[]): ProjectTreeNode | null => {
    let parent = root;
    let folder: ProjectTreeNode | null = null;
    for (let index = 0; index < segments.length; index++) {
      const path = segments.slice(0, index + 1).join("/");
      folder = folderNodes.get(path) ?? null;
      if (!folder) {
        folder = { kind: "folder", name: segments[index]!, path, children: [] };
        folderNodes.set(path, folder);
        parent.push(folder);
      }
      parent = folder.children;
    }
    return folder;
  };
  for (const row of folders) {
    const valid = normaliseProjectPath(row.relativePath);
    if (valid.ok) ensureFolder(valid.segments);
  }
  for (const file of [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
    const valid = normaliseProjectPath(file.relativePath);
    if (!valid.ok) continue;
    const parentFolder = ensureFolder(valid.segments.slice(0, -1));
    const parent = parentFolder?.children ?? root;
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
