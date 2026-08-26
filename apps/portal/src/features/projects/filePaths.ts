export const MAX_PROJECT_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES = 25 * 1024 * 1024;

export type ProjectPreviewKind = "native" | "html" | "dxf" | "step";
export type ProjectFileKind =
  | "pdf"
  | "image"
  | "html"
  | "dxf"
  | "step"
  | "nc1"
  | "document"
  | "spreadsheet"
  | "archive"
  | "code"
  | "unknown";

const RASTER_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);
const RASTER_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"]);

export function projectFileExtension(fileName: string): string {
  const leaf = fileName.split("/").at(-1)?.trim().toLowerCase() ?? "";
  const dot = leaf.lastIndexOf(".");
  return dot > 0 && dot < leaf.length - 1 ? leaf.slice(dot + 1) : "";
}

export function getProjectPreviewKind(
  fileName: string,
  mimeType: string | null,
): ProjectPreviewKind | null {
  const extension = projectFileExtension(fileName);
  const mime = mimeType?.toLowerCase().split(";", 1)[0]?.trim() ?? "";
  if (extension === "nc1") return null;
  const kind = classifyProjectFile(fileName, mimeType);
  if (kind === "html") return "html";
  if (kind === "dxf") return "dxf";
  if (kind === "step") return "step";
  if (kind === "pdf") return "native";
  if (kind === "image" && (RASTER_EXTENSIONS.has(extension) || RASTER_MIME_TYPES.has(mime))) return "native";
  return null;
}

export function isPreviewableProjectFile(fileName: string, mimeType: string | null): boolean {
  return getProjectPreviewKind(fileName, mimeType) !== null;
}

export function classifyProjectFile(fileName: string, mimeType: string | null): ProjectFileKind {
  const extension = projectFileExtension(fileName);
  const mime = mimeType?.toLowerCase().split(";", 1)[0]?.trim() ?? "";
  if (extension === "pdf") return "pdf";
  if (["html", "htm"].includes(extension)) return "html";
  if (extension === "dxf") return "dxf";
  if (["step", "stp"].includes(extension)) return "step";
  if (extension === "nc1") return "nc1";
  if ([...RASTER_EXTENSIONS, "svg", "heic", "heif"].includes(extension)) return "image";
  if (["doc", "docx", "txt", "rtf", "odt"].includes(extension)) return "document";
  if (["xls", "xlsx", "csv", "ods"].includes(extension)) return "spreadsheet";
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "archive";
  if (["json", "xml", "css", "js", "ts", "tsx"].includes(extension)) return "code";

  if (mime === "application/pdf") return "pdf";
  if (mime === "text/html") return "html";
  if (["application/dxf", "application/vnd.dxf", "application/x-dxf", "image/vnd.dxf"].includes(mime)) return "dxf";
  if (["application/step", "application/x-step", "model/step", "model/step+xml"].includes(mime)) return "step";
  if (mime.startsWith("image/")) return "image";
  if (["text/plain", "application/rtf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(mime)) return "document";
  if (["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(mime)) return "spreadsheet";
  if (["application/zip", "application/x-7z-compressed", "application/vnd.rar", "application/gzip", "application/x-tar"].includes(mime)) return "archive";
  if (["application/json", "application/xml", "text/xml", "text/css", "text/javascript"].includes(mime)) return "code";
  return "unknown";
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
