/** Timber Projects creation/path/tree/security contract (pure + source guards). */
import { readFileSync } from "node:fs";
import { evaluateProjectCapabilities } from "../capabilities";
import { MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES, MAX_PROJECT_FILE_BYTES, buildProjectTree, classifyProjectFile, getProjectPreviewKind, isPreviewableProjectFile, normaliseProjectMimeType, normaliseProjectName, normaliseProjectPath, pathFromBrowserFile, projectPathKey, replacePathPrefix, storedProjectMimeType, validateStoredProjectUploadSize } from "../filePaths";
import { sanitizeProjectHtml } from "../components/viewers/sanitizeProjectHtml";
import { isValidOcctResult } from "../components/viewers/validateOcctResult";
import { MAX_CAPTURE_DIMENSION, MAX_CAPTURE_PIXELS, boundedCaptureSize, hasVisiblePixelVariation, scaledVisibleCanvasRegion } from "../components/viewers/projectPreviewCapture";
import { nextOfficialImagePosition } from "../officialImagePolicy";
import { resolveProjectThumbnailUrl, sortOfficialImageDesignations } from "../services/projectOfficialImages";
import { projectLegReference } from "../services/projectLegReference";
import { ALL_FILE_TYPES, filterProjectFiles, NO_FILE_EXTENSION, projectFileExtension, projectFileExtensions, projectFileTypeValue } from "../services/projectFileFilters";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n expected ${JSON.stringify(expected)}\n actual ${JSON.stringify(actual)}`);
  }
}
function ok(label: string, value: boolean) {
  if (value) passed++;
  else {
    failed++;
    console.error(`✗ ${label}`);
  }
}

eq("leg reference shows buyer before seller", projectLegReference("TIM-AAI-002", "AAI", "TIM"), "AAI-TIM-002");
eq("leg reference keeps an explicit missing buyer", projectLegReference("TIM-XXX-005", null, "TIM"), "XXX-TIM-005");

const filterFiles = [
  { fileName: "Assembly.STEP", relativePath: "CAD/Assembly.STEP" },
  { fileName: "drawing.dxf", relativePath: "CAD/drawing.dxf" },
  { fileName: "offer.pdf", relativePath: "Documents/offer.pdf" },
  { fileName: ".DS_Store", relativePath: "CAD/.DS_Store" },
];
eq("file extension matching is case-insensitive", projectFileExtension("Assembly.STEP"), "step");
eq("dotfiles are treated as having no extension", projectFileExtension(".DS_Store"), null);
eq("project file extensions are unique and sorted", projectFileExtensions(filterFiles), [projectFileTypeValue("dxf"), projectFileTypeValue("pdf"), projectFileTypeValue("step"), NO_FILE_EXTENSION]);
eq("file filters combine current folder, type and partial name", filterProjectFiles(filterFiles, "CAD", projectFileTypeValue("step"), "sembl"), [filterFiles[0]]);
eq("all-types search remains scoped to the selected folder", filterProjectFiles(filterFiles, "Documents", ALL_FILE_TYPES, "off"), [filterFiles[2]]);
eq("folder scope uses exact immediate parents", filterProjectFiles([...filterFiles, { fileName: "nested.step", relativePath: "CAD/Nested/nested.step" }, { fileName: "other.step", relativePath: "CAD-old/other.step" }], "CAD", ALL_FILE_TYPES, ""), [filterFiles[0], filterFiles[1], filterFiles[3]]);
eq("root scope includes all descendants", filterProjectFiles(filterFiles, null, ALL_FILE_TYPES, ""), filterFiles);
eq("multiple dots use the final extension", projectFileExtension("drawing.final.DXF"), "dxf");
eq("trailing dots have no extension", projectFileExtension("drawing."), null);
const reservedFiles = [
  { fileName: "one.all", relativePath: "one.all" },
  { fileName: "two.none", relativePath: "two.none" },
  { fileName: "README", relativePath: "README" },
];
eq("reserved values do not collide with real extensions", projectFileExtensions(reservedFiles), [projectFileTypeValue("all"), projectFileTypeValue("none"), NO_FILE_EXTENSION]);
eq("real all extension filters independently", filterProjectFiles(reservedFiles, null, projectFileTypeValue("all"), ""), [reservedFiles[0]]);
eq("real none extension filters independently", filterProjectFiles(reservedFiles, null, projectFileTypeValue("none"), ""), [reservedFiles[1]]);
eq("extensionless filter remains independent", filterProjectFiles(reservedFiles, null, NO_FILE_EXTENSION, ""), [reservedFiles[2]]);

// Creation is rights AND persona gated. Flags alone never grant the action.
eq(
  "buyer + effective deal:create can create",
  evaluateProjectCapabilities({
    isPlatformAdmin: false,
    hasDealCreate: true,
    organisationId: "org",
    personas: ["buyer"],
  }),
  { canWriteFiles: true, canCreateProject: true, createRoles: ["buyer"] },
);
eq(
  "trader + effective deal:create can create",
  evaluateProjectCapabilities({
    isPlatformAdmin: false,
    hasDealCreate: true,
    organisationId: "org",
    personas: ["trader"],
  }),
  { canWriteFiles: true, canCreateProject: true, createRoles: ["trader"] },
);
eq(
  "dual-role org must choose one of two roles",
  evaluateProjectCapabilities({
    isPlatformAdmin: false,
    hasDealCreate: true,
    organisationId: "org",
    personas: ["buyer", "trader"],
  }).createRoles,
  ["buyer", "trader"],
);
eq(
  "buyer flag without the action cannot create",
  evaluateProjectCapabilities({
    isPlatformAdmin: false,
    hasDealCreate: false,
    organisationId: "org",
    personas: ["buyer"],
  }).canCreateProject,
  false,
);
eq(
  "supplier cannot create even with deal:create",
  evaluateProjectCapabilities({
    isPlatformAdmin: false,
    hasDealCreate: true,
    organisationId: "org",
    personas: ["supplier"],
  }).canCreateProject,
  false,
);
eq(
  "supplier with explicit write right may edit its visible deal only",
  evaluateProjectCapabilities({
    isPlatformAdmin: false,
    hasDealCreate: true,
    organisationId: "org",
    personas: ["supplier"],
  }).canWriteFiles,
  true,
);
eq(
  "admin without an org uses the platform trader binding",
  evaluateProjectCapabilities({
    isPlatformAdmin: true,
    hasDealCreate: false,
    organisationId: null,
    personas: [],
  }),
  { canWriteFiles: true, canCreateProject: true, createRoles: ["trader"] },
);

// Strict path boundary + browser-friendly tree persistence.
for (const bad of ["", "/root/a.pdf", "C:/a.pdf", "../a.pdf", "a/../b.pdf", "a//b.pdf", "a/./b.pdf", "a/ "]) {
  ok(`reject invalid path ${JSON.stringify(bad)}`, !normaliseProjectPath(bad).ok);
}
eq("normalise Windows separators", normaliseProjectPath("drawings\\final\\A.pdf"), {
  ok: true,
  path: "drawings/final/A.pdf",
  segments: ["drawings", "final", "A.pdf"],
});
eq(
  "react-dropzone single-file marker is removed",
  pathFromBrowserFile({
    name: "quote.pdf",
    path: "./quote.pdf",
    webkitRelativePath: "",
  } as File & { path: string }),
  { ok: true, path: "quote.pdf", segments: ["quote.pdf"] },
);
eq(
  "dropped folder leading slash is removed",
  pathFromBrowserFile({
    name: "quote.pdf",
    path: "/drawings/quote.pdf",
    webkitRelativePath: "",
  } as File & { path: string }),
  { ok: true, path: "drawings/quote.pdf", segments: ["drawings", "quote.pdf"] },
);
ok(
  "parent traversal is not treated as a browser marker",
  !pathFromBrowserFile({
    name: "quote.pdf",
    path: "../quote.pdf",
    webkitRelativePath: "",
  } as File & { path: string }).ok,
);
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
eq(
  "reopened tree keeps top-level names",
  tree.map((node) => [node.kind, node.name]),
  [
    ["folder", "drawings"],
    ["file", "readme.txt"],
  ],
);
eq(
  "nested folders are reconstructed",
  tree[0]?.children.map((node) => node.name),
  ["final", "source"],
);
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
const validMesh = {
  success: true,
  meshes: [
    {
      attributes: { position: { array: [0, 0, 0, 1, 0, 0, 0, 1, 0] } },
      index: { array: [0, 1, 2] },
    },
  ],
};
ok("STEP validation accepts finite triangles", isValidOcctResult(validMesh));
ok(
  "STEP validation rejects non-finite coordinates",
  !isValidOcctResult({
    ...validMesh,
    meshes: [
      {
        ...validMesh.meshes[0],
        attributes: { position: { array: [0, 0, Number.NaN] } },
      },
    ],
  }),
);
ok(
  "STEP validation rejects out-of-range indices",
  !isValidOcctResult({
    ...validMesh,
    meshes: [{ ...validMesh.meshes[0], index: { array: [0, 1, 9] } }],
  }),
);
eq("capture dimensions are bounded", boundedCaptureSize(4096, 1024), {
  width: 2048,
  height: 512,
});
ok(
  "capture pixel budget is bounded",
  (() => {
    const size = boundedCaptureSize(3000, 3000);
    return size.width * size.height <= MAX_CAPTURE_PIXELS;
  })(),
);
eq("capture maximum edge is explicit", MAX_CAPTURE_DIMENSION, 2048);
eq(
  "scrolled PDF capture maps the visible CSS viewport to backing pixels",
  scaledVisibleCanvasRegion({
    canvasWidth: 1200,
    canvasHeight: 2400,
    canvasClientWidth: 600,
    canvasClientHeight: 1200,
    canvasOffsetLeft: 8,
    canvasOffsetTop: 8,
    scrollLeft: 8,
    scrollTop: 308,
    viewportWidth: 600,
    viewportHeight: 500,
  }),
  { x: 0, y: 600, width: 1200, height: 1000 },
);
ok("uniform blank captures are rejected", !hasVisiblePixelVariation(new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255])));
ok("visible capture variation is accepted", hasVisiblePixelVariation(new Uint8ClampedArray([255, 255, 255, 255, 20, 20, 20, 255])));
ok("uniform colored preview content is accepted", hasVisiblePixelVariation(new Uint8ClampedArray([20, 40, 60, 255, 20, 40, 60, 255])));
eq("official images fill the next available slot", nextOfficialImagePosition([1, 3]), 2);
eq("a fourth official image has no slot", nextOfficialImagePosition([1, 2, 3]), null);
eq("three shared gallery designations render in canonical position order",
  sortOfficialImageDesignations([{ position: 3 }, { position: 1 }, { position: 2 }]).map((row) => row.position),
  [1, 2, 3]);
const sharedThumbnails = new Map([["spine-1", "shared-primary"]]);
eq("visible legs on the same raw spine resolve the same primary thumbnail", ["leg-1", "leg-2", "leg-3"].map((orderId) =>
  resolveProjectThumbnailUrl("spine-1", orderId, sharedThumbnails, new Map([[orderId, `legacy-${orderId}`]]))),
["shared-primary", "shared-primary", "shared-primary"]);
eq("a linked spine without a ready designation retains the empty thumbnail state",
  resolveProjectThumbnailUrl("spine-missing", "leg-1", sharedThumbnails, new Map([["leg-1", "legacy-leg-1"]])), null);

// Source guards protect the easy-to-regress serialization/direct-ID boundaries.
const service = readFileSync("src/features/projects/services/projectFiles.ts", "utf8");
const actions = readFileSync("src/features/projects/actions/projectFileActions.ts", "utf8");
const create = readFileSync("src/features/projects/actions/createProject.ts", "utf8");
const projectLoader = readFileSync("src/features/projects/actions/getProject.ts", "utf8");
const projection = readFileSync("src/features/projects/projection.ts", "utf8");
const specificationActions = readFileSync("src/features/projects/actions/projectSpecificationActions.ts", "utf8");
const partyActions = readFileSync("src/features/projects/actions/projectPartyActions.ts", "utf8");
const projectPage = readFileSync("src/app/(portal)/projects/[id]/page.tsx", "utf8");
const orderDeals = readFileSync("src/features/orders/services/orderDeals.ts", "utf8");
const detail = readFileSync("src/features/projects/components/ProjectDetailView.tsx", "utf8");
const specificationEditor = readFileSync("src/features/projects/components/ProjectSpecificationEditor.tsx", "utf8");
const specificationTables = readFileSync("src/features/projects/components/ProjectSpecificationTables.tsx", "utf8");
const parties = readFileSync("src/features/projects/components/ProjectPartiesBlock.tsx", "utf8");
const legSelector = readFileSync("src/features/projects/components/ProjectLegSelector.tsx", "utf8");
const nextLegControl = readFileSync("src/features/projects/components/ProjectNextLegControl.tsx", "utf8");
const workspace = readFileSync("src/features/projects/components/ProjectFileWorkspace.tsx", "utf8");
const officialImages = readFileSync("src/features/projects/components/ProjectOfficialImages.tsx", "utf8");
const dropSurface = readFileSync("src/features/projects/components/ProjectDropSurface.tsx", "utf8");
const preview = readFileSync("src/features/projects/components/ProjectFilePreview.tsx", "utf8");
const htmlViewer = readFileSync("src/features/projects/components/viewers/HtmlFileViewer.tsx", "utf8");
const dxfViewer = readFileSync("src/features/projects/components/viewers/DxfFileViewer.tsx", "utf8");
const stepViewer = readFileSync("src/features/projects/components/viewers/StepFileViewer.tsx", "utf8");
const capture = readFileSync("src/features/projects/components/viewers/projectPreviewCapture.ts", "utf8");
const officialImageActions = readFileSync("src/features/projects/actions/projectOfficialImageActions.ts", "utf8");
const officialImageService = readFileSync("src/features/projects/services/projectOfficialImages.ts", "utf8");
const candidateSnapshotService = readFileSync("src/features/projects/services/projectRfqCandidateSnapshot.ts", "utf8");
const spineActions = readFileSync("src/features/projects/actions/projectSpineActions.ts", "utf8");
const spineTitle = readFileSync("src/features/projects/components/ProjectSpineTitle.tsx", "utf8");
const createView = readFileSync("src/features/projects/components/ProjectCreateView.tsx", "utf8");
const termsCard = readFileSync("src/features/projects/components/ProjectTermsCard.tsx", "utf8");
const sectionCard = readFileSync("src/features/projects/components/ProjectSectionCard.tsx", "utf8");
const disclosureButton = readFileSync("src/features/projects/components/ProjectDisclosureButton.tsx", "utf8");
const portalLayout = readFileSync("src/app/(portal)/layout.tsx", "utf8");
const migration = readFileSync("../../supabase/migrations/20260821211500_project_file_workspace.sql", "utf8");
const folderMigration = readFileSync("../../supabase/migrations/20260826090000_project_workspace_folders.sql", "utf8");
const buyerAccessMigration = readFileSync("../../supabase/migrations/20260826130000_buyer_project_workspace_access.sql", "utf8");
const missingRoleGroupBackfill = readFileSync("../../supabase/migrations/20260903170000_backfill_missing_nilitto_role_groups.sql", "utf8");
const adminBuyerMigration = readFileSync("../../supabase/migrations/20260826160000_project_admin_buyer_selection.sql", "utf8");
const legCorrectionMigration = readFileSync("../../supabase/migrations/20260827090000_project_admin_leg_party_correction.sql", "utf8");
const dynamicLegCodeMigration = readFileSync("../../supabase/migrations/20260828090000_dynamic_project_leg_codes.sql", "utf8");
const specificationCostMigration = readFileSync("../../supabase/migrations/20260826200000_project_line_cost_components.sql", "utf8");
const specificationSecurityMigration = readFileSync("../../supabase/migrations/20260826203000_project_line_cost_components_security.sql", "utf8");
const processFieldsMigration = readFileSync("../../supabase/migrations/20260828140000_catalog_process_fields.sql", "utf8");
const structuredQuoteMigration = readFileSync("../../supabase/migrations/20260828180000_project_spec_fields_and_quote_lines.sql", "utf8");
const spineTitleMigration = readFileSync("../../supabase/migrations/20260830090000_project_spine_title_edit.sql", "utf8");
const rfqActions = readFileSync("src/features/projects/actions/projectRfqActions.ts", "utf8");
const rfqCard = readFileSync("src/features/projects/components/ProjectRfqCard.tsx", "utf8");
const quotationRows = readFileSync("src/features/projects/services/projectQuotationRows.ts", "utf8");
const specificationSampleSeed = readFileSync("../../supabase/seeds/mills_sample_p04668_s04739.sql", "utf8");
const cleanupMigration = readFileSync("../../supabase/migrations/20260826150000_project_file_cleanup.sql", "utf8");
const rfqFileSharingMigration = readFileSync("../../supabase/migrations/20260903205000_project_rfq_file_sharing.sql", "utf8");
const cleanupActions = readFileSync("src/features/projects/actions/projectFileCleanupActions.ts", "utf8");
const deletionActions = readFileSync("src/features/projects/actions/projectDeletionActions.ts", "utf8");
const commercialActions = readFileSync("src/features/projects/actions/projectCommercialActions.ts", "utf8");
const commercialOffer = readFileSync("src/features/projects/components/ProjectCommercialRollup.tsx", "utf8");
const deletionMigration = readFileSync("../../supabase/migrations/20260901120000_project_soft_deletion.sql", "utf8");
const sharedSpecificationMigration = readFileSync("../../supabase/migrations/20260901200000_shared_specification_and_process_total_pricing.sql", "utf8");
const projectsList = readFileSync("src/features/projects/components/ProjectsListView.tsx", "utf8");
const projectsLoader = readFileSync("src/features/projects/actions/getProjects.ts", "utf8");
const orderDealService = readFileSync("src/features/orders/services/orderDeals.ts", "utf8");
ok("metadata loader select excludes storage_path", /const SAFE_FILE_SELECT\s*=\s*[\s\S]*?;/.test(service) && !service.match(/const SAFE_FILE_SELECT\s*=\s*([\s\S]*?);/)?.[1]?.includes("storage_path"));
ok("workspace reads only category=project", service.includes('.eq("category", PROJECT_CATEGORY)'));
ok("workspace reads originals only", service.includes('.eq("file_variant", ORIGINAL_VARIANT)'));
ok("file-id actions collapse denial to File unavailable", actions.includes('error: "File unavailable"'));
ok("creation delegates idempotency to createDeal", create.includes("idempotencyKey: `project-${input.idempotencyKey}`"));
ok("terms start collapsed and empty terms expose an expand action", termsCard.includes("useState(false)") && termsCard.includes("Set terms") && termsCard.includes("setOpen(true)"));
ok("files use the shared collapsible card with a persistent live count", workspace.includes("ProjectSectionCard") && workspace.includes("ProjectDisclosureButton") && workspace.includes("workspaceOpen") && workspace.includes("`${files.length} file(s) on this project`"));
ok("image upload control immediately precedes the shared disclosure", /\{uploadControl\}\s*<ProjectDisclosureButton/.test(officialImages));
ok("complete creation replaces the screen with the origin project route", createView.includes("if (failures === 0)") && createView.includes("router.replace(`/projects/${created.id}`)") && /if \(complete && created && !creating && !hadSaveFailure\)/.test(createView));
ok("creation failures stay sticky until a fully successful submit", createView.includes("hadSaveFailure") && createView.includes("setHadSaveFailure(true)") && createView.includes("setHadSaveFailure(false)") && createView.includes("!hadSaveFailure") && !createView.includes("Open {created.reference}"));
ok("file disclosure cannot collapse active work or dialogs", workspace.includes("collapseBlocked") && workspace.includes("hasActiveUploads || archiveProgress !== null") && workspace.includes("fileInfo !== null") && workspace.includes("preview !== null") && workspace.includes("disabled={collapseBlocked}") && workspace.includes("controls={workspaceBodyId}"));
ok("project sections share one tokenized shell and disclosure control", sectionCard.includes('"overflow-hidden rounded-lg border bg-card"') && sectionCard.includes("sm:max-w-[60%]") && disclosureButton.includes('className="h-9 w-9 shrink-0"') && disclosureButton.includes("aria-expanded={open}") && disclosureButton.includes("aria-controls={controls}"));
ok("upload action opens a closed workspace predictably", workspace.includes("workspaceOpen ? !current : true") && workspace.includes("setWorkspaceOpen(true)"));
ok("official image state resets per project and opens after upload", officialImages.includes("[initialFiles, projectId]") && officialImages.includes("setOpen(initialFiles.some") && officialImages.includes("setOpen(true)"));
ok("download asks storage for the persisted filename", actions.includes("{ download: found.file.file_name }"));
ok("prepared upload response never exposes a storage path", /interface PreparedProjectUpload\s*{[^}]*signedUrl: string;[^}]*uploadId: string;[^}]*}/.test(actions));
const ordinaryUploadAction = actions.slice(actions.indexOf("export async function prepareProjectFileUpload"), actions.indexOf("export async function finaliseProjectFileUpload"));
ok("preparation persists an uploading row before signing", ordinaryUploadAction.indexOf('lifecycle_status: "uploading"') < ordinaryUploadAction.indexOf(".createSignedUploadUrl(storagePath"));
ok("ZIP archives upload once and extract on the server", actions.includes("prepareProjectArchiveUpload") && actions.includes("extractProjectArchiveUpload") && actions.includes("JSZip.loadAsync"));
ok("archive extraction preserves safe paths and limits expansion", actions.includes("normaliseProjectPath(unsafeName)") && actions.includes("MAX_ARCHIVE_FILES") && actions.includes("MAX_ARCHIVE_EXPANDED_BYTES"));
ok("ZIP files are auto-routed without a dedicated archive picker", dropSurface.includes("onArchives") && dropSurface.includes('endsWith(".zip")') && !dropSurface.includes("Upload archive"));
ok("archive extraction works in existing and new projects", workspace.includes("uploadProjectBrowserArchive") && /Uploading and\s+extracting archive/.test(workspace) && createView.includes("uploadProjectBrowserArchive") && /kind:\s*"archive"/.test(createView));
ok("existing-project archive failures remain retryable without stopping the queue", workspace.includes("interface FailedArchive") && workspace.includes("failedCount += 1") && workspace.includes("Retry") && workspace.includes("for (const [archiveIndex, file] of archives.entries())"));
ok("portal confines scrolling to its main content region", portalLayout.includes('className="fixed inset-0 flex min-h-0 bg-background"') && portalLayout.includes('className="min-h-0 flex-1 overflow-y-auto"'));
ok("awarded margin crosses the client boundary only for RFQ managers", rfqActions.includes('if(canManage&&row.status==="awarded")') && rfqActions.includes("...(commercialPricing?{commercialPricing}:{})"));
ok("awarded supplier pricing feeds the buyer-leg commercial offer without a duplicate margin card", !rfqCard.includes("Trader margin") && commercialOffer.includes("Save private draft") && commercialOffer.includes("Publish offer to buyer"));
ok("persisted buyer-offer margin reloads from exact cents", commercialOffer.includes("result.data.marginAmountCents") && commercialOffer.includes("result.data.marginPercent"));
ok("finalisation is bound to project and upload IDs", actions.includes('.eq("id", uploadId)') && actions.includes('.eq("order_id", projectId)'));
ok("finalisation reads actual storage metadata size", actions.includes("validateStoredProjectUploadSize(object, expectedSize)"));
ok("finalisation verifies stored MIME metadata", actions.includes("storedProjectMimeType(object)"));
ok("signed reads require a ready file", actions.includes('found.file.lifecycle_status !== "ready"'));
ok("signed preview checks persisted name and MIME together", actions.includes("getProjectPreviewKind(found.file.file_name, mimeType)"));
ok("server caps interactive previews below upload size", actions.includes("MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES") && actions.includes('code: "PREVIEW_TOO_LARGE"'));
ok("invalid stored objects are removed before retry", actions.includes("if (!storedSize.ok)") && actions.includes(".remove([storagePath])"));
ok("orders bucket rejects uploads over 100 MB", migration.includes("file_size_limit = LEAST(COALESCE(file_size_limit, 104857600), 104857600)"));
ok("narrow workspace renders folders", /<MobileFolderRows\s+nodes=\{tree\}/.test(workspace));
ok("mobile folder actions stay visible and touch-safe", workspace.includes("aria-label={`Rename folder ${node.path}`}") && workspace.includes("aria-label={`Delete folder ${node.path}`}") && workspace.includes('className="h-11 w-11"'));
ok("empty folders have an RLS-walled persistence table", folderMigration.includes("CREATE TABLE IF NOT EXISTS public.project_folders") && folderMigration.includes("public.can_write_project_files(order_id)"));
ok("folder moves update folder and file descendants transactionally", folderMigration.includes("move_project_workspace_folder") && folderMigration.includes("UPDATE public.project_folders") && folderMigration.includes("UPDATE public.order_files"));
ok("folder delete metadata is transactional", folderMigration.includes("delete_project_workspace_folder") && folderMigration.includes("p_expected_file_ids"));
ok("file deletion is durably queued before metadata removal", folderMigration.includes("project_storage_cleanup") && folderMigration.includes("delete_project_workspace_files") && folderMigration.includes("complete_project_storage_cleanup"));
ok("abandoned signed uploads expire through a delayed cleanup queue", folderMigration.includes("cancel_project_workspace_upload") && folderMigration.includes("expire_project_workspace_uploads") && folderMigration.includes("interval '3 hours'"));
ok("the inherited buyer role can create and upload its own project files", buyerAccessMigration.includes("WHERE key = 'client'") && buyerAccessMigration.includes("'action', 'deal', 'create'"));
ok("group-less active single-persona memberships inherit the canonical Nilitto role group", missingRoleGroupBackfill.includes("public.organization_memberships") && missingRoleGroupBackfill.includes("organisation.is_customer THEN 'buyer'") && missingRoleGroupBackfill.includes("organisation.is_trader THEN 'trader'") && missingRoleGroupBackfill.includes("ELSE 'manufacturer'"));
ok("role-group repair excludes inactive and ambiguous memberships", missingRoleGroupBackfill.includes("portal_user.is_active = true") && missingRoleGroupBackfill.includes("organisation.is_active = true") && missingRoleGroupBackfill.includes("membership.is_active = true") && missingRoleGroupBackfill.includes(") = 1"));
ok("role-group repair preserves every existing assignment and is idempotent", missingRoleGroupBackfill.includes("NOT EXISTS") && missingRoleGroupBackfill.includes("existing_assignment.user_id = membership.user_id") && missingRoleGroupBackfill.includes("existing_assignment.organization_id = membership.organization_id") && missingRoleGroupBackfill.includes("ON CONFLICT (user_id, organization_id, group_id) DO NOTHING"));
ok("shared file-folder namespace is serialized", folderMigration.includes("project_files_namespace_guard") && folderMigration.includes("pg_advisory_xact_lock"));
ok("workspace exposes create, move and bulk delete controls", workspace.includes("createProjectFolderAction") && workspace.includes("moveProjectFolderAction") && workspace.includes("deleteProjectFilesAction"));
ok("file filters are outside write-only controls and apply to desktop and mobile results", workspace.includes('aria-label="Search files by name"') && workspace.includes('aria-label="Filter by file type"') && (workspace.match(/visibleFiles\.map/g)?.length ?? 0) >= 3);
ok("filtered bulk selection is constrained to visible files", workspace.includes("new Set(visibleFiles.map((file) => file.id))") && workspace.includes("setSelectedFileIds(new Set())"));
ok("mobile folder navigation updates the active folder scope", /<MobileFolderRows[\s\S]*?nodes=\{tree\}[\s\S]*?selected=\{selectedFolder\}[\s\S]*?onSelect=\{setSelectedFolder\}/.test(workspace));
ok("admin buyer options are not partner-book scoped", projectLoader.includes("if (!admin) {") && !projectLoader.includes('if (!admin || side === "buyer")'));
ok("selected leg projects its own absolute buyer and seller", projectLoader.includes("const buyer = partyRef(raw.buyer") && projectLoader.includes("const seller = partyRef(raw.seller") && !projectLoader.includes("resolveRootSellingProject") && !projectLoader.includes("downstreamParties"));
ok("project list references use the same buyer-before-seller formatter as detail navigation", projection.includes("projectLegReference(storedReference, raw.buyer.code, raw.seller.code)"));
ok("project title column is compact while spine titles retain their three-column row", projectsList.includes('<TableHead className="w-32 max-w-32">Project</TableHead>') && projectsList.includes('item.rowKind === "spine" ? 3 : 1') && projectsList.includes('"w-32 max-w-32 truncate"'));
ok("same-spine leg options are loaded for every authorized viewer", projectLoader.includes("const legOptions = raw.spineId") && projectLoader.includes('eq("spine_id", spineId)') && projectLoader.includes('leg.lifecycle_stage !== "cancelled" || leg.id === currentProjectId'));
ok("ordinary payload has no sibling option key", projectLoader.includes("...(legOptions.length > 1 ? { legOptions } : {})"));
ok("leg navigation exposes ordered links and marks only the current leg", legSelector.includes("href={`/projects/${leg.id}`}") && legSelector.includes('aria-current={active ? "page" : undefined}') && legSelector.includes("leg.reference") && !legSelector.includes("SelectTrigger"));
ok("ordinary buyer mutations still require a trading-partner link", partyActions.includes("if (!a.isPlatformAdmin) {") && partyActions.includes("Selected company is not this trader's trading partner") && adminBuyerMigration.includes("IF NOT public.is_current_user_platform_admin()") && adminBuyerMigration.includes("Buyer is not a trading partner"));
ok("admin buyer mutation retains active-customer and self-deal guards", adminBuyerMigration.includes("is_active AND is_customer") && adminBuyerMigration.includes("Buyer and seller must differ"));
ok("platform admins bypass only the buyer trading-partner check", partyActions.includes("if (!a.isPlatformAdmin) {") && adminBuyerMigration.includes("IF NOT public.is_current_user_platform_admin()") && adminBuyerMigration.includes("is_active AND is_customer") && adminBuyerMigration.includes("Buyer and seller must differ"));
ok("project header keeps the editable title left and the small spine identity above status", detail.includes("<ProjectSpineTitle") && detail.includes("Spine ID: {project.displaySpineCode}") && !detail.includes("Leg: ${project.reference}") && !detail.includes("<SummaryGrid") && !detail.includes('"Platform admin"'));
ok("spine title editing is creator-or-admin authorized and stale-safe at the database boundary", projectLoader.includes("canEditSpineTitle") && spineTitle.includes("updateProjectSpineTitle") && spineActions.includes('rpc("update_project_spine_title"') && spineActions.includes("p_expected_title") && spineTitleMigration.includes("v_spine.created_by = public.current_portal_user_id()") && spineTitleMigration.includes("is_current_user_platform_admin()") && spineTitleMigration.includes("STALE_TITLE"));
ok("project specification stays price-free before RFQ award", specificationEditor.includes("prices are added only after award") && !specificationEditor.includes("Cost build-up") && !specificationEditor.includes("Unit price") && specificationCostMigration.includes("order_line_item_components"));
ok("catalogue process values are copied through one atomic price-free boundary", specificationActions.includes('rpc("create_project_specification_line_with_snapshot"') && structuredQuoteMigration.includes("create_project_specification_line_with_processes") && !processFieldsMigration.includes("unit_cost"));
ok("process snapshots are visible to both project parties", processFieldsMigration.includes("current_user_in_org(d.buyer_organisation_id)") && processFieldsMigration.includes("current_user_in_org(d.seller_organisation_id)"));
ok("process snapshot rendering stays attached to each line and has no pricing controls", specificationTables.includes("line.processRequirements") && specificationTables.includes("Applicable processes") && specificationTables.includes("Show inactive") && !specificationTables.includes("unitCost"));
ok("read-only specification tables expose no editable mutation controls", specificationTables.includes("fieldEditable ? <input") && specificationTables.includes("editableSnapshot ? <input") && specificationTables.includes("canEdit && !line.id") && specificationTables.includes("canEdit ? <Button variant=\"ghost\" size=\"icon\" disabled={saveStatus === \"saving\"}"));
ok("specification lines and process lists start collapsed outside quotation entry", specificationTables.includes("useState<Set<string>>(() => new Set())") && specificationTables.includes("useState(false)") && specificationTables.includes("expanded ? <>") && specificationTables.includes("processesOpen || quotation ? <div"));
ok("specification lines support individual and bulk disclosure", specificationTables.includes('aria-label={`${expanded ? "Collapse" : "Expand"}') && specificationTables.includes('allExpanded ? "Collapse all" : "Expand all"') && specificationTables.includes("setExpandedLines(allExpanded ? new Set() : new Set(lineKeys))"));
ok("specification groups do not repeat compatibility headers", !specificationTables.includes("sharing the same properties") && !specificationTables.includes("compatible lines"));
ok("specification tables use the shared dense table token", specificationTables.includes("DENSE_TABLE_CLASS"));
ok("selected-leg specification capability is server-derived and passed through unchanged", projectLoader.includes("const canEditSpecification = canEditProjectSpecification") && projectLoader.includes("dealKind: raw.dealKind") && !projectLoader.includes("upstreamDealId: raw.upstreamDealId") && projectPage.includes("canEditSpecification={res.canEditSpecification}") && detail.includes("canEdit={canEditSpecification}") && !detail.includes('canEdit={viewer.canEditTerms && project.stage === "draft"}'));
ok("every specification mutation shares the canonical root-leg server guard", specificationActions.includes("const ctx = await editableProject") && specificationActions.includes("projectSpecificationEditDenialCode") && specificationActions.includes("dealKind: deal.data.dealKind") && !specificationActions.includes("upstreamDealId: deal.data.upstreamDealId"));
ok("component RLS requires seller-side commercial access", specificationCostMigration.includes("current_user_deal_terms_access") && specificationSecurityMigration.includes("current_user_in_org(deal.seller_organisation_id)") && specificationSecurityMigration.includes("p_editable"));
ok("Mills sample is an explicit development seed, not deployable schema", specificationSampleSeed.includes("'Carcass'") && specificationSampleSeed.includes("'Sheet metal'") && specificationSampleSeed.includes("'Cutting'") && specificationSampleSeed.includes("'Wet priming'") && !specificationCostMigration.includes("'Carcass'"));
ok("bilateral party block renders exactly Buyer and Seller edit slots", parties.includes('<PartySlot label="Buyer"') && parties.includes('<PartySlot label="Seller"') && !parties.includes("downstreamParties") && !parties.includes("Next party"));
ok("buyer corrections target the projected root project", parties.includes("projectId: workspace.buyerProjectId"));
ok("seller correction is separate from append-next-party", parties.includes("correctProjectLegSeller") && partyActions.includes('a.db.rpc("correct_project_leg_seller"') && !parties.includes("setProjectSeller"));
ok("ordinary trader next-leg eligibility is server-derived without sibling serialization", projectLoader.includes("mayAppendNextSeller = !a.isPlatformAdmin") && projectLoader.includes('viewer.createRoles.includes("trader")') && projectLoader.includes("hasActiveNextLeg") && projectLoader.includes("nextSellerOptions") && !nextLegControl.includes("legOptions") && !nextLegControl.includes("sibling"));
ok("admin same-spine creation remains separate from bilateral party cards", detail.includes("<ProjectNextLegControl") && nextLegControl.includes("ProjectCreateLegDialog") && !parties.includes("createSameSpineProjectLeg") && !nextLegControl.includes("PartySlot"));
ok("seller correction dropdown groups traders before suppliers and manufacturers", parties.indexOf("<SelectLabel>Traders</SelectLabel>") < parties.indexOf("<SelectLabel>Suppliers / Manufacturers</SelectLabel>"));
ok("seller correction is admin-only and Draft-only at both boundaries", partyActions.includes("Only a platform admin can correct a seller") && partyActions.includes('leg.data.lifecycleStage !== "draft"') && legCorrectionMigration.includes("is_current_user_platform_admin") && legCorrectionMigration.includes("v_order.lifecycle_stage <> 'draft'"));
ok("seller correction preserves one linked downstream leg atomically and fails closed on ambiguity", legCorrectionMigration.includes("buyer_organisation_id = v_order.seller_organisation_id") && !legCorrectionMigration.includes("upstream_deal_id = p_project_id") && legCorrectionMigration.includes("v_link_count > 1") && legCorrectionMigration.includes("Ambiguous downstream chain") && legCorrectionMigration.includes("buyer_organisation_id = p_seller_id") && legCorrectionMigration.includes("v_link.lifecycle_stage <> 'draft'"));
ok("seller correction serializes spine mutations", legCorrectionMigration.includes("pg_advisory_xact_lock") && legCorrectionMigration.includes("trg_lock_project_spine_mutation"));
ok("leg references track current bilateral parties while preserving their suffix", dynamicLegCodeMigration.includes("trg_refresh_project_leg_code") && dynamicLegCodeMigration.includes("UPDATE OF buyer_organisation_id, seller_organisation_id") && dynamicLegCodeMigration.includes("substring(coalesce(OLD.deal_code, '') from '([0-9]+)$')"));
ok("failed spine attachment is surfaced and cleaned up", orderDeals.includes("spineError") && orderDeals.includes('delete().eq("id", orderId)') && orderDeals.includes('code: "CONFLICT"'));
ok("seller correction validates active eligibility and both self-deal edges", legCorrectionMigration.includes("is_active AND (is_trader OR is_supplier OR is_producer)") && legCorrectionMigration.includes("p_seller_id = v_order.buyer_organisation_id") && legCorrectionMigration.includes("v_link.seller_organisation_id = p_seller_id"));
ok("seller correction cannot repeat an organisation elsewhere in the active spine", legCorrectionMigration.includes("Seller already belongs to this project spine") && legCorrectionMigration.includes("buyer_organisation_id = p_seller_id OR seller_organisation_id = p_seller_id"));
ok("workspace exposes concise cleanup and sharing controls", />\s*Move/.test(workspace) && />\s*Delete/.test(workspace) && /}\s*Clean/.test(workspace) && />\s*Share/.test(workspace) && />\s*Unshare\s*</.test(workspace) && /Approve\s+cleaned\s+file/.test(workspace) && workspace.includes("Shared status for") && !workspace.includes("Move selected") && !workspace.includes("Delete selected") && !workspace.includes("Clean selected") && !workspace.includes("Share with next party") && !workspace.includes("Unshare selected"));
ok("super admin has bulk approval independent of cleanup", workspace.includes("canBulkApprove") && workspace.includes("approveProjectFilesAction") && cleanupActions.includes("Only a super admin can approve files directly") && cleanupActions.includes('derivatives.get(file.id) ?? file.id'));
ok("cleaning and approval appear as independent file statuses", workspace.includes("<TableHead>Clean</TableHead>") && workspace.includes("<TableHead>Approved</TableHead>") && workspace.includes("file.wasCleaned && file.cleanFileId") && workspace.includes(">Not cleaned<") && workspace.includes('"Not approved"') && service.includes("was_cleaned: !!derivative"));
ok("external file views hide internal workflow columns and mobile metadata", workspace.includes("const showWorkflowColumns = canManageCleanup || canBulkApprove") && workspace.includes("showWorkflowColumns ? <TableHead>Clean</TableHead> : null") && workspace.includes("showWorkflowColumns ? <TableHead>Approved</TableHead> : null") && workspace.includes("showWorkflowColumns ? <TableHead>Shared</TableHead> : null") && workspace.includes("showWorkflowColumns ? <TableHead>Status</TableHead> : null") && workspace.includes("showWorkflowColumns={showWorkflowColumns}") && workspace.includes("colSpan={showWorkflowColumns ? 8 : 4}"));
ok("closed upload control uses the primary button style", workspace.includes('variant={uploadOpen ? "secondary" : "default"}'));
ok("successful cleanup deselects only files actually cleaned", workspace.includes("filter((id) => !updates.has(id))") && workspace.indexOf("filter((id) => !updates.has(id))", workspace.indexOf("const cleanSelected")) < workspace.indexOf("} catch", workspace.indexOf("const cleanSelected")));
ok("bulk cleanup preserves successes and reports skipped or failed files", cleanupActions.includes("cleaned.push(result.data)") && cleanupActions.includes("failed.push({ fileId") && workspace.includes("result.data.cleaned") && workspace.includes("skipped or failed"));
ok("sharing explains the approval prerequisite in an alert", workspace.includes("Approve each file before sharing it with RFQ recipients") && workspace.includes('role={messageTone === "warning" ? "alert" : "status"}'));
ok("clean derivatives are linked and downstream reads require approval", cleanupMigration.includes("source_file_id") && cleanupMigration.includes("shared_to_order_id") && cleanupMigration.includes("cleanup_status='approved'"));
ok("approved project files can be shared with RFQ candidates before a downstream leg exists", cleanupActions.includes("shared_with_rfq_candidates: true") && !cleanupActions.includes("Add the next party before sharing files") && service.includes("rfqSourceOrderId") && projectLoader.includes("listProjectFiles(a.db, projectId, false, candidate.sourceOrderId)"));
ok("RFQ file sharing is candidate-scoped and follows the awarded leg", rfqFileSharingMigration.includes("can_access_rfq_shared_project_file") && rfqFileSharingMigration.includes("c.status IN ('invited', 'submitted')") && rfqFileSharingMigration.includes("bind_rfq_shared_files_to_awarded_leg") && rfqFileSharingMigration.includes("shared_to_order_id = NEW.upstream_deal_id"));
ok("clean derivatives receive neutral filenames and paths", cleanupActions.includes("buildNeutralCleanFileName") && cleanupActions.includes("file_name: cleanFileName") && cleanupActions.includes("relative_path: cleanFileName"));
ok("cleanup actions never accept a caller-selected sharing destination", !cleanupActions.includes("destinationOrderId"));
ok("workspace limits parallel upload workers", workspace.includes("Math.min(3, next.length)"));
ok("workspace uses centralized icons and viewer routing", workspace.includes("ProjectFileTypeIcon") && workspace.includes("ProjectFilePreview"));
ok("workspace uploader starts behind a header control and collapses only after true idle", workspace.includes('aria-controls="project-file-upload-surface"') && workspace.includes("10_000") && workspace.includes("hasActiveUploads") && workspace.includes("uploadInteractionActive"));
ok("drop surface reports active drag and file-picker interaction", dropSurface.includes("isDragActive || pickerOpen") && dropSurface.includes("onActivityChange") && dropSurface.includes('window.addEventListener("focus"'));
ok("workspace replaces the folder column with file information", !workspace.includes("<TableHead>Folder</TableHead>") && workspace.includes("File information") && workspace.includes("Information for ${file.fileName}") && workspace.includes('["Folder", folder]') && workspace.includes('["Uploaded", formatDateTime(file.createdAt)]'));
ok("heavy engineering viewers are lazy chunks", preview.includes('dynamic(() => import("./viewers/DxfFileViewer")') && preview.includes('dynamic(() => import("./viewers/StepFileViewer")'));
ok("PDF uses the controlled pdfjs canvas viewer", preview.includes('import("pdfjs-dist")') && preview.includes("pdfPage.render") && preview.includes("setPageCount(document.numPages)"));
ok("HTML preview is sanitized, scriptless, and preserves decoded images in captures", htmlViewer.includes("sanitizeProjectHtml") && htmlViewer.includes('sandbox="allow-same-origin"') && !htmlViewer.includes("allow-scripts") && htmlViewer.includes('import("html2canvas-pro")') && htmlViewer.includes("image.decode()") && htmlViewer.includes("imageTimeout: 30_000") && htmlViewer.includes("drawVisibleHtmlImages(canvas"));
ok("DXF parsing uses a dedicated worker and destroys viewer resources", dxfViewer.includes("workerFactory") && dxfViewer.includes("viewer?.Destroy()"));
ok("STEP parsing uses a terminating local worker and disposes WebGL resources", stepViewer.includes("occt-import-js-worker.js") && stepViewer.includes("worker.terminate()") && stepViewer.includes("renderer?.dispose()"));
ok("STEP canvas has a stable bounded CSS footprint", stepViewer.includes('renderer.domElement.classList.add("block", "h-full", "w-full")') && stepViewer.includes('className="h-full min-w-0 w-full overflow-hidden"'));
ok("STEP camera fitting respects horizontal and vertical field of view", stepViewer.includes("horizontalFov") && stepViewer.includes("limitingFov") && stepViewer.includes("sphere.radius"));
ok("previewable desktop and mobile rows support pointer and semantic button activation", /onClick=\{previewable\s*\?\s*\(\)\s*=>\s*onPreview\(file\)\s*:\s*undefined\}/.test(workspace) && workspace.includes('className="flex w-full min-w-0 items-center gap-2 text-left') && workspace.includes('className="flex min-w-0 flex-1 items-center gap-3 text-left"'));
ok("unsupported rows remain outside the row preview interaction", /onClick=\{previewable\s*\?\s*\(\)\s*=>\s*onPreview\(file\)\s*:\s*undefined\}/.test(workspace) && /onClick=\{\s*isPreviewableProjectFile\(file\.fileName, file\.mimeType\)[\s\S]*?\?\s*\(\)\s*=>\s*openPreview\(file\)[\s\S]*?:\s*undefined/.test(workspace));
ok("file selection and explicit actions stop row preview propagation", workspace.includes("onClick={(event) => event.stopPropagation()}") && workspace.includes("onKeyDown={(event) => event.stopPropagation()}"));
ok("STEP refits after its container aspect changes", stepViewer.includes("if (fitRef.current) fitRef.current(); else render()"));
ok("all controlled viewer families register viewport capture", [preview, htmlViewer, dxfViewer, stepViewer].every((source) => source.includes("registerCapture")) && preview.includes("RasterFileViewer") && preview.includes("PdfFileViewer"));
ok("capture output is bounded PNG and rejects tainted canvases", capture.includes("MAX_CAPTURE_PIXELS") && capture.includes('toBlob(resolve, "image/png")') && capture.includes("getImageData"));
ok("screenshot action is capability-hidden and reports readiness", workspace.includes("canManageOfficialImages ?") && workspace.includes("disabled={!previewCapture || screenshotBusy}") && workspace.includes('aria-label="Take screenshot of visible preview"'));
ok("screenshot preflights the slot before upload", workspace.search(/checkProjectOfficialImageSlot\(projectId\)/) < workspace.search(/await\s+previewCapture\(\)/) && workspace.search(/await\s+previewCapture\(\)/) < workspace.search(/uploadProjectBrowserFile\(\s*projectId,\s*file/));
ok("screenshots use a readable timestamp name inside a dedicated folder", workspace.includes("const fileName = `Screenshot ${stamp}${suffix}.png`") && workspace.includes("`Screenshots/${fileName}`") && !workspace.includes("`Screenshots/${crypto.randomUUID()}"));
ok("official image callers clean up only their own failed upload", officialImageActions.includes("completeProjectOfficialImage") && workspace.includes("deleteProjectFileAction(uploadedId)") && officialImages.includes("deleteProjectFileAction(uploadedId)"));
ok("official image cards hide storage filenames and expose a default-image action", officialImages.includes("Make default") && officialImages.includes("Default project image") && !officialImages.includes("{file.fileName}</span>"));
ok("default image changes use the spine-image manager gate and resequence designations", officialImageActions.includes("setProjectOfficialImagePrimary") && officialImageActions.includes("mayManage(ctx.access,ctx.project)") && officialImageActions.includes("spine_project_images"));
ok("gallery projection separates view, manage, and remove capabilities", projectLoader.includes("canViewOfficialImages") && projectLoader.includes("canManageOfficialImages") && projectLoader.includes("canRemoveOfficialImages") && detail.includes("canRemove={canRemoveOfficialImages}"));
ok("authorized raw spine identity drives regular galleries without replacing the field wall", projectLoader.includes("loadSpineProjectImages(createAdminClient(), raw.spineId)") && projectLoader.includes('walled.spineId\n      ? a.db.from("spines")'));
ok("RFQ candidates are rebound to the current organisation and active order in one spine snapshot", candidateSnapshotService.indexOf('db.rpc("get_project_rfq_candidate_snapshot"') < candidateSnapshotService.indexOf('.from("project_rfq_candidates")') && candidateSnapshotService.includes('.eq("organization_id", actorOrganisationId)') && candidateSnapshotService.includes('.is("project_rfqs.orders.deleted_at", null)') && !candidateSnapshotService.includes('.from("orders")\n    .select("spine_id")'));
ok("RFQ candidate images expose viewing without mutation controls", projectLoader.includes("loadSpineProjectImages(candidateAdmin, candidate.spineId)") && projectLoader.includes("isRfqCandidate: true"));
ok("shared gallery loading preserves designation order and revalidates each file", officialImageService.includes('.order("position", { ascending: true })') && officialImageService.includes("validDesignatedFile") && officialImageService.includes('file.lifecycle_status !== "ready"') && officialImageService.includes('file.category !== "project"') && officialImageService.includes('file.file_variant !== "original"') && !officialImageService.includes("file_name"));
ok("gallery and thumbnail joins use the unambiguous owning-order relationship", (officialImageService.match(/order:orders!order_files_order_id_fkey\(spine_id\)/g) ?? []).length === 2 && !officialImageService.includes("order:orders!inner(spine_id)"));
ok("optional gallery failures degrade without replacing project authorization", !projectLoader.includes("officialImages === null") && officialImageService.includes("if (error) return []") && officialImageService.includes("if (!previewUrl) return null"));
ok("project list thumbnails use authorized raw spine identity", projectsLoader.includes("authorizedSpineIds") && projectsLoader.includes("raw.spineId,") && projectsLoader.includes("resolveProjectThumbnailUrl"));
ok("loader and mutation controls share the active-trader and deal-create management gate", projectLoader.includes("projectOfficialImageCapabilities(a.db") && projectLoader.includes('hasDealCreate: a.profile.actions.has("deal:create")') && officialImageActions.includes("mayManageProjectOfficialImages(access.actor.db") && officialImageService.includes('select("is_active,is_trader")') && officialImageService.includes("input.hasDealCreate"));
ok("gallery images are contained and open an accessible preview", officialImages.includes('className="object-contain"') && /<Dialog\s+open=\{preview !== null\}/.test(officialImages) && officialImages.includes("Preview project image"));
ok("gallery controls reveal on hover or keyboard focus and removal is confirmed", officialImages.includes("group-hover:opacity-100") && officialImages.includes("group-focus-within:opacity-100") && /<AlertDialog\s+open=\{removeTarget !== null\}/.test(officialImages) && officialImages.includes("Remove project image {removeTarget?.officialImagePosition}?"));
ok("populated gallery remains inside the shared collapsible card", officialImages.includes("images.length > 0 || canManage") && officialImages.includes("ProjectSectionCard") && officialImages.includes('id="project-images-content"'));
ok("buyer removal uses a read visibility gate and mutates only the spine designation", officialImageActions.includes("context(projectId,false)") && officialImageActions.includes("project.buyer_organisation_id===access.actor.orgId") && officialImageActions.includes('mutate(ctx,fileId,"remove")'));
ok("specification lines group by basic schema with processes nested beneath their product", specificationTables.includes("groupLinesBySchema") && specificationTables.includes("Applicable processes") && specificationTables.includes("SpecificationProductRows"));
ok("catalogue specification lines allow quantity and notes edits without mutating their snapshot", specificationEditor.includes("isCatalogSnapshot") && specificationEditor.includes("Catalogue fields and unit stay unchanged") && specificationActions.includes("specificationLineUpdate") && specificationActions.includes('.not("catalog_product_id", "is", null)') && !specificationActions.includes("Catalogue snapshots are immutable; replace the line"));
ok("catalogue fields are snapshotted atomically without polluting notes", specificationActions.includes("create_project_specification_line_with_snapshot") && structuredQuoteMigration.includes("immutable basic-field snapshot in one transaction") && structuredQuoteMigration.includes("specification_fields JSONB"));
ok("origin specification lines are created and backfilled across every active spine leg", sharedSpecificationMigration.includes("copy_origin_specification_line_to_spine") && sharedSpecificationMigration.includes("share_origin_specification_line AFTER INSERT") && sharedSpecificationMigration.includes("leg.spine_id=root_order.spine_id") && sharedSpecificationMigration.includes("origin_line_item_id=root.id"));
ok("supplier and admin quotation forms price lines and processes", quotationRows.includes('targetType: "line"') && quotationRows.includes('targetType: "process"') && rfqCard.includes("Enter quotation") && rfqActions.includes("submit_project_rfq_quote_entries"));
ok("quotation controls own all three modes while detailed entry appears only in specification tables", rfqCard.includes("Unit price for each process") && rfqCard.includes("Total for each process") && rfqCard.includes("One total for all processes") && specificationTables.includes("EUR total") && specificationTables.includes("Unit price") && !specificationTables.includes("Quotation pricing mode"));
ok("inline quotation state is shared through a parent provider without a second candidate loader", detail.includes("ProjectQuotationEditingProvider") && rfqCard.includes("activeCandidate") && specificationTables.includes("sharedQuotation.activeCandidate") && specificationTables.includes("sharedQuotation.setPrices") && specificationTables.includes("sharedQuotation.setProjectTotal") && !specificationTables.includes("getProjectRfqState") && !rfqCard.includes("project-quotation-editing") && !specificationTables.includes("project-quotation-prices-changed") && !rfqCard.includes("Changing pricing mode replaces") && (rfqCard.match(/<th className=\"p-2\">Requirement<\/th>/g) ?? []).length === 1);
ok("assigned sellers receive inline pricing without requiring the RFQ-candidate project view", detail.includes("viewer.isPlatformAdmin || viewerIsSeller") && !detail.includes("isRfqCandidate && viewerIsSeller") && specificationTables.includes("if (!quoteCanManage) return") && specificationTables.includes("disabled={!active||quotation.disabled||quotation.pending"));
ok("shared quotation coordination captures admin mode, stages supplier values, and blocks card races", specificationTables.indexOf("if (!quoteCanManage) return") < specificationTables.indexOf("const numericPrice") && (specificationTables.match(/if \(!quoteCanManage\) return/g) ?? []).length >= 2 && specificationTables.includes("buildEntries: (candidate: ProjectRfqCandidate) => ProjectQuoteEntry[], savingMode:") && specificationTables.includes("sharedQuotation.setInlineState(true") && rfqCard.includes("pending={busy}") && rfqCard.includes("Detailed quotation saved") && rfqCard.includes("Create supplier quotation") && !rfqCard.includes("setPrices: _setPrices"));
ok("specification identity and actions share an accessible full-width row above properties", specificationTables.includes('scope="row"') && specificationTables.includes("headers={lineHeaderId}") && specificationTables.includes('className="ml-auto flex shrink-0 items-center gap-1"') && specificationTables.includes('aria-label={`Delete ${line.productName ?? "line"}`}') && !specificationTables.includes('<th className="w-36 px-3 py-2 font-medium">Line item</th>'));
ok("portal content uses the full available main width", portalLayout.includes('className="w-full px-4 py-8 sm:px-6"') && !portalLayout.includes("container mx-auto"));
ok("inline admin quotation failures restore persisted pricing state", specificationTables.includes("restorePersistedQuotation(candidate)") && specificationTables.includes("quoteErrorKeysRef.current.add(entryKey)") && specificationTables.includes("quoteQueueRef.current.catch"));
ok("structured quotation totals use canonical quantities and are audited on the database boundary", structuredQuoteMigration.includes("round(canonical_quantity * unit_price)") && structuredQuoteMigration.includes("DUPLICATE_ENTRY") && structuredQuoteMigration.includes("quote_entered_as_admin=is_admin") && structuredQuoteMigration.includes("STALE_REQUIREMENT"));
ok("screenshot success refreshes both project surfaces", workspace.includes("officialImagePosition: completed.data.position") && workspace.includes("router.refresh()") && officialImageActions.includes('revalidatePath("/projects")'));
ok("project detail preserves official image metadata", projection.includes("officialImagePosition: f.officialImagePosition") && projection.includes("previewUrl: f.previewUrl"));
ok("project deletion actions re-resolve and enforce platform-admin authority", deletionActions.includes("resolveProjectsActor()") && deletionActions.includes("!actor.isPlatformAdmin") && deletionActions.includes('code:"FORBIDDEN"'));
ok("soft deletion is atomic and batch-bound without physical deletes", deletionMigration.includes("soft_delete_project") && deletionMigration.includes("deletion_batch_id=v_batch") && deletionMigration.includes("restore_soft_deleted_project") && !deletionMigration.includes("DELETE FROM"));
ok("origin legs cannot be independently removed", deletionMigration.includes("ORIGIN_LEG_REQUIRES_PROJECT_DELETE") && deletionActions.includes("Delete the whole project instead"));
ok("deleted orders and spines reject physical deletes and ordinary mutations", deletionMigration.includes("guard_project_tombstone") && deletionMigration.includes("PHYSICAL_PROJECT_DELETE_FORBIDDEN") && deletionMigration.includes("trg_guard_soft_deleted_spine_mutation") && deletionMigration.includes("NEW.deleted_at IS NULL AND public.is_current_user_platform_admin()") && deletionMigration.includes("to_jsonb(NEW)-ARRAY['deleted_at','deleted_by','deletion_batch_id','updated_at']"));
ok("normal deal and project loaders exclude tombstones", orderDealService.includes('.is("deleted_at", null)') && projectsLoader.includes('spineQuery.is("deleted_at", null)'));
ok("admin list exposes confirmed delete and recovery controls", projectsList.includes("Delete project") && projectsList.includes("Delete leg") && projectsList.includes("Restore project") && projectsList.includes("AlertDialogDescription"));
ok("individually deleted legs have a dedicated recovery path", deletionMigration.includes("restore_soft_deleted_project_leg") && deletionActions.includes("restoreProjectLeg") && projectsList.includes("Restore leg"));
ok("origin legs serialize guidance instead of a destructive mutation", projectsLoader.includes("isOriginLeg") && projectsList.includes("Delete project instead") && projectsList.includes("if (!deletedOnly && mutationTarget.isOriginLeg)"));
ok("recovery is paged and refreshes authoritative server state", projectsLoader.includes("recoveryPageSize") && orderDealService.includes("filters.offset") && projectsList.includes("router.refresh()") && projectsList.includes("recoveryHasMore"));
ok("RFQ writes require an active parent order", deletionMigration.includes("guard_project_rfq_active_order") && deletionMigration.includes("trg_project_rfq_candidates_active_order") && deletionMigration.includes("o.deleted_at IS NULL"));
ok("commercial project reads reject tombstoned orders", commercialActions.includes('.is("deleted_at",null)'));

console.log(`\nprojects-workspace.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
