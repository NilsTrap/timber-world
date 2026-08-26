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
import { isPartyOrg, toProjectDetail, type ProjectionContext } from "../projection";
import { loadOrgPersonas } from "../services/orgPersonas";
import { countFilesByDeal, listProjectFiles, listProjectFolders } from "../services/projectFiles";
import type { ProjectDetail, ProjectPartyOption, ProjectPartyRef, ProjectPartyWorkspace, ProjectsResult, ProjectsViewer } from "../types";

export type GetProjectResult = ProjectsResult<{
  project: ProjectDetail;
  viewer: ProjectsViewer;
  partyWorkspace: ProjectPartyWorkspace;
}>;

export async function getProject(projectId: string): Promise<GetProjectResult> {
  const a = await resolveProjectsActor();
  if (!a.ok) return a;
  if (!isValidUUID(projectId)) return { ok: false, deny: "not_found" };

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

  const [personasByOrgId, files, folders, fileCounts, viewer] = await Promise.all([
    loadOrgPersonas(a.db, [a.orgId, raw.seller.id, raw.buyer.id, raw.customer.id, raw.producer.id]),
    listProjectFiles(a.db, projectId),
    listProjectFolders(a.db, projectId),
    countFilesByDeal(a.db, [projectId]),
    resolveProjectsViewer(a),
  ]);

  const ctx: ProjectionContext = {
    access: a.access,
    viewerOrgId: a.orgId,
    isPlatformAdmin: a.isPlatformAdmin,
    personasByOrgId,
  };

  const project = toProjectDetail(raw, walled, ctx, {
    lines: walled.lineItems ?? [],
    files,
    folders,
    fileCounts: fileCounts.get(projectId) ?? { total: 0 },
  });

  const centerRaw = project.direction === "buy" ? raw.buyer : raw.seller;
  const buyerRaw = project.direction === "buy" ? null : raw.buyer;
  const center = partyRef(centerRaw, personasByOrgId);
  const buyer = buyerRaw ? partyRef(buyerRaw, personasByOrgId) : null;
  const ownsCenter = a.isPlatformAdmin || (!!a.orgId && centerRaw.id === a.orgId);
  const canManageChain = ownsCenter && viewer.canCreateProject && (a.isPlatformAdmin || viewer.createRoles.includes("trader"));
  const canSeeCustomers = a.isPlatformAdmin || a.access.domainVisible("customer_identity");
  const canSeeSuppliers = a.isPlatformAdmin || a.access.domainVisible("supplier_identity");

  let seller: (ProjectPartyRef & { projectId?: string }) | null = project.direction === "buy"
    ? partyRef(raw.seller, personasByOrgId)
    : null;
  const spineId = (raw as typeof raw & { spineId?: string | null }).spineId ?? null;
  if (project.direction === "sell" && spineId && centerRaw.id && canSeeSuppliers) {
    const { data: leg } = await a.db
      .from("orders")
      .select("id, seller_organisation_id")
      .eq("spine_id", spineId)
      .eq("buyer_organisation_id", centerRaw.id)
      .neq("id", projectId)
      .neq("lifecycle_stage", "cancelled")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const sellerId = (leg as { seller_organisation_id?: string | null } | null)?.seller_organisation_id ?? null;
    if (sellerId) {
      const { data: sellerOrg } = await a.db.from("organisations").select("id, code, name").eq("id", sellerId).maybeSingle();
      if (sellerOrg) seller = { ...(partyRef(sellerOrg, personasByOrgId) as ProjectPartyRef), projectId: (leg as { id: string }).id };
    }
  }

  const buyerOptions = canManageChain && canSeeCustomers && buyerRaw !== null && !buyerRaw.id && raw.lifecycleStage === "draft"
    ? await loadPartyOptions(a.db, a.isPlatformAdmin, centerRaw.id, "buyer")
    : [];
  const sellerOptions = canManageChain && canSeeSuppliers && !seller
    ? await loadPartyOptions(a.db, a.isPlatformAdmin, centerRaw.id, "seller")
    : [];
  const partyWorkspace: ProjectPartyWorkspace = {
    center,
    buyer,
    seller,
    buyerOptions,
    sellerOptions,
    canSetBuyer: buyerOptions.length > 0,
    canSetSeller: sellerOptions.length > 0,
  };

  return { ok: true, project, viewer, partyWorkspace };
}

function partyRef(row: { id: string | null; code: string | null; name: string | null }, personas: ReadonlyMap<string, ProjectPartyRef["personas"]>): ProjectPartyRef | null {
  if (!row.id) return null;
  return { id: row.id, code: row.code, name: row.name, personas: personas.get(row.id) ?? [] };
}

async function loadPartyOptions(
  db: DbClient,
  admin: boolean,
  centerOrgId: string | null,
  side: "buyer" | "seller",
): Promise<ProjectPartyOption[]> {
  if (!centerOrgId) return [];
  let ids: string[] | null = null;
  if (!admin) {
    const { data } = await db.from("organisation_trading_partners").select("partner_organisation_id").eq("organisation_id", centerOrgId);
    ids = ((data ?? []) as { partner_organisation_id: string }[]).map((row) => row.partner_organisation_id);
    if (ids.length === 0) return [];
  }
  let query = db.from("organisations").select("id, code, name, is_customer, is_trader, is_supplier, is_producer").eq("is_active", true).order("name");
  if (ids) query = query.in("id", ids);
  const { data } = await query;
  return ((data ?? []) as Array<ProjectPartyOption & { is_customer: boolean; is_trader: boolean; is_supplier: boolean; is_producer: boolean }>)
    .filter((row) => row.id !== centerOrgId && (side === "buyer" ? row.is_customer : row.is_trader || row.is_supplier || row.is_producer))
    .map(({ id, code, name }) => ({ id, code, name }));
}
