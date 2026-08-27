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
 * Chain and value members are emitted only after their domain walls pass.
 * Deliberately absent everywhere: margin + P&L figures, order_documents (they carry storage paths
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

export interface ProjectLegOption {
  id: string;
  reference: string;
}

/** Safe projection for the selected bilateral leg. */
export interface ProjectPartyWorkspace {
  /** Current deal whose buyer is displayed/edited. */
  buyerProjectId: string | null;
  buyer: ProjectPartyRef | null;
  seller: ProjectPartyRef | null;
  /** Same-spine active legs. Admin-only and omitted unless there is a choice. */
  legOptions?: ProjectLegOption[];
  buyerOptions: ProjectPartyOption[];
  sellerOptions: ProjectPartyOption[];
  /** Eligible choices for appending a next leg. Never contains sibling leg IDs. */
  nextSellerOptions: ProjectPartyOption[];
  canEditBuyer: boolean;
  canEditSeller: boolean;
  canAppendNextSeller: boolean;
}

/** One visible bilateral deal = one clickable row, optionally grouped by spine. */
export interface ProjectListItem {
  id: string;
  /** Deal code (preferred) or the legacy ORD-### code. */
  reference: string;
  name: string | null;
  /** Persisted spine code when chain visibility permits; deal reference otherwise. */
  spineCode: string;
  /** Presentation-only grouping key. Never identifies an invisible sibling. */
  groupKey: string;
  /** Visible chain depth: zero for the parent or a standalone row. */
  depth: number;
  stage: string;
  stageLabel: string;
  /** The deal's framing FROM THIS VIEWER's standpoint (never absolute). */
  direction: "sell" | "buy";
  /** The viewer's own deal partner. null when the viewer is not a party. */
  counterparty: ProjectPartyRef | null;
  buyer: ProjectPartyRef | null;
  seller: ProjectPartyRef | null;
  deliveryDeadline: string | null;
  /** Files attached to THIS deal only (RLS-filtered); never a chain roll-up. */
  fileCount: number;
  /** Temporary sourcing invitation; the viewer is not yet a committed deal party. */
  rfqInvitation?: boolean;
  /** Only for viewers with the `deal_terms` domain. */
  currency?: string;
  /** Final value in minor units; absent without deal_terms permission. */
  valueCents?: number | null;
}

export interface ProjectListFilterOption {
  id: string;
  label: string;
}

export interface ProjectListFilters {
  search: string;
  customer: string;
  trader: string;
  supplier: string;
  stage: string;
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
  /** Canonical spine label for viewers allowed to see chain identity. */
  displaySpineCode?: string;
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
