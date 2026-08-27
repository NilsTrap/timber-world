/**
 * Timber Projects — detail loader.
 *
 * Same gate as the list, then the deal is fetched on the AUTHENTICATED client:
 * an id the viewer may not access returns exactly the same `not_found` as an id
 * that does not exist and as a malformed id. There is deliberately no branch on
 * the underlying error code and nothing is logged that would separate the
 * cases — a direct URL must not be an existence oracle.
 */
import { getOrderDeal } from "../../orders/services/orderDeals";
import { projectDealView } from "../../orders/services/dealFields";
import type { DbClient } from "../../orders/services/dealModel";
import { isValidUUID } from "../../orders/types";
import { resolveProjectsActor, resolveProjectsViewer } from "../access";
import { isPartyOrg, resolveProjectSpineLabel, toProjectDetail, type ProjectionContext } from "../projection";
import { loadOrgPersonas } from "../services/orgPersonas";
import { countFilesByDeal, listProjectFiles, listProjectFolders } from "../services/projectFiles";
import { canEditProjectSpecification } from "../services/projectSpecification";
import type { ProjectDetail, ProjectLegOption, ProjectPartyOption, ProjectPartyRef, ProjectPartyWorkspace, ProjectsResult, ProjectsViewer } from "../types";
import type { DealLineComponentLike } from "../projection";

export type GetProjectResult = ProjectsResult<{
  project: ProjectDetail;
  viewer: ProjectsViewer;
  partyWorkspace: ProjectPartyWorkspace;
  canEditSpecification: boolean;
  isRfqCandidate: boolean;
}>;

export async function getProject(projectId: string): Promise<GetProjectResult> {
  const a = await resolveProjectsActor();
  if (!a.ok) return a;
  if (!isValidUUID(projectId)) return { ok: false, deny: "not_found" };

  if (!a.isPlatformAdmin) {
    const candidateProject = await loadRfqCandidateProject(a.db, projectId);
    if (candidateProject) {
      const [files, viewer] = await Promise.all([
        listProjectFiles(a.db, projectId, false),
        resolveProjectsViewer(a),
      ]);
      return {
        ok: true,
        project: {
          ...candidateProject,
          files,
          folders: [],
          fileCount: files.length,
          fileCounts: { total: files.length },
        },
        viewer: {
          ...viewer,
          canCreateProject: false,
          canWriteFiles: false,
          canEditTerms: false,
          createRoles: [],
        },
        partyWorkspace: emptyPartyWorkspace(),
        canEditSpecification: false,
        isRfqCandidate: true,
      };
    }
  }

  const res = await getOrderDeal(a.db, a.actor, projectId);
  if (!res.success) return { ok: false, deny: "not_found" };

  const raw = res.data;
  // Same-organisation check as the list: a non-admin may only open a deal their
  // CURRENT organisation is a party to. Without it, a multi-org user could open
  // a deal reachable through another membership while this organisation's field
  // wall — possibly a wider one — is what gets applied. Denial is the shared
  // not_found, so it is still indistinguishable from an unknown id.
  if (!a.isPlatformAdmin && !isPartyOrg(raw, a.orgId)) return { ok: false, deny: "not_found" };

  const walled = projectDealView(res.data, a.access, a.orgId);

  const [personasByOrgId, files, folders, fileCounts, viewer, lineComponents, spineLookup] = await Promise.all([
    loadOrgPersonas(a.db, [a.orgId, raw.seller.id, raw.buyer.id, raw.customer.id, raw.producer.id]),
    listProjectFiles(a.db, projectId, a.isPlatformAdmin || raw.seller.id === a.orgId),
    listProjectFolders(a.db, projectId),
    countFilesByDeal(a.db, [projectId]),
    resolveProjectsViewer(a),
    a.access.domainVisible("deal_terms")
      ? loadLineComponents(a.db, raw.lineItems.map((line) => line.id).filter((id): id is string => Boolean(id)))
      : Promise.resolve([]),
    walled.spineId
      ? a.db.from("spines").select("code").eq("id", walled.spineId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const ctx: ProjectionContext = {
    access: a.access,
    viewerOrgId: a.orgId,
    isPlatformAdmin: a.isPlatformAdmin,
    personasByOrgId,
  };

  const project = toProjectDetail(raw, walled, ctx, {
    lines: walled.lineItems ?? [],
    lineComponents,
    files,
    folders,
    fileCounts: fileCounts.get(projectId) ?? { total: 0 },
  });
  // Chain identity is resolved only after the field wall has retained spineId.
  // Platform admins still get a stable fallback on unlinked legacy deals.
  if (!spineLookup.error) {
    const label = resolveProjectSpineLabel(
      walled.spineId,
      (spineLookup.data as { code?: string } | null)?.code ?? null,
      project.reference,
      a.isPlatformAdmin,
    );
    if (label) project.displaySpineCode = label;
  }

  const buyer = partyRef(raw.buyer, personasByOrgId);
  const seller = partyRef(raw.seller, personasByOrgId);
  const isDraft = raw.lifecycleStage === "draft";
  const canEditSpecification = canEditProjectSpecification({
    isPlatformAdmin: a.isPlatformAdmin,
    actorOrganisationId: a.orgId,
    sellerOrganisationId: raw.seller.id,
    dealTermsEditable: a.access.domainEditable("deal_terms"),
    lifecycleStage: raw.lifecycleStage,
    dealKind: raw.dealKind,
  });
  const canEditBuyer = isDraft && raw.dealKind !== "purchase_only"
    && (a.isPlatformAdmin || (raw.seller.id === a.orgId && viewer.canCreateProject && viewer.createRoles.includes("trader")))
    && (a.isPlatformAdmin || a.access.domainVisible("customer_identity"));
  const buyerOptions = canEditBuyer ? await loadPartyOptions(a.db, a.isPlatformAdmin, raw.seller.id, "buyer") : [];
  const sellerOptions = a.isPlatformAdmin && isDraft
    ? await loadPartyOptions(a.db, true, raw.buyer.id, "seller")
    : [];
  const mayAppendNextSeller = !a.isPlatformAdmin && isDraft
    && raw.seller.id === a.orgId
    && viewer.canCreateProject
    && viewer.createRoles.includes("trader")
    && a.access.domainVisible("supplier_identity");
  const hasNextLeg = mayAppendNextSeller && raw.spineId
    ? await hasActiveNextLeg(a.db, raw.spineId, raw.seller.id)
    : false;
  const nextSellerOptions = mayAppendNextSeller && !hasNextLeg
    ? await loadPartyOptions(a.db, false, raw.seller.id, "seller")
    : [];
  const legOptions = a.isPlatformAdmin && raw.spineId
    ? await loadProjectLegOptions(a.db, raw.spineId, projectId)
    : [];
  const partyWorkspace: ProjectPartyWorkspace = {
    buyerProjectId: canEditBuyer ? projectId : null,
    buyer,
    seller,
    ...(legOptions.length > 1 ? { legOptions } : {}),
    buyerOptions,
    sellerOptions,
    nextSellerOptions,
    canEditBuyer: buyerOptions.length > 0,
    canEditSeller: sellerOptions.length > 0 && !!seller,
    canAppendNextSeller: nextSellerOptions.length > 0,
  };

  return { ok: true, project, viewer, partyWorkspace, canEditSpecification, isRfqCandidate: false };
}

type CandidateSnapshot = {
  id: string;
  reference: string;
  name: string | null;
  stage: string;
  deliveryDeadline: string | null;
  currency: string;
  lines: ProjectDetail["lines"];
};

async function loadRfqCandidateProject(db: DbClient, projectId: string): Promise<Omit<ProjectDetail, "files" | "folders" | "fileCount" | "fileCounts"> | null> {
  const { data, error } = await db.rpc("get_project_rfq_candidate_snapshot", { p_order_id: projectId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as unknown as CandidateSnapshot;
  if (row.id !== projectId || !Array.isArray(row.lines)) return null;
  return {
    id: row.id,
    reference: row.reference,
    name: row.name,
    spineCode: row.reference,
    groupKey: `rfq:${row.id}`,
    depth: 0,
    stage: row.stage,
    stageLabel: row.stage.replaceAll("_", " "),
    direction: "buy",
    counterparty: null,
    buyer: null,
    seller: null,
    deliveryDeadline: row.deliveryDeadline,
    currency: row.currency,
    rfqInvitation: true,
    otherParties: [],
    lines: row.lines,
    notes: null,
  };
}

function emptyPartyWorkspace(): ProjectPartyWorkspace {
  return {
    buyerProjectId: null,
    buyer: null,
    seller: null,
    buyerOptions: [],
    sellerOptions: [],
    nextSellerOptions: [],
    canEditBuyer: false,
    canEditSeller: false,
    canAppendNextSeller: false,
  };
}

async function loadLineComponents(db: DbClient, lineIds: string[]): Promise<DealLineComponentLike[]> {
  if (lineIds.length === 0) return [];
  const { data, error } = await db.from("order_line_item_components")
    .select("id, order_line_item_id, component_type, name, quantity, unit, unit_cost, total_cost_cents, sort_order")
    .in("order_line_item_id", lineIds)
    .order("sort_order");
  if (error) throw new Error("Could not load specification cost components");
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    orderLineItemId: row.order_line_item_id as string,
    type: row.component_type as DealLineComponentLike["type"],
    name: row.name as string,
    quantity: Number(row.quantity),
    unit: row.unit as string,
    unitCost: Number(row.unit_cost),
    totalCostCents: Number(row.total_cost_cents),
  }));
}

function partyRef(row: { id: string | null; code: string | null; name: string | null }, personas: ReadonlyMap<string, ProjectPartyRef["personas"]>): ProjectPartyRef | null {
  if (!row.id) return null;
  return { id: row.id, code: row.code, name: row.name, personas: personas.get(row.id) ?? [] };
}

async function loadPartyOptions(
  db: DbClient,
  admin: boolean,
  centerOrgId: string | null,
  side: "buyer" | "seller" | "center",
): Promise<ProjectPartyOption[]> {
  if (!centerOrgId && side !== "center") return [];
  let ids: string[] | null = null;
  if (!admin) {
    const { data } = await db.from("organisation_trading_partners").select("partner_organisation_id").eq("organisation_id", centerOrgId as string);
    ids = ((data ?? []) as { partner_organisation_id: string }[]).map((row) => row.partner_organisation_id);
    if (ids.length === 0) return [];
  }
  let query = db.from("organisations").select("id, code, name, is_customer, is_trader, is_supplier, is_producer").eq("is_active", true).order("name");
  if (ids) query = query.in("id", ids);
  const { data, error } = await query;
  if (error) throw new Error("Could not load eligible project parties");
  return ((data ?? []) as Array<ProjectPartyOption & { is_customer: boolean; is_trader: boolean; is_supplier: boolean; is_producer: boolean }>)
    .filter((row) => row.id !== centerOrgId && (side === "buyer" ? row.is_customer : side === "center" ? row.is_trader : row.is_trader || row.is_supplier || row.is_producer))
    .map(({ id, code, name, is_trader }) => ({ id, code, name, group: side === "buyer" ? "buyers" : is_trader ? "traders" : "suppliers" }));
}

async function loadProjectLegOptions(db: DbClient, spineId: string, currentProjectId: string): Promise<ProjectLegOption[]> {
  const { data, error } = await db.from("orders").select("id, deal_code, code, created_at, lifecycle_stage")
    .eq("spine_id", spineId).order("created_at", { ascending: true });
  if (error) throw new Error("Could not load project legs");
  return ((data ?? []) as Array<{ id: string; deal_code: string | null; code: string; created_at: string; lifecycle_stage: string }>)
    .filter((leg) => leg.lifecycle_stage !== "cancelled" || leg.id === currentProjectId)
    .map((leg) => ({ id: leg.id, reference: leg.deal_code ?? leg.code }));
}

async function hasActiveNextLeg(db: DbClient, spineId: string, buyerOrganisationId: string | null): Promise<boolean> {
  if (!buyerOrganisationId) return true;
  const { data, error } = await db.from("orders").select("id")
    .eq("spine_id", spineId).eq("buyer_organisation_id", buyerOrganisationId)
    .neq("lifecycle_stage", "cancelled").limit(1);
  if (error) throw new Error("Could not verify the next project leg");
  return (data ?? []).length > 0;
}
