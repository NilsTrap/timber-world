/**
 * Timber Projects — detail loader.
 *
 * Same gate as the list, then the deal is fetched on the AUTHENTICATED client:
 * an id the viewer may not access returns exactly the same `not_found` as an id
 * that does not exist and as a malformed id. There is deliberately no branch on
 * the underlying error code and nothing is logged that would separate the
 * cases — a direct URL must not be an existence oracle.
 */
import { getOrderDeal, type OrderDealView } from "../../orders/services/orderDeals";
import { createAdminClient } from "@/lib/supabase/admin";
import { projectDealView } from "../../orders/services/dealFields";
import type { DbClient } from "../../orders/services/dealModel";
import { isValidUUID } from "../../orders/types";
import { resolveProjectsActor, resolveProjectsViewer } from "../access";
import { isPartyOrg, toProjectDetail, type ProjectionContext } from "../projection";
import { loadOrgPersonas } from "../services/orgPersonas";
import { countFilesByDeal, listProjectFiles, listProjectFolders } from "../services/projectFiles";
import type { ProjectChainParty, ProjectDetail, ProjectPartyOption, ProjectPartyRef, ProjectPartyWorkspace, ProjectsResult, ProjectsViewer } from "../types";
import type { DealLineComponentLike } from "../projection";

export type GetProjectResult = ProjectsResult<{
  project: ProjectDetail;
  viewer: ProjectsViewer;
  partyWorkspace: ProjectPartyWorkspace;
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

  // A platform admin may land on a protected purchase leg from the chain UI.
  // Resolve the unique same-spine root sell leg without ever
  // broadening the projection for ordinary bilateral viewers.
  const isAdminPurchaseLeg = a.isPlatformAdmin && raw.dealKind === "purchase_only";
  const buyerProject = isAdminPurchaseLeg
    ? await resolveRootSellingProject(a.db, a.actor, raw)
    : null;

  const walled = projectDealView(res.data, a.access, a.orgId);

  const [personasByOrgId, files, folders, fileCounts, viewer, lineComponents] = await Promise.all([
    loadOrgPersonas(a.db, [a.orgId, raw.seller.id, raw.buyer.id, raw.customer.id, raw.producer.id, buyerProject?.seller.id, buyerProject?.buyer.id]),
    listProjectFiles(a.db, projectId, a.isPlatformAdmin || raw.seller.id === a.orgId),
    listProjectFolders(a.db, projectId),
    countFilesByDeal(a.db, [projectId]),
    resolveProjectsViewer(a),
    a.access.domainVisible("deal_terms")
      ? loadLineComponents(a.db, raw.lineItems.map((line) => line.id).filter((id): id is string => Boolean(id)))
      : Promise.resolve([]),
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

  const buyerSource = buyerProject ?? raw;
  const adminPartyRootAvailable = !isAdminPurchaseLeg || buyerProject !== null;
  const centerRaw = a.isPlatformAdmin ? (adminPartyRootAvailable ? buyerSource.seller : raw.buyer) : project.direction === "buy" ? raw.buyer : raw.seller;
  const buyerRaw = a.isPlatformAdmin ? (adminPartyRootAvailable ? buyerSource.buyer : null) : project.direction === "buy" ? null : raw.buyer;
  const center = partyRef(centerRaw, personasByOrgId);
  const buyer = buyerRaw ? partyRef(buyerRaw, personasByOrgId) : null;
  const ownsCenter = a.isPlatformAdmin || (!!a.orgId && centerRaw.id === a.orgId);
  const canManageChain = adminPartyRootAvailable && ownsCenter && viewer.canCreateProject && (a.isPlatformAdmin || viewer.createRoles.includes("trader"));
  const canSeeCustomers = a.isPlatformAdmin || a.access.domainVisible("customer_identity");
  const canSeeSuppliers = a.isPlatformAdmin
    || a.access.domainVisible("supplier_identity")
    || (viewer.canCreateProject && viewer.createRoles.includes("trader"));

  let seller: (ProjectPartyRef & { projectId?: string }) | null = project.direction === "buy"
    ? partyRef(raw.seller, personasByOrgId)
    : null;
  let downstreamParties: ProjectChainParty[] | undefined;
  const chainOrigin = a.isPlatformAdmin ? buyerSource : raw;
  const spineId = chainOrigin.spineId;
  const chainIsSellView = a.isPlatformAdmin ? adminPartyRootAvailable && chainOrigin.dealKind !== "purchase_only" : project.direction === "sell";
  if (chainIsSellView && spineId && centerRaw.id && canSeeSuppliers) {
    // The query remains constrained to this spine and, for ordinary traders,
    // to the represented company's adjacent buying leg.
    const chainDb = createAdminClient();
    const chain = await loadDownstreamChain(chainDb, spineId, chainOrigin.id, centerRaw.id, a.isPlatformAdmin);
    if (chain.length > 0) {
      const orgIds = chain.map((leg) => leg.sellerOrganisationId);
      // The application permission above is the identity wall. Some legacy
      // organisation RLS profiles are narrower than the trader capability, so
      // load only the already-authorised chain identities with the admin client.
      const [{ data: orgRows }, chainPersonas] = await Promise.all([
        chainDb.from("organisations").select("id, code, name, is_trader, is_supplier, is_producer").in("id", orgIds),
        loadOrgPersonas(chainDb, orgIds),
      ]);
      const orgById = new Map(((orgRows ?? []) as ChainOrgRow[]).map((row) => [row.id, row]));
      const projected = chain.flatMap((leg): ProjectChainParty[] => {
        const org = orgById.get(leg.sellerOrganisationId);
        if (!org) return [];
        const ref = partyRef(org, chainPersonas);
        return ref ? [{ ...ref, projectId: leg.id, group: org.is_trader ? "traders" : "suppliers" }] : [];
      });
      seller = projected[0] ?? null;
      // Ordinary users see only their bilateral adjacent leg. Full-spine chain is
      // serialized solely for platform admins, whose RLS policy already grants it.
      if (a.isPlatformAdmin) downstreamParties = projected;
    }
  }

  const isDraft = buyerSource.lifecycleStage === "draft";
  const buyerOptions = canManageChain && canSeeCustomers && buyerRaw !== null && isDraft
    ? await loadPartyOptions(a.db, a.isPlatformAdmin, centerRaw.id, "buyer")
    : [];
  const projectedChain = downstreamParties ?? (seller ? [{ ...seller, group: seller.personas.includes("trader") ? "traders" as const : "suppliers" as const, projectId: seller.projectId ?? projectId }] : []);
  const tradersInChain = 1 + projectedChain.filter((party) => party.group === "traders").length;
  const terminalParty = projectedChain.at(-1) ?? null;
  const mayAppend = canManageChain && canSeeSuppliers && (!terminalParty || (a.isPlatformAdmin && terminalParty.group === "traders" && tradersInChain <= 2));
  const appendFromOrgId = terminalParty?.id ?? centerRaw.id;
  let sellerOptions = mayAppend
    ? await loadPartyOptions(a.db, a.isPlatformAdmin, appendFromOrgId, "seller")
    : [];
  // Buyer + at most two traders + final supplier. After Trader 2, only a
  // manufacturer/supplier may be appended.
  if (tradersInChain >= 2) sellerOptions = sellerOptions.filter((option) => option.group === "suppliers");
  const centerOptions = a.isPlatformAdmin && isDraft && chainIsSellView
    ? await loadPartyOptions(a.db, true, null, "center")
    : [];
  const partyWorkspace: ProjectPartyWorkspace = {
    buyerProjectId: adminPartyRootAvailable ? buyerSource.id : null,
    chainProjectId: adminPartyRootAvailable ? chainOrigin.id : null,
    center,
    buyer,
    seller,
    ...(downstreamParties ? { downstreamParties } : {}),
    buyerOptions,
    sellerOptions,
    centerOptions,
    canSetBuyer: buyerOptions.length > 0 && !buyer,
    canSetSeller: sellerOptions.length > 0,
    canEditBuyer: buyerOptions.length > 0 && !!buyer,
    canEditCenter: centerOptions.length > 0,
  };

  return { ok: true, project, viewer, partyWorkspace, isRfqCandidate: false };
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
    stage: row.stage,
    stageLabel: row.stage.replaceAll("_", " "),
    direction: "buy",
    counterparty: null,
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
    chainProjectId: null,
    center: null,
    buyer: null,
    seller: null,
    buyerOptions: [],
    sellerOptions: [],
    centerOptions: [],
    canSetBuyer: false,
    canSetSeller: false,
    canEditBuyer: false,
    canEditCenter: false,
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

async function resolveRootSellingProject(
  db: DbClient,
  actor: Parameters<typeof getOrderDeal>[1],
  purchaseLeg: OrderDealView,
): Promise<OrderDealView | null> {
  if (!purchaseLeg.spineId) return null;
  const { data, error } = await db.from("orders").select("id")
    .eq("spine_id", purchaseLeg.spineId).neq("deal_kind", "purchase_only")
    .neq("lifecycle_stage", "cancelled").limit(2);
  const candidates = (data ?? []) as Array<{ id: string }>;
  if (error || candidates.length !== 1) return null;
  const root = await getOrderDeal(db, actor, candidates[0]!.id);
  if (!root.success || root.data.spineId !== purchaseLeg.spineId || root.data.dealKind === "purchase_only") return null;
  return root.data;
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

interface ChainLegRow { id: string; buyer_organisation_id: string; seller_organisation_id: string; created_at: string }
interface ChainOrgRow { id: string; code: string | null; name: string | null; is_trader: boolean; is_supplier: boolean; is_producer: boolean }

async function loadDownstreamChain(db: DbClient, spineId: string, originId: string, centerOrgId: string, fullSpine: boolean): Promise<Array<{ id: string; sellerOrganisationId: string }>> {
  let query = db.from("orders").select("id, buyer_organisation_id, seller_organisation_id, created_at")
    .eq("spine_id", spineId).neq("id", originId).neq("lifecycle_stage", "cancelled").order("created_at", { ascending: true });
  if (!fullSpine) query = query.eq("buyer_organisation_id", centerOrgId);
  const { data, error } = await query;
  if (error) throw new Error("Could not load the project chain");
  const remaining = [...((data ?? []) as ChainLegRow[])];
  const chain: Array<{ id: string; sellerOrganisationId: string }> = [];
  let buyerId = centerOrgId;
  while (chain.length < 2) {
    const matches = remaining.filter((leg) => leg.buyer_organisation_id === buyerId);
    if (matches.length > 1) return [];
    const index = matches[0] ? remaining.indexOf(matches[0]) : -1;
    if (index < 0) break;
    const [leg] = remaining.splice(index, 1);
    if (!leg?.seller_organisation_id || leg.seller_organisation_id === buyerId) break;
    chain.push({ id: leg.id, sellerOrganisationId: leg.seller_organisation_id });
    buyerId = leg.seller_organisation_id;
  }
  if (remaining.some((leg) => leg.buyer_organisation_id === buyerId)) return [];
  return chain;
}
