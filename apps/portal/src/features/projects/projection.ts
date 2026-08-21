/**
 * Timber Projects — the payload projectors (PURE: no DB, no next imports, so
 * the whole redaction matrix is unit-tested in __tests__/).
 *
 * Contract, and the reason this file exists at all:
 *
 *   1. The caller has ALREADY run the deal through the E4 field wall
 *      (`projectDealView(view, resolveFieldAccess(profile), viewerOrgId)`),
 *      which nulls terms/prices, collapses hidden customer/producer embeds to
 *      HIDDEN_PARTY and clears the chain pointers.
 *   2. These projectors then BUILD A NEW OBJECT key by key from that walled
 *      view. Never `{...view}`: a spread would silently re-expose every field a
 *      future migration adds to `orders` (spine ids, margin approval, notes on
 *      documents…). If you add a field, add it here deliberately, or it does not
 *      ship. The `serialized keys ⊆ whitelist` test enforces this.
 *   3. A value the viewer may not see is ABSENT (no key), not `null` and never
 *      "rendered hidden" — the payload itself is the wall.
 *
 * The party rules follow the deal layer (§9.2): a viewer always sees their OWN
 * transaction partner (that is who they are trading with), which is resolved
 * from the RAW party ids because the wall may have blanked the embeds; every
 * OTHER party is shown only if the field wall passed it through. A viewer who
 * is party to neither leg gets no counterparty at all unless they are a
 * platform admin — nothing is inferred for them.
 */
import { dealDirectionFor, resolveViewerDirection } from "../orders/services/orderDeals";
import { stageLabel } from "../orders/services/stageColors";
import type { FieldAccess } from "../orders/services/dealFields";
import type { ProjectPersona } from "./personas";
import type {
  ProjectDetail,
  ProjectFileCounts,
  ProjectFileMeta,
  ProjectLine,
  ProjectListItem,
  ProjectPartyRef,
} from "./types";

/** Structural shape of the deal header this module consumes — satisfied by
 *  `OrderDealSummary` from the orders service (kept local so this file has no
 *  runtime dependency beyond the two pure helpers above). */
export interface DealPartyLike {
  id: string | null;
  code: string | null;
  name: string | null;
}

export interface DealHeaderLike {
  id: string;
  code: string;
  dealCode: string | null;
  name: string | null;
  dealKind: string;
  currency: string;
  lifecycleStage: string;
  incoterms: string | null;
  incotermsPlace: string | null;
  advancePct: number | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  deliveryDeadline: string | null;
  notes: string | null;
  customer: DealPartyLike;
  seller: DealPartyLike;
  producer: DealPartyLike;
  buyer: DealPartyLike;
}

export interface DealLineLike {
  id?: string;
  side: string;
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
  unitPriceCents: number | null;
  /** Required by the field wall's line shape; deliberately NOT serialized. */
  vatRate: number | null;
  lineTotalCents: number | null;
}

export interface ProjectionContext {
  /** Resolved from the viewer's access profile (full profile for admins). */
  access: FieldAccess;
  viewerOrgId: string | null;
  /** portal_users.is_platform_admin — never the legacy `role === "admin"`. */
  isPlatformAdmin: boolean;
  /** org id → personas, for parties already present in the payload. */
  personasByOrgId: ReadonlyMap<string, ProjectPersona[]>;
}

function partyRef(
  party: DealPartyLike,
  ctx: ProjectionContext,
  role?: ProjectPartyRef["role"],
): ProjectPartyRef | null {
  if (!party.id) return null;
  const ref: ProjectPartyRef = {
    id: party.id,
    name: party.name,
    code: party.code,
    personas: ctx.personasByOrgId.get(party.id) ?? [],
  };
  if (role) ref.role = role;
  return ref;
}

/**
 * Is `orgId` one of the bilateral deal's party slots (seller or buyer)? The
 * legacy producer slot is deliberately not a party: E8 removed that RLS arm
 * after splitting producer work into a separate buy leg. The list query already
 * filters on this for non-admins; detail re-checks so a deal reachable through
 * ANOTHER membership cannot use the CURRENT organisation's field wall.
 */
export function isPartyOrg(deal: DealHeaderLike, orgId: string | null): boolean {
  if (!orgId) return false;
  return deal.seller.id === orgId || deal.buyer.id === orgId;
}

export interface ResolvedProjectParties {
  /** The deal's framing from this viewer's standpoint. */
  direction: "sell" | "buy";
  /** The viewer's own transaction partner, or null when they are not a party
   *  (and are not a platform admin). */
  counterparty: ProjectPartyRef | null;
  /** Org id of that partner — used to keep it out of `otherParties`. */
  facingOrgId: string | null;
}

/**
 * Direction + facing party, resolved from the RAW (pre-wall) party ids.
 *
 * `dealDirectionFor` returns "observer" for anyone who is neither the seller
 * nor the buyer org. Since the legacy producer RLS arm was dropped
 * (migration 20260702000001) the only non-party viewer that can reach a deal
 * row is a platform admin — so an "observer" who is NOT an admin gets no
 * counterparty at all. That is stricter than deriving one from `dealKind`.
 */
export function resolveProjectParties(
  raw: DealHeaderLike,
  ctx: ProjectionContext,
): ResolvedProjectParties {
  const direction = resolveViewerDirection(raw.seller.id, raw.buyer.id, ctx.viewerOrgId, raw.dealKind);
  const facing = facingParty(raw, ctx.viewerOrgId, ctx.isPlatformAdmin);
  const counterparty = facing ? partyRef(facing, ctx) : null;
  return { direction, counterparty, facingOrgId: counterparty?.id ?? null };
}

/** The party slot the viewer faces, or null when they face none. */
export function facingParty(
  raw: DealHeaderLike,
  viewerOrgId: string | null,
  isPlatformAdmin: boolean,
): DealPartyLike | null {
  const rawDirection = dealDirectionFor(raw.seller.id, raw.buyer.id, viewerOrgId);
  if (rawDirection === "sell") return raw.buyer;
  if (rawDirection === "buy") return raw.seller;
  if (!isPlatformAdmin) return null;
  return raw.dealKind === "purchase_only" ? raw.seller : raw.buyer;
}

/** Org id of that party — the ONLY org a list row needs persona labels for. */
export function facingPartyOrgId(
  raw: DealHeaderLike,
  viewerOrgId: string | null,
  isPlatformAdmin: boolean,
): string | null {
  return facingParty(raw, viewerOrgId, isPlatformAdmin)?.id ?? null;
}

/**
 * List row. `raw` supplies only the party ids/kind used for the direction rule;
 * every value that reaches the payload comes from `walled` (post field wall).
 */
export function toProjectListItem(
  raw: DealHeaderLike,
  walled: DealHeaderLike,
  ctx: ProjectionContext,
  fileCount: number,
): ProjectListItem {
  const { direction, counterparty } = resolveProjectParties(raw, ctx);
  const item: ProjectListItem = {
    id: walled.id,
    reference: walled.dealCode ?? walled.code,
    name: walled.name,
    stage: walled.lifecycleStage,
    stageLabel: stageLabel(walled.lifecycleStage),
    direction,
    counterparty,
    deliveryDeadline: walled.deliveryDeadline,
    fileCount,
  };
  // Currency travels with the commercial terms: without `deal_terms` there are
  // no amounts to label, so the key is simply not emitted.
  if (ctx.access.domainVisible("deal_terms")) item.currency = walled.currency;
  return item;
}

/** Specification lines. Price members appear only with `deal_terms`. */
export function toProjectLines(
  walledLines: readonly DealLineLike[],
  ctx: ProjectionContext,
): ProjectLine[] {
  const seeTerms = ctx.access.domainVisible("deal_terms");
  return walledLines.map((li) => {
    const line: ProjectLine = {
      id: li.id ?? null,
      lineNo: li.lineNo,
      productName: li.productName,
      woodSpecies: li.woodSpecies,
      humidity: li.humidity,
      processing: li.processing,
      quality: li.quality,
      thickness: li.thickness,
      width: li.width,
      length: li.length,
      pieces: li.pieces,
      volumeM3: li.volumeM3,
      unit: li.unit,
    };
    if (seeTerms) {
      line.unitPriceCents = li.unitPriceCents;
      line.lineTotalCents = li.lineTotalCents;
    }
    return line;
  });
}

export interface ProjectDetailParts {
  lines: readonly DealLineLike[];
  files: readonly ProjectFileMeta[];
  fileCounts: ProjectFileCounts;
}

/**
 * Detail payload. `otherParties` is built from the WALLED embeds, so a party the
 * field wall collapsed to HIDDEN_PARTY (id === null) yields no entry — the
 * viewer cannot even tell that a hidden party exists. The viewer's own org and
 * their facing counterparty are excluded (the latter is already `counterparty`).
 */
export function toProjectDetail(
  raw: DealHeaderLike,
  walled: DealHeaderLike,
  ctx: ProjectionContext,
  parts: ProjectDetailParts,
): ProjectDetail {
  const { direction, counterparty, facingOrgId } = resolveProjectParties(raw, ctx);
  const base = toProjectListItem(raw, walled, ctx, parts.fileCounts.total);

  const seen = new Set<string>();
  const otherParties: ProjectPartyRef[] = [];
  // `projectDealView` keeps the SELLER embed unconditionally, on the grounds
  // that the seller is every counterparty's own deal partner. That reasoning
  // only holds for someone who is actually on the deal: a viewer who is party
  // to neither leg (and is not a platform admin) has no partner here, so the
  // seller goes out with everything else. Today RLS makes that case
  // unreachable — this keeps it unreachable if RLS ever widens.
  const viewerIsParty = counterparty !== null;
  const candidates: Array<[DealPartyLike, NonNullable<ProjectPartyRef["role"]>]> = [
    [walled.customer, "customer"],
    ...(viewerIsParty || ctx.isPlatformAdmin
      ? ([[walled.seller, "seller"]] as Array<[DealPartyLike, NonNullable<ProjectPartyRef["role"]>]>)
      : []),
    [walled.producer, "producer"],
    [walled.buyer, "buyer"],
  ];
  for (const [party, role] of candidates) {
    if (!party.id) continue; // hidden by the field wall, or simply unset
    if (party.id === facingOrgId) continue; // already surfaced as `counterparty`
    if (ctx.viewerOrgId && party.id === ctx.viewerOrgId) continue; // the viewer itself
    if (seen.has(party.id)) continue; // buyer mirrors customer on bilateral rows
    seen.add(party.id);
    const ref = partyRef(party, ctx, role);
    if (ref) otherParties.push(ref);
  }

  const detail: ProjectDetail = {
    ...base,
    direction,
    counterparty,
    otherParties,
    lines: toProjectLines(parts.lines, ctx),
    files: parts.files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      relativePath: f.relativePath,
      mimeType: f.mimeType,
      fileSizeBytes: f.fileSizeBytes,
      lifecycleStatus: f.lifecycleStatus,
      createdAt: f.createdAt,
    })),
    fileCounts: parts.fileCounts,
    notes: walled.notes,
  };

  if (ctx.access.domainVisible("deal_terms")) {
    detail.terms = {
      incoterms: walled.incoterms,
      incotermsPlace: walled.incotermsPlace,
      paymentTerms: walled.paymentTerms,
      deliveryTerms: walled.deliveryTerms,
      advancePct: walled.advancePct,
    };
  }

  return detail;
}
