/**
 * Timber Projects — list loader.
 *
 * A plain server module, NOT a `"use server"` action: the Projects foundation is
 * read-only and consumed by server components, so exposing a callable action
 * endpoint would add attack surface for nothing. Every call re-runs the full
 * gate through `resolveProjectsActor()` — there is no "already checked" path.
 *
 * One visible bilateral deal = one project. Visibility is decided ONLY by RLS
 * on the authenticated client (`can_access_deal_row`); this code adds no
 * org/party filter of its own (re-deriving visibility in app code is how the
 * two walls drift apart) and never looks at a spine, a sibling leg or an
 * upstream pointer.
 */
import { listDeals, type OrderDealSummary } from "../../orders/services/orderDeals";
import { projectDealView } from "../../orders/services/dealFields";
import { resolveProjectsActor, resolveProjectsViewer } from "../access";
import { toProjectListItem, type ProjectionContext } from "../projection";
import { loadOrgPersonas } from "../services/orgPersonas";
import { countFilesByDeal } from "../services/projectFiles";
import type { ProjectListItem, ProjectsResult, ProjectsViewer } from "../types";

/** Newest-first cap. Matches the deal service's own ceiling. */
const LIST_LIMIT = 200;

export type ListProjectsResult = ProjectsResult<{
  items: ProjectListItem[];
  viewer: ProjectsViewer;
}>;

export async function listProjects(): Promise<ListProjectsResult> {
  const a = await resolveProjectsActor();
  if (!a.ok) return a;

  const res = await listDeals(a.db, a.actor, { limit: LIST_LIMIT });
  if (!res.success) return { ok: false, deny: "not_found" };

  const raws: OrderDealSummary[] = res.data;
  const visibleIds = raws.map((d) => d.id);

  // Persona lookup covers only orgs already present in the payload (the parties
  // of visible deals) plus the viewer's own org — all RLS-filtered.
  const [personasByOrgId, fileCounts, viewer] = await Promise.all([
    loadOrgPersonas(a.db, [
      a.orgId,
      ...raws.flatMap((d) => [d.seller.id, d.buyer.id, d.customer.id, d.producer.id]),
    ]),
    countFilesByDeal(a.db, visibleIds),
    resolveProjectsViewer(a),
  ]);

  const ctx: ProjectionContext = {
    access: a.access,
    viewerOrgId: a.orgId,
    isPlatformAdmin: a.isPlatformAdmin,
    personasByOrgId,
  };

  const items = raws.map((raw) => {
    // The E4 field wall runs on every row before anything is projected; the
    // list has no line items, so an empty array stands in for them.
    const walled = projectDealView({ ...raw, lineItems: [] }, a.access, a.orgId);
    return toProjectListItem(raw, walled, ctx, fileCounts.get(raw.id)?.total ?? 0);
  });

  return { ok: true, items, viewer };
}
