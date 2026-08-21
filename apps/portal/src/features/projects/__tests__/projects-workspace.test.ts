/** Timber Projects creation/path/tree/security contract (pure + source guards). */
import { readFileSync } from "node:fs";
import { evaluateProjectCapabilities } from "../capabilities";
import {
  MAX_PROJECT_FILE_BYTES,
  buildProjectTree,
  isPreviewableProjectMimeType,
  normaliseProjectName,
  normaliseProjectPath,
  projectPathKey,
  replacePathPrefix,
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
eq("case-insensitive duplicate key", projectPathKey("Drawings/A.PDF"), projectPathKey("drawings/a.pdf"));
eq("reject blank file name", normaliseProjectName("  "), null);
eq("reject separators in a rename", normaliseProjectName("folder/name"), null);
eq("100 MB is accepted by the contract", MAX_PROJECT_FILE_BYTES, 104857600);
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

ok("PDF preview is allowlisted", isPreviewableProjectMimeType("application/pdf"));
ok("raster image preview is allowlisted", isPreviewableProjectMimeType("image/png"));
ok("SVG is not previewed as a raster image", !isPreviewableProjectMimeType("image/svg+xml"));
ok("office/archive preview is unavailable", !isPreviewableProjectMimeType("application/zip"));

// Source guards protect the easy-to-regress serialization/direct-ID boundaries.
const service = readFileSync("src/features/projects/services/projectFiles.ts", "utf8");
const actions = readFileSync("src/features/projects/actions/projectFileActions.ts", "utf8");
const create = readFileSync("src/features/projects/actions/createProject.ts", "utf8");
ok("metadata loader select excludes storage_path", /const SAFE_FILE_SELECT\s*=\s*[\s\S]*?;/.test(service) && !service.match(/const SAFE_FILE_SELECT\s*=\s*([\s\S]*?);/)?.[1]?.includes("storage_path"));
ok("workspace reads only category=project", service.includes('.eq("category", PROJECT_CATEGORY)'));
ok("workspace reads originals only", service.includes('.eq("file_variant", ORIGINAL_VARIANT)'));
ok("file-id actions collapse denial to File unavailable", actions.includes('error: "File unavailable"'));
ok("creation delegates idempotency to createDeal", create.includes("idempotencyKey: `project-${input.idempotencyKey}`"));
ok("download asks storage for the persisted filename", actions.includes('{ download: found.file.file_name }'));

console.log(`\nprojects-workspace.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
