/**
 * Timber Projects — the ONLY shapes that ever cross the server → client
 * boundary for this feature.
 *
 * Read these as an allow-list, not a convenience DTO: the projectors in
 * projection.ts build these objects key by key from an already-walled deal, so
 * a field that is not listed here cannot be serialized at all — not even as
 * `null`, and never merely hidden with CSS. Anything price-, margin-, chain- or
 * hidden-party-shaped is ABSENT for viewers without the matching grant, which
 * is why several members below are optional rather than nullable:
 *
 *   nullable  = "this viewer may see it; there is nothing to show"
 *   optional  = "this viewer may NOT see it; the key is not in the payload"
 *
 * Deliberately absent everywhere: spineId / spineCode / upstreamDealId (chain),
 * margin + P&L figures, deal totals, order_documents (they carry storage paths
 * and Oscar URLs), external refs, and `storage_path` on any file.
 */
import type { ProjectPersona } from "./personas";
import type { ProjectCreateRole } from "./capabilities";

/** A party on a project, as shown to this viewer. */
export interface ProjectPartyRef {
  id: string;
  name: string | null;
  code: string | null;
  /** Presentation labels from the org's role flags; [] when not readable. */
  personas: ProjectPersona[];
  /** Which slot this party fills on the deal. Only set for `otherParties`. */
  role?: "customer" | "seller" | "producer" | "buyer";
}

/** Who is looking — drives the persona strip in the page header. */
export interface ProjectsViewer {
  isPlatformAdmin: boolean;
  organisationId: string | null;
  organisationName: string | null;
  /** Personas of the CURRENT organisation. Empty for a platform admin with no org. */
  personas: ProjectPersona[];
  canCreateProject: boolean;
  canWriteFiles: boolean;
  canEditTerms: boolean;
  createRoles: ProjectCreateRole[];
}

export interface ProjectPartyOption {
  id: string;
  code: string;
  name: string;
  /** Presentation grouping. Seller options always classify dual-role orgs as traders. */
  group: "buyers" | "traders" | "suppliers";
}

export interface ProjectChainParty extends ProjectPartyRef {
  projectId: string;
  group: "traders" | "suppliers";
}

/** Safe, viewer-relative projection used by the Parties chain builder. */
export interface ProjectPartyWorkspace {
  /** Deal whose buyer is displayed/edited. Differs from the viewed deal only for admin purchase-leg projections. */
  buyerProjectId: string | null;
  /** Root deal used for chain extension; null when an admin purchase leg cannot resolve uniquely. */
  chainProjectId: string | null;
  center: ProjectPartyRef | null;
  buyer: ProjectPartyRef | null;
  seller: (ProjectPartyRef & { projectId?: string }) | null;
  /** Admin-only ordered downstream projection. Omitted for ordinary party viewers. */
  downstreamParties?: ProjectChainParty[];
  buyerOptions: ProjectPartyOption[];
  sellerOptions: ProjectPartyOption[];
  centerOptions: ProjectPartyOption[];
  canSetBuyer: boolean;
  canSetSeller: boolean;
  canEditBuyer: boolean;
  canEditCenter: boolean;
}

/** One visible bilateral deal = one project row. */
export interface ProjectListItem {
  id: string;
  /** Deal code (preferred) or the legacy ORD-### code. */
  reference: string;
  name: string | null;
  stage: string;
  stageLabel: string;
  /** The deal's framing FROM THIS VIEWER's standpoint (never absolute). */
  direction: "sell" | "buy";
  /** The viewer's own deal partner. null when the viewer is not a party. */
  counterparty: ProjectPartyRef | null;
  deliveryDeadline: string | null;
  /** Files attached to THIS deal only (RLS-filtered); never a chain roll-up. */
  fileCount: number;
  /** Only for viewers with the `deal_terms` domain. */
  currency?: string;
}

/** A specification line. Price members appear only with `deal_terms`. */
export interface ProjectLine {
  id: string | null;
  lineNo: number;
  productName: string | null;
  woodSpecies: string | null;
  humidity: string | null;
  processing: string | null;
  quality: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
  unit: string;
  unitPriceCents?: number | null;
  lineTotalCents?: number | null;
  notes: string | null;
  /** Internal cost build-up. Absent unless the viewer may see deal terms. */
  components?: ProjectLineComponent[];
}

export interface ProjectLineComponent {
  id: string;
  type: "material" | "process" | "service";
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCostCents: number;
}

/** Commercial terms — the whole object is absent without `deal_terms`. */
export interface ProjectTerms {
  incoterms: string | null;
  incotermsPlace: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  advancePct: number | null;
}

/** Original workspace-file metadata only. Storage/source paths and signed URLs
 * never enter a loader payload. */
export interface ProjectFileMeta {
  id: string;
  fileName: string;
  relativePath: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  lifecycleStatus: "uploading" | "ready" | "failed";
  createdAt: string;
  cleanupStatus: "not_started" | "processing" | "needs_review" | "approved" | "failed";
  cleanFileId: string | null;
  cleanupFindingsCount: number;
  shared: boolean;
  sharedInbound: boolean;
}

/** Logical workspace folder. It may exist without descendant files. */
export interface ProjectFolderMeta {
  id: string;
  relativePath: string;
  createdAt: string;
}

export interface ProjectFileCounts {
  total: number;
}

export interface ProjectDetail extends ProjectListItem {
  /** Parties beyond the viewer's own counterparty, ONLY when the field wall
   *  let them through (a hidden party yields no entry at all). */
  otherParties: ProjectPartyRef[];
  terms?: ProjectTerms;
  lines: ProjectLine[];
  files: ProjectFileMeta[];
  folders: ProjectFolderMeta[];
  fileCounts: ProjectFileCounts;
  notes: string | null;
}

/** Loader results. `deny` mirrors the gate so routes can 404-vs-login. */
export type ProjectsResult<T> =
  | ({ ok: true } & T)
  | { ok: false; deny: "not_found" | "login" };
