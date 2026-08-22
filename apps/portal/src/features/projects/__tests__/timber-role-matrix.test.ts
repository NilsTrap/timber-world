/**
 * Credential-free Timber MVP acceptance matrix.
 *
 * This deliberately composes production policy functions instead of copying
 * their permission formulae into fixtures. Run it through `pnpm --dir
 * apps/portal test:timber-mvp-gate` so the existing focused suites run beside
 * this matrix.
 */
import {
  canAccessCounterpartyRecord,
  decideCounterpartyBookMode,
  isValidCounterpartyId,
  type OrganisationBookFacts,
} from "../../counterparties/policy";
import { projectDealView, resolveFieldAccess } from "../../orders/services/dealFields";
import { emptyAccessProfile, fullAccessProfile } from "@/lib/access/types";
import type { ProjectsActor } from "../access";
import {
  requireVisibleProjectWith,
  type VisibleProjectDependencies,
} from "../actions/_projectAuthorization";
import {
  authoriseProjectFileWith,
  type ProjectFileAccessDependencies,
} from "../actions/_projectFileAccess";
import { evaluateProjectCapabilities } from "../capabilities";
import { evaluateProjectsGate, PROJECTS_MODULE } from "../gate";
import { personasForOrg, type OrgRoleFlags } from "../personas";
import {
  toProjectDetail,
  type DealHeaderLike,
  type DealLineLike,
  type ProjectionContext,
} from "../projection";
import type { CounterpartyBook } from "../../counterparties/types";
import type { ProjectFileMeta } from "../types";

const ORG = "11111111-1111-4111-8111-111111111111";
const PARTNER = "22222222-2222-4222-8222-222222222222";
const PRODUCER = "33333333-3333-4333-8333-333333333333";
const UNRELATED = "44444444-4444-4444-8444-444444444444";
const PROJECT = "55555555-5555-4555-8555-555555555555";
const UNKNOWN_PROJECT = "66666666-6666-4666-8666-666666666666";
const HIDDEN_PROJECT = "77777777-7777-4777-8777-777777777777";
const CROSS_LEG_PROJECT = "88888888-8888-4888-8888-888888888888";
const FILE = "99999999-9999-4999-8999-999999999999";
const UNKNOWN_FILE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HIDDEN_FILE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CROSS_LEG_FILE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BOOKS: readonly CounterpartyBook[] = ["clients", "suppliers", "traders"];

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}
function ok(label: string, condition: boolean) {
  if (condition) passed++;
  else { failed++; console.error(`✗ ${label}`); }
}

interface ExpectedAccess {
  books: CounterpartyBook[];
  recordReadBooks: CounterpartyBook[];
  recordManageBooks: CounterpartyBook[];
  projectsGate: "admin" | "module" | "login" | "not_found";
  targetProjectVisible: boolean;
  createRoles: Array<"buyer" | "trader">;
  canCreateProject: boolean;
  files: { read: boolean; write: boolean };
  termsInPayload: boolean;
}

interface MatrixActor {
  label: string;
  authenticated: boolean;
  isPlatformAdmin: boolean;
  orgId: string | null;
  orgRoles: OrgRoleFlags;
  orgBookFacts: OrganisationBookFacts | null;
  companyGrants: CounterpartyBook[];
  companyTargetOrgId: string;
  companyTargetLinked: boolean;
  modules: string[];
  hasDealCreate: boolean;
  expected: ExpectedAccess;
}

const matrix: MatrixActor[] = [
  {
    label: "platform admin",
    authenticated: true, isPlatformAdmin: true, orgId: null, orgRoles: {}, orgBookFacts: null,
    companyGrants: [], companyTargetOrgId: PARTNER, companyTargetLinked: false,
    modules: [], hasDealCreate: false,
    expected: {
      books: ["clients", "suppliers", "traders"],
      recordReadBooks: ["clients", "suppliers", "traders"],
      recordManageBooks: ["clients", "suppliers", "traders"],
      projectsGate: "admin", targetProjectVisible: true,
      createRoles: ["trader"], canCreateProject: true,
      files: { read: true, write: true }, termsInPayload: true,
    },
  },
  {
    label: "Buyer / Customer",
    authenticated: true, isPlatformAdmin: false, orgId: ORG,
    orgRoles: { isCustomer: true }, orgBookFacts: { is_customer: true },
    companyGrants: [], companyTargetOrgId: ORG, companyTargetLinked: false,
    modules: [PROJECTS_MODULE], hasDealCreate: true,
    expected: {
      books: ["clients"], recordReadBooks: ["clients"], recordManageBooks: [],
      projectsGate: "module", targetProjectVisible: true,
      createRoles: ["buyer"], canCreateProject: true,
      files: { read: true, write: true }, termsInPayload: false,
    },
  },
  {
    label: "Trader — clients book only",
    authenticated: true, isPlatformAdmin: false, orgId: ORG,
    orgRoles: { isTrader: true }, orgBookFacts: { is_trader: true },
    companyGrants: ["clients"], companyTargetOrgId: PARTNER, companyTargetLinked: true,
    modules: [PROJECTS_MODULE], hasDealCreate: true,
    expected: {
      books: ["clients"], recordReadBooks: ["clients"], recordManageBooks: ["clients"],
      projectsGate: "module", targetProjectVisible: true,
      createRoles: ["trader"], canCreateProject: true,
      files: { read: true, write: true }, termsInPayload: false,
    },
  },
  {
    label: "Trader — suppliers book only",
    authenticated: true, isPlatformAdmin: false, orgId: ORG,
    orgRoles: { isTrader: true }, orgBookFacts: { is_trader: true },
    companyGrants: ["suppliers"], companyTargetOrgId: PARTNER, companyTargetLinked: true,
    modules: [PROJECTS_MODULE], hasDealCreate: true,
    expected: {
      books: ["suppliers"], recordReadBooks: ["suppliers"], recordManageBooks: ["suppliers"],
      projectsGate: "module", targetProjectVisible: true,
      createRoles: ["trader"], canCreateProject: true,
      files: { read: true, write: true }, termsInPayload: false,
    },
  },
  {
    label: "Trader — clients and suppliers books",
    authenticated: true, isPlatformAdmin: false, orgId: ORG,
    orgRoles: { isTrader: true }, orgBookFacts: { is_trader: true },
    companyGrants: ["clients", "suppliers"], companyTargetOrgId: PARTNER, companyTargetLinked: true,
    modules: [PROJECTS_MODULE], hasDealCreate: true,
    expected: {
      books: ["clients", "suppliers"],
      recordReadBooks: ["clients", "suppliers"], recordManageBooks: ["clients", "suppliers"],
      projectsGate: "module", targetProjectVisible: true,
      createRoles: ["trader"], canCreateProject: true,
      files: { read: true, write: true }, termsInPayload: false,
    },
  },
  {
    label: "Manufacturer / Supplier",
    authenticated: true, isPlatformAdmin: false, orgId: ORG,
    orgRoles: { isManufacturer: true, isSupplier: true },
    orgBookFacts: { is_manufacturer: true, is_supplier: true },
    companyGrants: [], companyTargetOrgId: ORG, companyTargetLinked: false,
    modules: [PROJECTS_MODULE], hasDealCreate: true,
    expected: {
      books: ["suppliers"], recordReadBooks: ["suppliers"], recordManageBooks: [],
      projectsGate: "module", targetProjectVisible: true,
      createRoles: [], canCreateProject: false,
      files: { read: true, write: true }, termsInPayload: false,
    },
  },
  {
    label: "Buyer + Trader multi-role",
    authenticated: true, isPlatformAdmin: false, orgId: ORG,
    orgRoles: { isCustomer: true, isTrader: true },
    orgBookFacts: { is_customer: true, is_trader: true },
    companyGrants: [], companyTargetOrgId: ORG, companyTargetLinked: false,
    modules: [PROJECTS_MODULE], hasDealCreate: true,
    expected: {
      books: ["clients"], recordReadBooks: ["clients"], recordManageBooks: [],
      projectsGate: "module", targetProjectVisible: true,
      createRoles: ["buyer", "trader"], canCreateProject: true,
      files: { read: true, write: true }, termsInPayload: false,
    },
  },
  {
    label: "inactive user",
    authenticated: false, isPlatformAdmin: false, orgId: null,
    orgRoles: {}, orgBookFacts: null,
    companyGrants: [], companyTargetOrgId: PARTNER, companyTargetLinked: false,
    modules: [], hasDealCreate: false,
    expected: {
      books: [], recordReadBooks: [], recordManageBooks: [],
      projectsGate: "login", targetProjectVisible: false,
      createRoles: [], canCreateProject: false,
      files: { read: false, write: false }, termsInPayload: false,
    },
  },
  {
    label: "inactive membership",
    authenticated: true, isPlatformAdmin: false, orgId: null,
    orgRoles: {}, orgBookFacts: null,
    companyGrants: [], companyTargetOrgId: PARTNER, companyTargetLinked: false,
    modules: [], hasDealCreate: false,
    expected: {
      books: [], recordReadBooks: [], recordManageBooks: [],
      projectsGate: "not_found", targetProjectVisible: false,
      createRoles: [], canCreateProject: false,
      files: { read: false, write: false }, termsInPayload: false,
    },
  },
  {
    label: "effective no-module / no-action user",
    authenticated: true, isPlatformAdmin: false, orgId: ORG,
    orgRoles: { isCustomer: true }, orgBookFacts: { is_customer: true },
    companyGrants: [], companyTargetOrgId: ORG, companyTargetLinked: false,
    modules: [], hasDealCreate: false,
    expected: {
      books: ["clients"], recordReadBooks: ["clients"], recordManageBooks: [],
      projectsGate: "not_found", targetProjectVisible: false,
      createRoles: ["buyer"], canCreateProject: false,
      files: { read: false, write: false }, termsInPayload: false,
    },
  },
  {
    label: "unrelated-organisation Buyer",
    authenticated: true, isPlatformAdmin: false, orgId: UNRELATED,
    orgRoles: { isCustomer: true }, orgBookFacts: { is_customer: true },
    companyGrants: [], companyTargetOrgId: PARTNER, companyTargetLinked: false,
    modules: [PROJECTS_MODULE], hasDealCreate: true,
    expected: {
      books: ["clients"], recordReadBooks: [], recordManageBooks: [],
      projectsGate: "module", targetProjectVisible: false,
      createRoles: ["buyer"], canCreateProject: true,
      files: { read: false, write: false }, termsInPayload: false,
    },
  },
];

function gateLabel(actor: MatrixActor): ExpectedAccess["projectsGate"] {
  const decision = evaluateProjectsGate({
    flagEnabled: true,
    authenticated: actor.authenticated,
    isPlatformAdmin: actor.isPlatformAdmin,
    orgId: actor.orgId,
    modules: new Set(actor.modules),
  });
  return decision.ok ? decision.reason : decision.deny;
}

function dealFixture() {
  const line: DealLineLike = {
    id: "line-1", side: "sell", lineNo: 1, productName: "Oak board", woodSpecies: "Oak",
    humidity: null, processing: null, quality: "A", thickness: "20", width: "100",
    length: "2000", pieces: "20", volumeM3: 1, unit: "m3",
    unitPriceCents: 90000, vatRate: 21, lineTotalCents: 90000,
  };
  return {
    id: PROJECT, code: "ORD-001", dealCode: "TWP-001", name: "Matrix project",
    dealKind: "buy_sell", currency: "EUR", status: "confirmed", lifecycleStage: "confirmed",
    incoterms: "DAP", incotermsPlace: "Riga", advancePct: 20,
    paymentTerms: "30 days", deliveryTerms: "Delivered", deliveryDeadline: "2026-09-01",
    transportBilling: "in_price", notes: "Safe project note",
    sellerSigneeName: "Seller", sellerSigneeRole: "Director",
    buyerSigneeName: "Buyer", buyerSigneeRole: "Buyer",
    customer: { id: PARTNER, code: "BUY", name: "Buyer" },
    seller: { id: ORG, code: "TWP", name: "Timber World" },
    producer: { id: PRODUCER, code: "SUP", name: "Hidden supplier" },
    buyer: { id: PARTNER, code: "BUY", name: "Buyer" },
    lineItems: [line],
    spineId: "forbidden-spine", upstreamDealId: "forbidden-upstream",
    marginApprovedAt: "2026-08-01T00:00:00Z", plTotalValue: 1,
    eurPerM3: 1, externalRefs: [{ secret: true }],
    documents: [{ storagePath: "secret/document.pdf", signedUrl: "https://invalid.example/token" }],
  };
}

const files = [{
  id: FILE, fileName: "drawing.pdf", relativePath: "drawings/drawing.pdf",
  mimeType: "application/pdf", fileSizeBytes: 42, lifecycleStatus: "ready",
  createdAt: "2026-08-01T00:00:00Z", storagePath: "secret/file.pdf",
  signedUrl: "https://invalid.example/signed",
}] as unknown as ProjectFileMeta[];

function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, out);
    return out;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out.add(key);
    collectKeys(nested, out);
  }
  return out;
}

const forbiddenPayloadKeys = [
  "storagePath", "storage_path", "signedUrl", "spineId", "upstreamDealId",
  "marginApprovedAt", "plTotalValue", "eurPerM3", "externalRefs", "documents", "vatRate",
];

function allowedActor(actor: MatrixActor): ProjectsActor {
  const profile = actor.isPlatformAdmin ? fullAccessProfile() : emptyAccessProfile();
  if (actor.hasDealCreate) profile.actions.add("deal:create");
  return {
    ok: true,
    db: {} as Extract<ProjectsActor, { ok: true }>["db"],
    actor: {
      portalUserId: actor.authenticated ? `matrix-${actor.label}` : null,
      isPlatformAdmin: actor.isPlatformAdmin,
      isServiceAgent: false,
      label: "timber-role-matrix",
    },
    orgId: actor.orgId,
    organisationName: actor.label,
    isPlatformAdmin: actor.isPlatformAdmin,
    profile,
    access: resolveFieldAccess(profile),
    portalUserId: actor.authenticated ? `matrix-${actor.label}` : null,
  };
}

function projectDeal(
  id: string,
  sellerId: string,
  buyerId: string,
  spineId: string,
) {
  return {
    ...dealFixture(),
    id,
    seller: { id: sellerId, code: "SELL", name: "Seller" },
    buyer: { id: buyerId, code: "BUY", name: "Buyer" },
    spineId,
  };
}

function projectDependencies(actor: MatrixActor): VisibleProjectDependencies {
  const gate = gateLabel(actor);
  const resolved: ProjectsActor = gate === "admin" || gate === "module"
    ? allowedActor(actor)
    : { ok: false, deny: gate === "login" ? "login" : "not_found" };
  const rows = new Map([
    [PROJECT, projectDeal(PROJECT, ORG, PARTNER, "matrix-spine")],
    [HIDDEN_PROJECT, projectDeal(HIDDEN_PROJECT, UNRELATED, PRODUCER, "other-spine")],
    // Same transaction spine as PROJECT, but the customer is not a party to
    // this supplier leg. A chain relationship must never widen visibility.
    [CROSS_LEG_PROJECT, projectDeal(CROSS_LEG_PROJECT, PRODUCER, ORG, "matrix-spine")],
  ]);
  return {
    resolveActor: async () => resolved,
    getDeal: async (_db, _actor, projectId) => {
      const row = rows.get(projectId);
      return row
        ? { success: true, data: row as never }
        : { success: false, error: "Order not found", code: "NOT_FOUND" };
    },
  };
}

function fileDependencies(
  actor: MatrixActor,
  projects: VisibleProjectDependencies,
): ProjectFileAccessDependencies {
  const filesById = new Map([
    [FILE, { id: FILE, order_id: PROJECT }],
    [HIDDEN_FILE, { id: HIDDEN_FILE, order_id: HIDDEN_PROJECT }],
    [CROSS_LEG_FILE, { id: CROSS_LEG_FILE, order_id: CROSS_LEG_PROJECT }],
  ]);
  return {
    resolveActor: projects.resolveActor,
    locateFile: async (_db, fileId) => {
      const file = filesById.get(fileId);
      return file
        ? {
            ...file,
            file_name: "drawing.pdf",
            relative_path: "drawings/drawing.pdf",
            mime_type: "application/pdf",
            storage_path: `${file.order_id}/project/internal_drawing.pdf`,
          }
        : null;
    },
    requireProject: (projectId, write) => requireVisibleProjectWith(projectId, write, projects),
  };
}

async function run() {
for (const actor of matrix) {
  const modes = new Map(BOOKS.map((book) => [book, decideCounterpartyBookMode({
    book,
    platformAdmin: actor.isPlatformAdmin,
    hasExactBookGrant: actor.companyGrants.includes(book),
    callerOrgId: actor.orgId,
    callerOrg: actor.orgBookFacts,
  })]));
  const visibleBooks = BOOKS.filter((book) => modes.get(book) !== null);
  const recordBooks = (intent: "read" | "manage") => BOOKS.filter((book) => {
    const mode = modes.get(book);
    return mode != null && canAccessCounterpartyRecord({
      mode,
      callerOrgId: actor.orgId,
      targetOrgId: actor.companyTargetOrgId,
      linked: actor.companyTargetLinked,
      intent,
    });
  });
  eq(`${actor.label}: Companies books`, visibleBooks, actor.expected.books);
  eq(`${actor.label}: Company records`, recordBooks("read"), actor.expected.recordReadBooks);
  eq(`${actor.label}: Company edits`, recordBooks("manage"), actor.expected.recordManageBooks);

  const projectsGate = gateLabel(actor);
  eq(`${actor.label}: Projects gate`, projectsGate, actor.expected.projectsGate);
  const raw = dealFixture();
  const projectDeps = projectDependencies(actor);
  const readAccess = await requireVisibleProjectWith(PROJECT, false, projectDeps);
  const targetProjectVisible = readAccess.ok;
  eq(`${actor.label}: target project visibility`, targetProjectVisible, actor.expected.targetProjectVisible);

  const personas = personasForOrg(actor.orgRoles);
  const capabilities = evaluateProjectCapabilities({
    isPlatformAdmin: actor.isPlatformAdmin,
    hasDealCreate: actor.hasDealCreate,
    organisationId: actor.orgId,
    personas,
  });
  eq(`${actor.label}: create roles`, capabilities.createRoles, actor.expected.createRoles);
  eq(`${actor.label}: project creation`, capabilities.canCreateProject, actor.expected.canCreateProject);
  const fileDeps = fileDependencies(actor, projectDeps);
  const fileAccess = {
    read: (await authoriseProjectFileWith(FILE, false, fileDeps)).ok,
    write: (await authoriseProjectFileWith(FILE, true, fileDeps)).ok,
  };
  eq(`${actor.label}: workspace access`, fileAccess, actor.expected.files);

  if (targetProjectVisible) {
    const profile = actor.isPlatformAdmin ? fullAccessProfile() : emptyAccessProfile();
    const access = resolveFieldAccess(profile);
    const walled = projectDealView(dealFixture(), access, actor.orgId) as unknown as DealHeaderLike & {
      lineItems: DealLineLike[];
    };
    const ctx: ProjectionContext = {
      access,
      viewerOrgId: actor.orgId,
      isPlatformAdmin: actor.isPlatformAdmin,
      personasByOrgId: new Map([
        [ORG, ["trader"]], [PARTNER, ["buyer"]], [PRODUCER, ["supplier"]],
      ]),
    };
    const detail = toProjectDetail(raw as unknown as DealHeaderLike, walled, ctx, {
      lines: walled.lineItems ?? [], files, fileCounts: { total: files.length },
    });
    const keys = collectKeys(detail);
    eq(`${actor.label}: terms field-wall`, "terms" in detail, actor.expected.termsInPayload);
    ok(`${actor.label}: forbidden fields/files omitted`, forbiddenPayloadKeys.every((key) => !keys.has(key)));
  }
}

// Real production project/file guards collapse every pasted-ID denial to the
// same unavailable result, including a sibling deal on the same spine.
const customer = {
  ...matrix.find((actor) => actor.label === "Buyer / Customer")!,
  orgId: PARTNER,
};
const customerProjects = projectDependencies(customer);
const customerFiles = fileDependencies(customer, customerProjects);
const projectUnavailable = { ok: false, error: "Project unavailable", code: "NOT_FOUND" };
const fileUnavailable = { ok: false, error: "File unavailable", code: "NOT_FOUND" };
ok("malformed Company ID is rejected", !isValidCounterpartyId("pasted-company-id"));
ok("visible File ID passes its owning-project guard", (await authoriseProjectFileWith(FILE, false, customerFiles)).ok);
eq("malformed Project ID is unavailable", await requireVisibleProjectWith("pasted-project-id", false, customerProjects), projectUnavailable);
eq("unknown Project ID is unavailable", await requireVisibleProjectWith(UNKNOWN_PROJECT, false, customerProjects), projectUnavailable);
eq("valid hidden Project ID is unavailable", await requireVisibleProjectWith(HIDDEN_PROJECT, false, customerProjects), projectUnavailable);
eq("cross-leg Project ID is unavailable", await requireVisibleProjectWith(CROSS_LEG_PROJECT, false, customerProjects), projectUnavailable);
eq("malformed File ID is unavailable", await authoriseProjectFileWith("pasted-file-id", false, customerFiles), fileUnavailable);
eq("unknown File ID is unavailable", await authoriseProjectFileWith(UNKNOWN_FILE, false, customerFiles), fileUnavailable);
eq("valid hidden File ID is unavailable", await authoriseProjectFileWith(HIDDEN_FILE, false, customerFiles), fileUnavailable);
eq("cross-leg File ID is unavailable", await authoriseProjectFileWith(CROSS_LEG_FILE, false, customerFiles), fileUnavailable);

console.log(`\nTimber role matrix: ${matrix.length} actors, ${passed} assertions passed, ${failed} failed`);
if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
