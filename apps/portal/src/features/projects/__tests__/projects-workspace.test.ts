/** Timber Projects creation/path/tree/security contract (pure + source guards). */
import { readFileSync } from "node:fs";
import { evaluateProjectCapabilities } from "../capabilities";
import {
  MAX_PROJECT_FILE_BYTES,
  buildProjectTree,
  isPreviewableProjectMimeType,
  normaliseProjectMimeType,
  normaliseProjectName,
  normaliseProjectPath,
  pathFromBrowserFile,
  projectPathKey,
  replacePathPrefix,
  storedProjectMimeType,
  validateStoredProjectUploadSize,
} from "../filePaths";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else { failed++; console.error(`✗ ${label}\n expected ${JSON.stringify(expected)}\n actual ${JSON.stringify(actual)}`); }
}
function ok(label: string, value: boolean) {
  if (value) passed++; else { failed++; console.error(`✗ ${label}`); }
}

// Creation is rights AND persona gated. Flags alone never grant the action.
eq("buyer + effective deal:create can create", evaluateProjectCapabilities({ isPlatformAdmin: false, hasDealCreate: true, organisationId: "org", personas: ["buyer"] }), { canWriteFiles: true, canCreateProject: true, createRoles: ["buyer"] });
eq("trader + effective deal:create can create", evaluateProjectCapabilities({ isPlatformAdmin: false, hasDealCreate: true, organisationId: "org", personas: ["trader"] }), { canWriteFiles: true, canCreateProject: true, createRoles: ["trader"] });
eq("dual-role org must choose one of two roles", evaluateProjectCapabilities({ isPlatformAdmin: false, hasDealCreate: true, organisationId: "org", personas: ["buyer", "trader"] }).createRoles, ["buyer", "trader"]);
eq("buyer flag without the action cannot create", evaluateProjectCapabilities({ isPlatformAdmin: false, hasDealCreate: false, organisationId: "org", personas: ["buyer"] }).canCreateProject, false);
eq("supplier cannot create even with deal:create", evaluateProjectCapabilities({ isPlatformAdmin: false, hasDealCreate: true, organisationId: "org", personas: ["supplier"] }).canCreateProject, false);
eq("supplier with explicit write right may edit its visible deal only", evaluateProjectCapabilities({ isPlatformAdmin: false, hasDealCreate: true, organisationId: "org", personas: ["supplier"] }).canWriteFiles, true);
eq("admin without an org uses the platform trader binding", evaluateProjectCapabilities({ isPlatformAdmin: true, hasDealCreate: false, organisationId: null, personas: [] }), { canWriteFiles: true, canCreateProject: true, createRoles: ["trader"] });

// Strict path boundary + browser-friendly tree persistence.
for (const bad of ["", "/root/a.pdf", "C:/a.pdf", "../a.pdf", "a/../b.pdf", "a//b.pdf", "a/./b.pdf", "a/ "]) {
  ok(`reject invalid path ${JSON.stringify(bad)}`, !normaliseProjectPath(bad).ok);
}
eq("normalise Windows separators", normaliseProjectPath("drawings\\final\\A.pdf"), { ok: true, path: "drawings/final/A.pdf", segments: ["drawings", "final", "A.pdf"] });
eq("react-dropzone single-file marker is removed", pathFromBrowserFile({ name: "quote.pdf", path: "./quote.pdf", webkitRelativePath: "" } as File & { path: string }), { ok: true, path: "quote.pdf", segments: ["quote.pdf"] });
eq("dropped folder leading slash is removed", pathFromBrowserFile({ name: "quote.pdf", path: "/drawings/quote.pdf", webkitRelativePath: "" } as File & { path: string }), { ok: true, path: "drawings/quote.pdf", segments: ["drawings", "quote.pdf"] });
ok("parent traversal is not treated as a browser marker", !pathFromBrowserFile({ name: "quote.pdf", path: "../quote.pdf", webkitRelativePath: "" } as File & { path: string }).ok);
eq("case-insensitive duplicate key", projectPathKey("Drawings/A.PDF"), projectPathKey("drawings/a.pdf"));
eq("reject blank file name", normaliseProjectName("  "), null);
eq("reject separators in a rename", normaliseProjectName("folder/name"), null);
eq("100 MB is accepted by the contract", MAX_PROJECT_FILE_BYTES, 104857600);
eq("stored upload accepts the exact prepared byte count", validateStoredProjectUploadSize({ metadata: { size: "42" } }, 42), { ok: true, size: 42 });
eq("stored upload rejects a caller size mismatch", validateStoredProjectUploadSize({ metadata: { size: 43 } }, 42), { ok: false, reason: "mismatch" });
eq("stored upload rejects an actual object over 100 MB", validateStoredProjectUploadSize({ metadata: { size: MAX_PROJECT_FILE_BYTES + 1 } }, 1), { ok: false, reason: "too_large" });
eq("stored upload fails closed without size metadata", validateStoredProjectUploadSize({ metadata: {} }, 0), { ok: false, reason: "missing" });
eq("recursive folder rename keeps descendants", replacePathPrefix("a/b/c.pdf", "a", "renamed"), "renamed/b/c.pdf");
eq("unrelated prefix is untouched", replacePathPrefix("ab/c.pdf", "a", "renamed"), "ab/c.pdf");

const tree = buildProjectTree([
  { id: "1", relativePath: "drawings/final/a.pdf" },
  { id: "2", relativePath: "drawings/source/b.dwg" },
  { id: "3", relativePath: "readme.txt" },
]);
eq("reopened tree keeps top-level names", tree.map((node) => [node.kind, node.name]), [["folder", "drawings"], ["file", "readme.txt"]]);
eq("nested folders are reconstructed", tree[0]?.children.map((node) => node.name), ["final", "source"]);
eq("deep file path is preserved", tree[0]?.children[0]?.children[0]?.path, "drawings/final/a.pdf");
const treeWithEmptyFolder = buildProjectTree([], [{ relativePath: "empty/nested" }]);
eq("persisted empty folder survives without files", treeWithEmptyFolder[0]?.children[0]?.path, "empty/nested");

ok("PDF preview is allowlisted", isPreviewableProjectMimeType("application/pdf"));
ok("raster image preview is allowlisted", isPreviewableProjectMimeType("image/png"));
ok("SVG is not previewed as a raster image", !isPreviewableProjectMimeType("image/svg+xml"));
ok("office/archive preview is unavailable", !isPreviewableProjectMimeType("application/zip"));
eq("MIME values are canonicalised", normaliseProjectMimeType(" Application/PDF; charset=binary "), "application/pdf");
eq("invalid MIME values fail closed", normaliseProjectMimeType("not a mime"), null);
eq("stored MIME comes from object metadata", storedProjectMimeType({ metadata: { mimetype: "IMAGE/PNG" } }), "image/png");
eq("missing stored MIME fails closed", storedProjectMimeType({ metadata: {} }), null);

// Source guards protect the easy-to-regress serialization/direct-ID boundaries.
const service = readFileSync("src/features/projects/services/projectFiles.ts", "utf8");
const actions = readFileSync("src/features/projects/actions/projectFileActions.ts", "utf8");
const create = readFileSync("src/features/projects/actions/createProject.ts", "utf8");
const workspace = readFileSync("src/features/projects/components/ProjectFileWorkspace.tsx", "utf8");
const migration = readFileSync("../../supabase/migrations/20260821211500_project_file_workspace.sql", "utf8");
const folderMigration = readFileSync("../../supabase/migrations/20260826090000_project_workspace_folders.sql", "utf8");
const buyerAccessMigration = readFileSync("../../supabase/migrations/20260826130000_buyer_project_workspace_access.sql", "utf8");
ok("metadata loader select excludes storage_path", /const SAFE_FILE_SELECT\s*=\s*[\s\S]*?;/.test(service) && !service.match(/const SAFE_FILE_SELECT\s*=\s*([\s\S]*?);/)?.[1]?.includes("storage_path"));
ok("workspace reads only category=project", service.includes('.eq("category", PROJECT_CATEGORY)'));
ok("workspace reads originals only", service.includes('.eq("file_variant", ORIGINAL_VARIANT)'));
ok("file-id actions collapse denial to File unavailable", actions.includes('error: "File unavailable"'));
ok("creation delegates idempotency to createDeal", create.includes("idempotencyKey: `project-${input.idempotencyKey}`"));
ok("download asks storage for the persisted filename", actions.includes('{ download: found.file.file_name }'));
ok("prepared upload response never exposes a storage path", /interface PreparedProjectUpload\s*{[^}]*signedUrl: string;[^}]*uploadId: string;[^}]*}/.test(actions));
ok("preparation persists an uploading row before signing", actions.indexOf('lifecycle_status: "uploading"') < actions.indexOf(".createSignedUploadUrl(storagePath"));
ok("finalisation is bound to project and upload IDs", actions.includes('.eq("id", uploadId)') && actions.includes('.eq("order_id", projectId)'));
ok("finalisation reads actual storage metadata size", actions.includes("validateStoredProjectUploadSize(object, expectedSize)"));
ok("finalisation verifies stored MIME metadata", actions.includes("storedProjectMimeType(object)"));
ok("signed reads require a ready file", actions.includes('found.file.lifecycle_status !== "ready"'));
ok("invalid stored objects are removed before retry", actions.includes("if (!storedSize.ok)") && actions.includes('.remove([storagePath])'));
ok("orders bucket rejects uploads over 100 MB", migration.includes("file_size_limit = LEAST(COALESCE(file_size_limit, 104857600), 104857600)"));
ok("narrow workspace renders folders", workspace.includes('<MobileFolderRows nodes={tree}'));
ok("mobile folder actions stay visible and touch-safe", workspace.includes('aria-label={`Rename folder ${node.path}`}') && workspace.includes('aria-label={`Delete folder ${node.path}`}') && workspace.includes('className="h-11 w-11"'));
ok("empty folders have an RLS-walled persistence table", folderMigration.includes("CREATE TABLE IF NOT EXISTS public.project_folders") && folderMigration.includes("public.can_write_project_files(order_id)"));
ok("folder moves update folder and file descendants transactionally", folderMigration.includes("move_project_workspace_folder") && folderMigration.includes("UPDATE public.project_folders") && folderMigration.includes("UPDATE public.order_files"));
ok("folder delete metadata is transactional", folderMigration.includes("delete_project_workspace_folder") && folderMigration.includes("p_expected_file_ids"));
ok("file deletion is durably queued before metadata removal", folderMigration.includes("project_storage_cleanup") && folderMigration.includes("delete_project_workspace_files") && folderMigration.includes("complete_project_storage_cleanup"));
ok("abandoned signed uploads expire through a delayed cleanup queue", folderMigration.includes("cancel_project_workspace_upload") && folderMigration.includes("expire_project_workspace_uploads") && folderMigration.includes("interval '3 hours'"));
ok("the inherited buyer role can create and upload its own project files", buyerAccessMigration.includes("WHERE key = 'client'") && buyerAccessMigration.includes("'action', 'deal', 'create'"));
ok("shared file-folder namespace is serialized", folderMigration.includes("project_files_namespace_guard") && folderMigration.includes("pg_advisory_xact_lock"));
ok("workspace exposes create, move and bulk delete controls", workspace.includes("createProjectFolderAction") && workspace.includes("moveProjectFolderAction") && workspace.includes("deleteProjectFilesAction"));
ok("workspace limits parallel upload workers", workspace.includes("Math.min(3, next.length)"));

console.log(`\nprojects-workspace.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
