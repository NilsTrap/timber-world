/** Timber Projects creation/path/tree/security contract (pure + source guards). */
import { readFileSync } from "node:fs";
import { evaluateProjectCapabilities } from "../capabilities";
import {
  MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES,
  MAX_PROJECT_FILE_BYTES,
  buildProjectTree,
  classifyProjectFile,
  getProjectPreviewKind,
  isPreviewableProjectFile,
  normaliseProjectMimeType,
  normaliseProjectName,
  normaliseProjectPath,
  pathFromBrowserFile,
  projectPathKey,
  replacePathPrefix,
  storedProjectMimeType,
  validateStoredProjectUploadSize,
} from "../filePaths";
import { sanitizeProjectHtml } from "../components/viewers/sanitizeProjectHtml";
import { isValidOcctResult } from "../components/viewers/validateOcctResult";

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

ok("PDF preview is allowlisted", isPreviewableProjectFile("drawing.pdf", "application/pdf"));
ok("raster image preview is allowlisted", isPreviewableProjectFile("photo.png", "image/png"));
ok("raster extension falls back without MIME", isPreviewableProjectFile("photo.webp", null));
ok("SVG is not previewed as a raster image", !isPreviewableProjectFile("drawing.svg", "image/svg+xml"));
ok("HEIC is not offered to the native browser viewer", !isPreviewableProjectFile("photo.heic", "image/heic"));
ok("office/archive preview is unavailable", !isPreviewableProjectFile("files.zip", "application/zip"));
eq("HTML extension routes to the safe report viewer", getProjectPreviewKind("report.HTML", "application/octet-stream"), "html");
eq("DXF extension routes without reliable browser MIME", getProjectPreviewKind("plate.dxf", null), "dxf");
eq("STEP alternate extension routes without reliable browser MIME", getProjectPreviewKind("model.stp", "application/octet-stream"), "step");
eq("PDF extension falls back when MIME is absent", getProjectPreviewKind("drawing.pdf", null), "native");
eq("NC1 remains download-only", getProjectPreviewKind("part.nc1", "text/plain"), null);
for (const misleadingMime of ["application/pdf", "text/html", "application/dxf", "model/step", "image/png"]) {
  eq(`NC1 cannot bypass preview denial with ${misleadingMime}`, getProjectPreviewKind("part.nc1", misleadingMime), null);
}
ok("engineering extension makes the server preview boundary available", isPreviewableProjectFile("part.step", null));
eq("DXF MIME is not mistaken for a generic image icon", classifyProjectFile("part", "image/vnd.dxf"), "dxf");
eq("extension wins over a conflicting MIME for icon and viewer routing", classifyProjectFile("drawing.dxf", "application/pdf"), "dxf");
eq("NC1 receives its own machine-file icon classification", classifyProjectFile("part.nc1", "text/plain"), "nc1");
eq("interactive preview budget is 25 MB", MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES, 26214400);
eq("MIME values are canonicalised", normaliseProjectMimeType(" Application/PDF; charset=binary "), "application/pdf");
eq("invalid MIME values fail closed", normaliseProjectMimeType("not a mime"), null);
eq("stored MIME comes from object metadata", storedProjectMimeType({ metadata: { mimetype: "IMAGE/PNG" } }), "image/png");
eq("missing stored MIME fails closed", storedProjectMimeType({ metadata: {} }), null);

const hostileHtml = sanitizeProjectHtml('<html><head><style>.ok{color:green}</style></head><body onload="steal()"><script>steal()</script><form action="https://bad.test"><input></form><img src="data:image/png;base64,AA=="></body></html>');
ok("HTML sanitizer strips scripts and event handlers", !hostileHtml.includes("<script") && !hostileHtml.includes("onload="));
ok("HTML sanitizer strips interactive forms", !hostileHtml.includes("<form") && !hostileHtml.includes("<input"));
ok("HTML sanitizer retains inline styles and data images", hostileHtml.includes(".ok{color:green}") && hostileHtml.includes("data:image/png;base64,AA=="));
ok("HTML sanitizer injects a restrictive CSP", hostileHtml.includes("Content-Security-Policy") && hostileHtml.includes("default-src 'none'"));
const validMesh = { success: true, meshes: [{ attributes: { position: { array: [0, 0, 0, 1, 0, 0, 0, 1, 0] } }, index: { array: [0, 1, 2] } }] };
ok("STEP validation accepts finite triangles", isValidOcctResult(validMesh));
ok("STEP validation rejects non-finite coordinates", !isValidOcctResult({ ...validMesh, meshes: [{ ...validMesh.meshes[0], attributes: { position: { array: [0, 0, Number.NaN] } } }] }));
ok("STEP validation rejects out-of-range indices", !isValidOcctResult({ ...validMesh, meshes: [{ ...validMesh.meshes[0], index: { array: [0, 1, 9] } }] }));

// Source guards protect the easy-to-regress serialization/direct-ID boundaries.
const service = readFileSync("src/features/projects/services/projectFiles.ts", "utf8");
const actions = readFileSync("src/features/projects/actions/projectFileActions.ts", "utf8");
const create = readFileSync("src/features/projects/actions/createProject.ts", "utf8");
const projectLoader = readFileSync("src/features/projects/actions/getProject.ts", "utf8");
const partyActions = readFileSync("src/features/projects/actions/projectPartyActions.ts", "utf8");
const detail = readFileSync("src/features/projects/components/ProjectDetailView.tsx", "utf8");
const specificationEditor = readFileSync("src/features/projects/components/ProjectSpecificationEditor.tsx", "utf8");
const parties = readFileSync("src/features/projects/components/ProjectPartiesBlock.tsx", "utf8");
const workspace = readFileSync("src/features/projects/components/ProjectFileWorkspace.tsx", "utf8");
const dropSurface = readFileSync("src/features/projects/components/ProjectDropSurface.tsx", "utf8");
const preview = readFileSync("src/features/projects/components/ProjectFilePreview.tsx", "utf8");
const htmlViewer = readFileSync("src/features/projects/components/viewers/HtmlFileViewer.tsx", "utf8");
const dxfViewer = readFileSync("src/features/projects/components/viewers/DxfFileViewer.tsx", "utf8");
const stepViewer = readFileSync("src/features/projects/components/viewers/StepFileViewer.tsx", "utf8");
const migration = readFileSync("../../supabase/migrations/20260821211500_project_file_workspace.sql", "utf8");
const folderMigration = readFileSync("../../supabase/migrations/20260826090000_project_workspace_folders.sql", "utf8");
const buyerAccessMigration = readFileSync("../../supabase/migrations/20260826130000_buyer_project_workspace_access.sql", "utf8");
const adminBuyerMigration = readFileSync("../../supabase/migrations/20260826160000_project_admin_buyer_selection.sql", "utf8");
const specificationCostMigration = readFileSync("../../supabase/migrations/20260826200000_project_line_cost_components.sql", "utf8");
const specificationSecurityMigration = readFileSync("../../supabase/migrations/20260826203000_project_line_cost_components_security.sql", "utf8");
const specificationSampleSeed = readFileSync("../../supabase/seeds/mills_sample_p04668_s04739.sql", "utf8");
const cleanupMigration = readFileSync("../../supabase/migrations/20260826150000_project_file_cleanup.sql", "utf8");
const cleanupActions = readFileSync("src/features/projects/actions/projectFileCleanupActions.ts", "utf8");
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
ok("signed preview checks persisted name and MIME together", actions.includes("getProjectPreviewKind(found.file.file_name, mimeType)"));
ok("server caps interactive previews below upload size", actions.includes("MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES") && actions.includes('code: "PREVIEW_TOO_LARGE"'));
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
ok("admin buyer options are not partner-book scoped", projectLoader.includes('if (!admin) {') && !projectLoader.includes('if (!admin || side === "buyer")'));
ok("admin purchase legs resolve one active same-spine root without widening ordinary projections", projectLoader.includes('a.isPlatformAdmin && raw.dealKind === "purchase_only"') && projectLoader.includes("resolveRootSellingProject") && projectLoader.includes('.neq("deal_kind", "purchase_only")') && projectLoader.includes("candidates.length !== 1") && projectLoader.includes("root.data.spineId !== purchaseLeg.spineId"));
ok("admin party workspace is absolute while ordinary viewers stay direction-relative", projectLoader.includes("adminPartyRootAvailable ? buyerSource.seller : raw.buyer") && projectLoader.includes("adminPartyRootAvailable ? buyerSource.buyer : null") && projectLoader.includes('project.direction === "buy" ? null : raw.buyer'));
ok("unresolved admin purchase roots expose no buyer or chain mutation target", projectLoader.includes("adminPartyRootAvailable = !isAdminPurchaseLeg || buyerProject !== null") && projectLoader.includes("buyerProjectId: adminPartyRootAvailable ? buyerSource.id : null") && projectLoader.includes("chainProjectId: adminPartyRootAvailable ? chainOrigin.id : null"));
ok("resolved admin purchase roots drive downstream traversal and append mutations", projectLoader.includes("loadDownstreamChain(a.db, spineId, chainOrigin.id, centerRaw.id") && parties.includes("projectId: workspace.chainProjectId"));
ok("ordinary buyer mutations still require a trading-partner link", partyActions.includes("if (!a.isPlatformAdmin) {") && partyActions.includes("Selected company is not this trader's trading partner") && adminBuyerMigration.includes("IF NOT public.is_current_user_platform_admin()") && adminBuyerMigration.includes("Buyer is not a trading partner"));
ok("admin buyer mutation retains active-customer and self-deal guards", adminBuyerMigration.includes("is_active AND is_customer") && adminBuyerMigration.includes("Buyer and seller must differ"));
ok("project name is primary and redundant summary metadata is absent", detail.includes("title={projectName || project.reference}") && detail.includes("subtitle={projectName ? project.reference : undefined}") && !detail.includes("<SummaryGrid") && !detail.includes('"Platform admin"'));
ok("manufacturing costs are nested beneath the sellable specification line", specificationEditor.includes("Cost build-up") && specificationEditor.includes("line.components?.map") && specificationCostMigration.includes("order_line_item_components"));
ok("component RLS requires seller-side commercial access", specificationCostMigration.includes("current_user_deal_terms_access") && specificationSecurityMigration.includes("current_user_in_org(deal.seller_organisation_id)") && specificationSecurityMigration.includes("p_editable"));
ok("Mills sample is an explicit development seed, not deployable schema", specificationSampleSeed.includes("'Carcass'") && specificationSampleSeed.includes("'Sheet metal'") && specificationSampleSeed.includes("'Cutting'") && specificationSampleSeed.includes("'Wet priming'") && !specificationCostMigration.includes("'Carcass'"));
ok("editable buyer name opens the selector accessibly", parties.includes('onPartyClick={workspace.canEditBuyer') && parties.includes('aria-label={`Change buyer ${party.name ?? "company"}`}'));
ok("buyer corrections target the projected root project", parties.includes("projectId: workspace.buyerProjectId"));
ok("workspace exposes concise cleanup and sharing controls", workspace.includes("> Move") && workspace.includes("> Delete") && workspace.includes("} Clean") && workspace.includes("> Share") && workspace.includes(">Unshare<") && workspace.includes("Approve cleaned file") && workspace.includes("Shared status for") && !workspace.includes("Move selected") && !workspace.includes("Delete selected") && !workspace.includes("Clean selected") && !workspace.includes("Share with next party") && !workspace.includes("Unshare selected"));
ok("closed upload control uses the primary button style", workspace.includes('variant={uploadOpen ? "secondary" : "default"}'));
ok("successful cleanup deselects only files actually cleaned", workspace.includes("filter((id) => !updates.has(id))") && workspace.indexOf("filter((id) => !updates.has(id))", workspace.indexOf("const cleanSelected")) < workspace.indexOf("} catch", workspace.indexOf("const cleanSelected")));
ok("clean derivatives are linked and downstream reads require approval", cleanupMigration.includes("source_file_id") && cleanupMigration.includes("shared_to_order_id") && cleanupMigration.includes("cleanup_status='approved'"));
ok("clean derivatives receive neutral filenames and paths", cleanupActions.includes("buildNeutralCleanFileName") && cleanupActions.includes("file_name: cleanFileName") && cleanupActions.includes("relative_path: cleanFileName"));
ok("cleanup actions derive the adjacent leg server-side", cleanupActions.includes('.eq("buyer_organisation_id", deal.seller_organisation_id)') && !cleanupActions.includes("destinationOrderId"));
ok("workspace limits parallel upload workers", workspace.includes("Math.min(3, next.length)"));
ok("workspace uses centralized icons and viewer routing", workspace.includes("ProjectFileTypeIcon") && workspace.includes("ProjectFilePreview"));
ok("workspace uploader starts behind a header control and collapses only after true idle", workspace.includes('aria-controls="project-file-upload-surface"') && workspace.includes("10_000") && workspace.includes("hasActiveUploads") && workspace.includes("uploadInteractionActive"));
ok("drop surface reports active drag and file-picker interaction", dropSurface.includes("isDragActive || pickerOpen") && dropSurface.includes("onActivityChange") && dropSurface.includes('window.addEventListener("focus"'));
ok("workspace replaces the folder column with file information", !workspace.includes("<TableHead>Folder</TableHead>") && workspace.includes("File information") && workspace.includes("Information for ${file.fileName}") && workspace.includes('["Folder", folder]') && workspace.includes('["Uploaded", formatDateTime(file.createdAt)]'));
ok("heavy engineering viewers are lazy chunks", preview.includes('dynamic(() => import("./viewers/DxfFileViewer")') && preview.includes('dynamic(() => import("./viewers/StepFileViewer")'));
ok("PDF native viewer is not placed in a scriptless sandbox", preview.includes('const isPdf = classifyProjectFile(source.fileName, source.mimeType) === "pdf"') && preview.includes('{...(isPdf ? {} : { sandbox: "" })}'));
ok("HTML preview is sanitized and scriptless", htmlViewer.includes("sanitizeProjectHtml") && htmlViewer.includes('sandbox=""'));
ok("DXF parsing uses a dedicated worker and destroys viewer resources", dxfViewer.includes("workerFactory") && dxfViewer.includes("viewer?.Destroy()"));
ok("STEP parsing uses a terminating local worker and disposes WebGL resources", stepViewer.includes("occt-import-js-worker.js") && stepViewer.includes("worker.terminate()") && stepViewer.includes("renderer?.dispose()"));
ok("STEP canvas has a stable bounded CSS footprint", stepViewer.includes('renderer.domElement.classList.add("block", "h-full", "w-full")') && stepViewer.includes('className="h-full min-w-0 w-full overflow-hidden"'));
ok("STEP camera fitting respects horizontal and vertical field of view", stepViewer.includes("horizontalFov") && stepViewer.includes("limitingFov") && stepViewer.includes("sphere.radius"));
ok("previewable desktop and mobile rows support pointer and semantic button activation", workspace.includes('onClick={previewable ? () => onPreview(file) : undefined}') && workspace.includes('className="flex w-full min-w-0 items-center gap-2 text-left') && workspace.includes('className="flex min-w-0 flex-1 items-center gap-3 text-left"'));
ok("unsupported rows remain outside the row preview interaction", workspace.includes('onClick={previewable ? () => onPreview(file) : undefined}') && workspace.includes('onClick={isPreviewableProjectFile(file.fileName, file.mimeType) ? () => openPreview(file) : undefined}'));
ok("file selection and explicit actions stop row preview propagation", workspace.includes('onClick={(event) => event.stopPropagation()}') && workspace.includes('onKeyDown={(event) => event.stopPropagation()}'));
ok("STEP refits after its container aspect changes", stepViewer.includes("if (fitRef.current) fitRef.current(); else render()"));

console.log(`\nprojects-workspace.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
