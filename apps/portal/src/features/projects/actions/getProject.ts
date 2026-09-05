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
import { loadSpineOriginAllocation } from "../services/spineOriginSpecification";
import { canOfferSellerCompletion, openRfqAvailability } from "../services/projectRfq";
import { purchaseLegAllowsBuyerEdit, toEligiblePartyOption, type PartyOptionRow } from "../services/projectPartyOptions";
import type { ProjectDetail, ProjectLegOption, ProjectPartyOption, ProjectPartyRef, ProjectPartyWorkspace, ProjectsResult, ProjectsViewer } from "../types";
import { projectLegReference } from "../services/projectLegReference";
import { loadSpineProjectImages, projectOfficialImageCapabilities } from "../services/projectOfficialImages";
import { loadAuthorizedRfqCandidateSnapshot } from "../services/projectRfqCandidateSnapshot";
import type { DealLineComponentLike, DealProcessRequirementLike } from "../projection";
import { getProjectStageConfiguration, type ProjectStageConfiguration } from "../../project-stages/stages";
import { createAdminClient as createTypedAdminClient } from "@/lib/supabase/admin";

const createAdminClient=()=>createTypedAdminClient() as unknown as DbClient;

export type GetProjectResult = ProjectsResult<{
  project: ProjectDetail;
  viewer: ProjectsViewer;
  partyWorkspace: ProjectPartyWorkspace;
  canEditSpecification: boolean;
  canViewOfficialImages: boolean;
  canManageOfficialImages: boolean;
  canRemoveOfficialImages: boolean;
  isRfqCandidate: boolean;
  stageConfiguration: ProjectStageConfiguration;
  stageUpdatedAt: string | null;
}>;

export async function getProject(projectId: string): Promise<GetProjectResult> {
  const a = await resolveProjectsActor();
  if (!a.ok) return a;
  if (!isValidUUID(projectId)) return { ok: false, deny: "not_found" };

  const res = await getOrderDeal(a.db, a.actor, projectId);
  const actorIsDirectParty = res.success && isPartyOrg(res.data, a.orgId);
  if (!a.isPlatformAdmin && !actorIsDirectParty) {
    const candidateAdmin = createAdminClient();
    const candidate = await loadRfqCandidateProject(a.db, candidateAdmin, projectId, a.orgId);
    if (candidate) {
      const [files, viewer, officialImages] = await Promise.all([
        listProjectFiles(a.db, projectId, false, candidate.sourceOrderId),
        resolveProjectsViewer(a),
        candidate.spineId
          ? loadSpineProjectImages(candidateAdmin, candidate.spineId)
          : Promise.resolve([]),
      ]);
      const imageCapabilities = await projectOfficialImageCapabilities(a.db, {
        spineId: candidate.spineId,
        isPlatformAdmin: false,
        viewerOrganisationId: a.orgId,
        buyerOrganisationId: null,
        sellerOrganisationId: null,
        hasDealCreate: false,
        isRfqCandidate: true,
      });
      const stageConfiguration = await getProjectStageConfiguration(a.db, candidate.project.stage, viewer);
      candidate.project.stageLabel = stageConfiguration.current?.label ?? candidate.project.stageLabel;
      return {
        ok: true,
        project: {
          ...candidate.project,
          files,
          officialImages,
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
        canViewOfficialImages: imageCapabilities.canView,
        canManageOfficialImages: imageCapabilities.canManage,
        canRemoveOfficialImages: imageCapabilities.canRemove,
        isRfqCandidate: true,
        stageConfiguration: { current: stageConfiguration.current, selectable: [] },
        stageUpdatedAt: null,
      };
    }
  }

  if (!res.success) return { ok: false, deny: "not_found" };

  const raw = res.data;
  // Same-organisation check as the list: a non-admin may only open a deal their
  // CURRENT organisation is a party to. Without it, a multi-org user could open
  // a deal reachable through another membership while this organisation's field
  // wall — possibly a wider one — is what gets applied. Denial is the shared
  // not_found, so it is still indistinguishable from an unknown id.
  if (!a.isPlatformAdmin && !isPartyOrg(raw, a.orgId)) return { ok: false, deny: "not_found" };

  const walled = projectDealView(res.data, a.access, a.orgId);

  const [personasByOrgId, files, folders, fileCounts, viewer, lineComponents, processRequirements, spineLookup, officialImages] = await Promise.all([
    loadOrgPersonas(a.db, [a.orgId, raw.seller.id, raw.buyer.id, raw.customer.id, raw.producer.id]),
    listProjectFiles(a.db, projectId, a.isPlatformAdmin || raw.seller.id === a.orgId),
    listProjectFolders(a.db, projectId),
    countFilesByDeal(a.db, [projectId]),
    resolveProjectsViewer(a),
    a.access.domainVisible("deal_terms")
      ? loadLineComponents(a.db, raw.lineItems.map((line) => line.id).filter((id): id is string => Boolean(id)))
      : Promise.resolve([]),
    loadProcessRequirements(a.db, (walled.lineItems ?? []).map((line) => line.id).filter((id): id is string => Boolean(id))),
    walled.spineId
      ? a.db.from("spines").select("code,title,created_by,origin_order_id").eq("id", walled.spineId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    raw.spineId
      ? loadSpineProjectImages(createAdminClient(), raw.spineId)
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
    processRequirements,
    files,
    folders,
    fileCounts: fileCounts.get(projectId) ?? { total: 0 },
  });
  project.officialImages=officialImages;
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
    const spine = spineLookup.data as { title?: string | null; created_by?: string | null } | null;
    if (spine?.title?.trim()) project.name = spine.title.trim();
    project.canEditSpineTitle = Boolean(a.isPlatformAdmin || (a.portalUserId && spine?.created_by === a.portalUserId));
    project.spineTitleToken = spine?.title ?? null;
  }

  const buyer = partyRef(raw.buyer, personasByOrgId);
  const seller = partyRef(raw.seller, personasByOrgId);
  const sourceAdmin = createAdminClient();
  const { data: sourceParties, error: sourcePartiesError } = raw.buyer.id && raw.seller.id
    ? await sourceAdmin.from("organisations").select("id,is_active,is_customer,is_trader").in("id", [raw.buyer.id, raw.seller.id])
    : { data: [], error: null };
  if (sourcePartiesError) throw new Error("Could not verify project parties");
  const partyRows=(sourceParties??[]) as Array<{id:string;is_active:boolean;is_customer:boolean;is_trader:boolean}>;
  const eligibleBuyer=partyRows.some((row)=>row.id===raw.buyer.id&&row.is_active&&(row.is_customer||row.is_trader));
  const eligibleTraderSeller=partyRows.some((row)=>row.id===raw.seller.id&&row.is_active&&row.is_trader);
  const isDraft = raw.lifecycleStage === "draft";
  const openRfqQuery = isDraft
    ? await a.db.from("project_rfqs").select("id").eq("order_id", projectId).eq("status", "open").limit(1).maybeSingle()
    : { data: null, error: null };
  const openRfqState = openRfqAvailability(openRfqQuery);
  const canEditSpecification = canEditProjectSpecification({
    isPlatformAdmin: a.isPlatformAdmin,
    actorOrganisationId: a.orgId,
    sellerOrganisationId: raw.seller.id,
    sellerIsActiveTrader: eligibleTraderSeller,
    lifecycleStage: raw.lifecycleStage,
    dealKind: raw.dealKind,
  });
  const imageCapabilities = await projectOfficialImageCapabilities(a.db, {
    spineId: raw.spineId,
    isPlatformAdmin: a.isPlatformAdmin,
    viewerOrganisationId: a.orgId,
    buyerOrganisationId: raw.buyer.id,
    sellerOrganisationId: raw.seller.id,
    hasDealCreate: a.profile.actions.has("deal:create"),
  });
  const canViewOfficialImages = imageCapabilities.canView;
  const canManageOfficialImages = imageCapabilities.canManage;
  const canRemoveOfficialImages = imageCapabilities.canRemove;
  const canEditBuyer = isDraft && purchaseLegAllowsBuyerEdit({ isPlatformAdmin: a.isPlatformAdmin, dealKind: raw.dealKind, buyerMissing: !buyer })
    && (a.isPlatformAdmin || (raw.seller.id === a.orgId && viewer.canCreateProject && viewer.createRoles.includes("trader")))
    && (a.isPlatformAdmin || a.access.domainVisible("customer_identity"));
  const buyerOptions = canEditBuyer ? await loadPartyOptions(a.db, a.isPlatformAdmin, raw.seller.id, "buyer") : [];
  const mayCompleteSeller = canOfferSellerCompletion({ isDraft, sellerMissing: !seller, openRfq: openRfqState });
  const sellerOptions = a.isPlatformAdmin && isDraft && openRfqState === "closed" && (seller || mayCompleteSeller)
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
  const legOptions = raw.spineId
    ? await loadProjectLegOptions(a.db, raw.spineId, projectId)
    : [];
  const hasDealCreate = a.isPlatformAdmin || a.profile.actions.has("deal:create");
  const traderOwnsSource = Boolean(!a.isPlatformAdmin && isDraft && raw.spineId && !raw.upstreamDealId
    && raw.seller.id === a.orgId && viewer.personas.includes("trader") && hasDealCreate && eligibleBuyer && eligibleTraderSeller);
  const canCreateSpineLeg = a.isPlatformAdmin;
  const [createBuyerOptions, createSellerOptions, allocationResult] = (canCreateSpineLeg || traderOwnsSource) && isDraft && raw.spineId
    ? await Promise.all([
      a.isPlatformAdmin ? loadPartyOptions(a.db, true, null, "buyer") : Promise.resolve(seller ? [{ id: seller.id, code: seller.code ?? "TRD", name: seller.name ?? "Trader", group: "buyers" as const }] : []),
      a.isPlatformAdmin ? loadPartyOptions(a.db, true, null, "seller") : Promise.resolve([]),
      loadSpineOriginAllocation(a.db, projectId),
    ])
    : [[], [], { ok: false as const, error: "unavailable" as const }];
  const originAllocation = allocationResult.ok ? allocationResult.data : undefined;
  const canStartSpecificationRfq = Boolean(isDraft && raw.spineId && !raw.upstreamDealId && raw.buyer.id && raw.seller.id
    && hasDealCreate && eligibleBuyer && eligibleTraderSeller && (a.isPlatformAdmin || traderOwnsSource));
  let specificationRfq: ProjectPartyWorkspace["specificationRfq"];
  if (canStartSpecificationRfq) {
    const [{ data: children, error: childrenError }, candidateOptions, { data: sourceLines, error: sourceLinesError }] = await Promise.all([
      a.db.from("orders").select("id").eq("upstream_deal_id", projectId).is("deleted_at", null).neq("lifecycle_stage", "cancelled").order("created_at").limit(2),
      loadPartyOptions(a.db, a.isPlatformAdmin, raw.seller.id, "seller"),
      a.db.from("order_line_items").select("id,origin_line_item_id,line_no,product_name,unit").eq("order_id",projectId).eq("side","sell").order("line_no"),
    ]);
    if(childrenError||sourceLinesError)throw new Error("Could not load RFQ creation state");
    const childIds=((children??[]) as Array<{id:string}>).map((row)=>row.id);
    let existingProjectId:string|null=null;
    if(childIds.length){
      const{data:rfqs,error:rfqsError}=await a.db.from("project_rfqs").select("order_id").in("order_id",childIds).limit(1);
      if(rfqsError)throw new Error("Could not verify the sourcing RFQ");
      existingProjectId=((rfqs??[]) as Array<{order_id:string}>)[0]?.order_id??null;
    }
    const allocationByOrigin=new Map((originAllocation??[]).map((line)=>[line.originLineItemId,line]));
    specificationRfq = {
      existingProjectId,
      availableLines: ((sourceLines??[]) as Array<{id:string;origin_line_item_id:string|null;line_no:number;product_name:string|null;unit:string}>).flatMap((line)=>{
        const allocation=allocationByOrigin.get(line.origin_line_item_id??line.id);
        return allocation&&allocation.remainingQuantity>0?[{id:line.id,lineNo:line.line_no,productName:line.product_name??allocation.productName,quantity:allocation.remainingQuantity,unit:line.unit}]:[];
      }),
      candidates: candidateOptions.map((option)=>({id:option.id,name:option.name})),
    };
  }
  const partyWorkspace: ProjectPartyWorkspace = {
    buyerProjectId: canEditBuyer ? projectId : null,
    buyer,
    seller,
    ...(legOptions.length > 1 ? { legOptions } : {}),
    buyerOptions,
    sellerOptions,
    nextSellerOptions,
    canEditBuyer: buyerOptions.length > 0,
    canEditSeller: sellerOptions.length > 0 && (!!seller || mayCompleteSeller),
    canAppendNextSeller: nextSellerOptions.length > 0,
    canCreateSpineLeg: canCreateSpineLeg && isDraft && !!raw.spineId,
    createBuyerOptions,
    createSellerOptions,
    originAllocation,
    openRfqState,
    ...(specificationRfq ? { specificationRfq } : {}),
  };
  const stageConfiguration = await getProjectStageConfiguration(a.db, raw.lifecycleStage, viewer);
  project.stageLabel = stageConfiguration.current?.label ?? project.stageLabel;

  return { ok: true, project, viewer, partyWorkspace, canEditSpecification, canViewOfficialImages, canManageOfficialImages, canRemoveOfficialImages, isRfqCandidate: false, stageConfiguration, stageUpdatedAt: raw.updatedAt };
}

function normalizeCandidateLines(lines: unknown[]): ProjectDetail["lines"] {
  return lines.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const line = value as Record<string, unknown>;
    const requirements = Array.isArray(line.processRequirements) ? line.processRequirements : [];
    return [{
      ...line,
      processRequirements: requirements.flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
        const requirement = candidate as Record<string, unknown>;
        if (![requirement.id, requirement.fieldKey, requirement.name, requirement.value].every((item) => typeof item === "string")) return [];
        return [{
          id: requirement.id as string,
          fieldKey: requirement.fieldKey as string,
          name: requirement.name as string,
          value: requirement.value as string,
          unit: typeof requirement.unit === "string" ? requirement.unit : null,
          fieldType: "number" as const,
          required: requirement.required === true,
          active: requirement.active === true,
        }];
      }),
      basicProperties: Array.isArray(line.basicProperties) ? line.basicProperties.flatMap((candidate)=>{
        if(!candidate||typeof candidate!=="object"||Array.isArray(candidate))return[];const field=candidate as Record<string,unknown>;
        const type=field.type??"text";
        return typeof field.key==="string"&&typeof field.label==="string"&&typeof field.value==="string"&&
          (type==="select"||type==="number"||type==="text"||type==="boolean"||type==="file")?[{
            key:field.key,label:field.label,type,unit:typeof field.unit==="string"?field.unit:null,
            value:field.value,sortOrder:typeof field.sortOrder==="number"?field.sortOrder:0,required:field.required===true,
            allowedOptions:Array.isArray(field.allowedOptions)?field.allowedOptions.filter((option):option is string=>typeof option==="string"):[],
          }]:[];
      }) : [],
    } as ProjectDetail["lines"][number]];
  });
}

async function loadRfqCandidateProject(
  db: DbClient,
  admin: DbClient,
  projectId: string,
  actorOrganisationId: string | null,
): Promise<{
  project: Omit<ProjectDetail, "files" | "folders" | "fileCount" | "fileCounts">;
  spineId: string | null;
  sourceOrderId: string;
} | null> {
  const authorized = await loadAuthorizedRfqCandidateSnapshot(db, admin, projectId, actorOrganisationId);
  if (!authorized) return null;
  const row = authorized.snapshot;
  const project: Omit<ProjectDetail, "files" | "folders" | "fileCount" | "fileCounts"> = {
    id: row.id,
    reference: row.reference,
    name: row.name,
    spineCode: row.reference,
    groupKey: `rfq:${row.id}`,
    rowKind: "leg",
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
    lines: normalizeCandidateLines(row.lines),
    officialImages: [],
    notes: null,
  };
  return { project, spineId: authorized.spineId, sourceOrderId: authorized.sourceOrderId };
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

async function loadProcessRequirements(db: DbClient, lineIds: string[]): Promise<DealProcessRequirementLike[]> {
  if (lineIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let offset = 0; offset < lineIds.length; offset += 200) chunks.push(lineIds.slice(offset, offset + 200));
  const responses = await Promise.all(chunks.map((p_line_ids) => db.rpc("get_project_process_requirements", { p_line_ids })));
  if (responses.some(({ error }) => error)) throw new Error("Could not load process requirements");
  return responses.flatMap(({ data }) => (data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    orderLineItemId: row.request_line_id as string,
    fieldKey: row.field_key as string,
    name: row.name as string,
    value: row.value as string,
    unit: row.unit as string | null,
    fieldType: "number" as const,
    required: row.is_required === true,
    active: row.is_active === true,
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
  if (!centerOrgId && side === "center") return [];
  let ids: string[] | null = null;
  if (!admin) {
    const { data, error } = await db.from("organisation_trading_partners").select("partner_organisation_id").eq("organisation_id", centerOrgId as string);
    if(error)throw new Error("Could not load eligible project parties");
    ids = ((data ?? []) as { partner_organisation_id: string }[]).map((row) => row.partner_organisation_id);
    if (ids.length === 0) return [];
  }
  let query = db.from("organisations").select("id, code, name, is_customer, is_trader, is_supplier, is_producer, is_manufacturer").eq("is_active", true).order("name");
  if (ids) query = query.in("id", ids);
  const { data, error } = await query;
  if (error) throw new Error("Could not load eligible project parties");
  const optionSide = side === "center" ? "seller" : side;
  return ((data ?? []) as PartyOptionRow[])
    .filter((row) => row.id !== centerOrgId && (side !== "center" || row.is_trader))
    .map((row) => toEligiblePartyOption(row, optionSide))
    .filter((row): row is ProjectPartyOption => row !== null);
}

async function loadProjectLegOptions(db: DbClient, spineId: string, currentProjectId: string): Promise<ProjectLegOption[]> {
  const { data, error } = await db.from("orders").select(`
      id, deal_code, code, created_at, lifecycle_stage,
      buyer:organisations!orders_buyer_organisation_id_fkey(code),
      seller:organisations!orders_seller_organisation_id_fkey(code)
    `)
    .eq("spine_id", spineId).is("deleted_at", null).order("created_at", { ascending: true });
  if (error) throw new Error("Could not load project legs");
  return ((data ?? []) as unknown as Array<{
    id: string; deal_code: string | null; code: string; created_at: string; lifecycle_stage: string;
    buyer: { code: string | null } | null; seller: { code: string | null } | null;
  }>)
    .filter((leg) => leg.lifecycle_stage !== "cancelled" || leg.id === currentProjectId)
    .map((leg) => {
      const storedReference = leg.deal_code ?? leg.code;
      return { id: leg.id, reference: projectLegReference(storedReference, leg.buyer?.code ?? null, leg.seller?.code ?? null) };
    });
}

async function hasActiveNextLeg(db: DbClient, spineId: string, buyerOrganisationId: string | null): Promise<boolean> {
  if (!buyerOrganisationId) return true;
  const { data, error } = await db.from("orders").select("id")
    .eq("spine_id", spineId).eq("buyer_organisation_id", buyerOrganisationId)
    .is("deleted_at", null).neq("lifecycle_stage", "cancelled").limit(1);
  if (error) throw new Error("Could not verify the next project leg");
  return (data ?? []).length > 0;
}
