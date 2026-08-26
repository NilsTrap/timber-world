/**
 * Timber Projects — list loader.
 *
 * A plain server module, NOT a `"use server"` action: the Projects foundation is
 * read-only and consumed by server components, so exposing a callable action
 * endpoint would add attack surface for nothing. Every call re-runs the full
 * gate through `resolveProjectsActor()` — there is no "already checked" path.
 *
 * One visible bilateral deal = one project. RLS on the authenticated client
 * (`can_access_deal_row`) is authoritative; the additional seller/buyer filter
 * binds a multi-org viewer to their CURRENT organisation before its field wall
 * is applied. The loader never looks at a spine, sibling leg or upstream link.
 */
import { listDeals, type OrderDealSummary } from "../../orders/services/orderDeals";
import { projectDealView } from "../../orders/services/dealFields";
import { isValidUUID } from "../../orders/types";
import { resolveProjectsActor, resolveProjectsViewer } from "../access";
import { facingPartyOrgId, toProjectListItem, type ProjectionContext } from "../projection";
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

  // Persona lookup covers ONLY the orgs that actually reach the payload — the
  // viewer's own org and the counterparty of each row — never every party slot
  // of every deal. Fewer ids in the `.in(...)` and, more to the point, no flag
  // lookup for an organisation the viewer is not going to be shown.
  const [personasByOrgId, fileCounts, viewer] = await Promise.all([
    loadOrgPersonas(a.db, [
      a.orgId,
      ...raws.map((d) => facingPartyOrgId(d, a.orgId, a.isPlatformAdmin)),
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

  const committedItems = raws.map((raw) => {
    // The E4 field wall runs on every row before anything is projected; the
    // list has no line items, so an empty array stands in for them.
    const walled = projectDealView({ ...raw, lineItems: [] }, a.access, a.orgId);
    return toProjectListItem(raw, walled, ctx, fileCounts.get(raw.id)?.total ?? 0);
  });
  const invitedItems: ProjectListItem[] = invitedRows.map((row) => ({
    id: row.id,
    reference: row.reference,
    name: row.name,
    stage: row.stage,
    stageLabel: row.stage.replaceAll("_", " "),
    direction: "buy",
    counterparty: null,
    deliveryDeadline: row.deliveryDeadline,
    fileCount: 0,
    rfqInvitation: true,
  }));

  return { ok: true, items: [...committedItems, ...invitedItems], viewer };
}
