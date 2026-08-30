/**
 * Timber Projects — list loader.
 *
 * A plain server module, NOT a `"use server"` action: the Projects foundation is
 * read-only and consumed by server components, so exposing a callable action
 * endpoint would add attack surface for nothing. Every call re-runs the full
 * gate through `resolveProjectsActor()` — there is no "already checked" path.
 *
 * One visible bilateral deal = one clickable project row. RLS on the authenticated client
 * (`can_access_deal_row`) is authoritative; the additional seller/buyer filter
 * binds a multi-org viewer to their CURRENT organisation before its field wall
 * is applied. Rows are grouped only when the existing chain field wall permits it.
 */
import { listDeals, type OrderDealSummary } from "../../orders/services/orderDeals";
import { projectDealView } from "../../orders/services/dealFields";
import { isValidUUID } from "../../orders/types";
import { resolveProjectsActor, resolveProjectsViewer } from "../access";
import { toProjectListItem, type DealHeaderLike, type ProjectionContext } from "../projection";
import { groupProjectRows } from "../groupProjects";
import { loadOrgPersonas } from "../services/orgPersonas";
import { countFilesByDeal } from "../services/projectFiles";
import type { ProjectListItem, ProjectsResult, ProjectsViewer } from "../types";
import { getProjectStages } from "../../project-stages/stages";
import { createAdminClient as createTypedAdminClient } from "@/lib/supabase/admin";
import type { DbClient } from "../../orders/services/dealModel";

const createAdminClient=()=>createTypedAdminClient() as unknown as DbClient;

/** Newest-first cap. Matches the deal service's own ceiling. */
const LIST_LIMIT = 200;

export type ListProjectsResult = ProjectsResult<{
  items: ProjectListItem[];
  viewer: ProjectsViewer;
}>;

export async function listProjects(): Promise<ListProjectsResult> {
  const a = await resolveProjectsActor();
  if (!a.ok) return a;

  // Scope non-admins to the CURRENT organisation, exactly like the Orders list
  // (getOrders.ts). RLS alone would also hand back deals from the viewer's OTHER
  // memberships — and those must not be projected through this organisation's
  // field-domain grants, which is the wall we resolved above. Admins are not
  // scoped (they are a party to nothing and may see everything).
  const partyOrganisationId =
    !a.isPlatformAdmin && a.orgId && isValidUUID(a.orgId) ? a.orgId : undefined;
  if (!a.isPlatformAdmin && !partyOrganisationId) return { ok: false, deny: "not_found" };

  const res = await listDeals(a.db, a.actor, { limit: LIST_LIMIT, partyOrganisationId });
  if (!res.success) return { ok: false, deny: "not_found" };

  const committedRaws: OrderDealSummary[] = res.data;
  let invitedRows: Array<{ id: string; reference: string; name: string | null; stage: string; deliveryDeadline: string | null }> = [];
  if (!a.isPlatformAdmin && a.orgId) {
    const { data, error } = await a.db.rpc("list_project_rfq_invitations");
    // Keep the canonical project list available during a code-first rollout;
    // invitations appear as soon as the matching migration is installed.
    if (error && error.code !== "PGRST202") return { ok: false, deny: "not_found" };
    if (Array.isArray(data)) invitedRows = data.slice(0, LIST_LIMIT) as typeof invitedRows;
  }
  const committedIds = new Set(committedRaws.map((deal) => deal.id));
  invitedRows = invitedRows.filter((row) => !committedIds.has(row.id));
  const raws: OrderDealSummary[] = committedRaws;
  const visibleIds = raws.map((d) => d.id);

  const walledRows = raws.map((raw) =>
    projectDealView({ ...raw, lineItems: [] }, a.access, a.orgId) as OrderDealSummary & { lineItems: [] },
  );
  const visibleSpineIds = [...new Set(walledRows.map((row) => row.spineId).filter((id): id is string => Boolean(id)))];
  const spineCodeById = new Map<string, string>();
  const spineTitleById = new Map<string, string>();
  const originOrderBySpineId = new Map<string, string>();
  if (visibleSpineIds.length > 0) {
    const { data, error } = await a.db.from("spines").select("id, code, title, origin_order_id").in("id", visibleSpineIds);
    if (error) return { ok: false, deny: "not_found" };
    for (const row of (data ?? []) as Array<{ id: string; code: string; title: string | null; origin_order_id: string | null }>) {
      spineCodeById.set(row.id, row.code);
      if (row.title?.trim()) spineTitleById.set(row.id, row.title.trim());
      if (row.origin_order_id) originOrderBySpineId.set(row.id, row.origin_order_id);
    }
  }

  const primaryThumbnailByOrder = new Map<string, string>();
  const primaryThumbnailBySpine = new Map<string,string>();
  if(visibleSpineIds.length){const admin=createAdminClient();const{data}=await admin.from("spine_project_images").select("spine_id,order_files!inner(storage_path,lifecycle_status)").in("spine_id",visibleSpineIds).eq("position",1);for(const row of data??[]){const file=row.order_files as unknown as{storage_path:string;lifecycle_status:string};if(file.lifecycle_status!=="ready")continue;const{data:signed}=await admin.storage.from("orders").createSignedUrl(file.storage_path,60*60);if(signed?.signedUrl)primaryThumbnailBySpine.set(row.spine_id,signed.signedUrl)}}
  const thumbnailOrderIds = [...new Set([
    ...visibleIds.filter((id, index) => !walledRows[index]?.spineId),
    ...originOrderBySpineId.values(),
  ])];
  if (thumbnailOrderIds.length > 0) {
    const { data: imageRows } = await a.db.from("order_files")
      .select("order_id, storage_path, thumbnail_sort_order")
      .in("order_id", thumbnailOrderIds).eq("category", "project").eq("is_thumbnail", true)
      .eq("lifecycle_status", "ready").order("thumbnail_sort_order", { ascending: true });
    for (const row of (imageRows ?? []) as Array<{ order_id: string; storage_path: string; thumbnail_sort_order: number | null }>) {
      if (primaryThumbnailByOrder.has(row.order_id)) continue;
      const { data } = await a.db.storage.from("orders").createSignedUrl(row.storage_path, 60 * 60);
      if (data?.signedUrl) primaryThumbnailByOrder.set(row.order_id, data.signedUrl);
    }
  }

  // Load personas only for bilateral parties present on already-authorised rows.
  const [personasByOrgId, fileCounts, viewer, configuredStages] = await Promise.all([
    loadOrgPersonas(a.db, [
      a.orgId,
      ...walledRows.flatMap((deal) => [deal.buyer.id, deal.seller.id]),
    ]),
    countFilesByDeal(a.db, visibleIds),
    resolveProjectsViewer(a),
    getProjectStages(a.db),
  ]);

  const ctx: ProjectionContext = {
    access: a.access,
    viewerOrgId: a.orgId,
    isPlatformAdmin: a.isPlatformAdmin,
    personasByOrgId,
  };

  const committedItems = groupProjectRows(raws.map((raw, index) => {
    const walled = walledRows[index]!;
    const item = toProjectListItem(raw as DealHeaderLike, walled as DealHeaderLike, ctx, fileCounts.get(raw.id)?.total ?? 0);
    if (walled.spineId && spineTitleById.has(walled.spineId)) item.name = spineTitleById.get(walled.spineId)!;
    item.thumbnailUrl = primaryThumbnailByOrder.get(raw.id) ?? null;
    return {
      item,
      spineId: walled.spineId,
      spineCode: walled.spineId ? spineCodeById.get(walled.spineId) ?? null : null,
      upstreamDealId: walled.upstreamDealId,
      dealKind: walled.dealKind,
      createdAt: raw.createdAt,
      sortOrder: raw.projectSortOrder,
      spineThumbnailUrl: walled.spineId
        ? primaryThumbnailBySpine.get(walled.spineId)??primaryThumbnailByOrder.get(originOrderBySpineId.get(walled.spineId) ?? "") ?? null
        : null,
    };
  }));
  const invitedItems: ProjectListItem[] = invitedRows.map((row) => ({
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
    fileCount: 0,
    rfqInvitation: true,
  }));

  const stageByKey = new Map(configuredStages.map((stage) => [stage.key, stage]));
  const items = [...committedItems, ...invitedItems].map((item) => {
    const configured = stageByKey.get(item.stage);
    return configured ? { ...item, stageLabel: configured.label, stageColor: configured.color } : item;
  });
  return { ok: true, items, viewer };
}
