import type { DbClient } from "../../orders/services/dealModel";

export type RfqCandidateProjectSnapshot = {
  id: string;
  reference: string;
  name: string | null;
  stage: string;
  deliveryDeadline: string | null;
  currency: string;
  lines: unknown[];
};

type CandidateOrderAuthorizationRow = {
  id: string;
  spine_id: string | null;
  deleted_at: string | null;
};

type CandidateRfqAuthorizationRow = {
  order_id: string;
  status: string;
  deadline: string;
  orders: CandidateOrderAuthorizationRow | CandidateOrderAuthorizationRow[] | null;
};

type CandidateAuthorizationRow = {
  organization_id: string;
  project_rfqs: CandidateRfqAuthorizationRow | CandidateRfqAuthorizationRow[] | null;
};

function firstRelation<T>(relation: T | T[] | null): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation;
}

export async function loadAuthorizedRfqCandidateSnapshot(
  db: DbClient,
  admin: DbClient,
  projectId: string,
  actorOrganisationId: string | null,
  now = new Date(),
): Promise<{ snapshot: RfqCandidateProjectSnapshot; spineId: string | null } | null> {
  if (!actorOrganisationId) return null;

  // Keep the authenticated SECURITY DEFINER function as the first visibility
  // wall. It returns project-safe fields only and does not serialize spine data.
  const { data, error } = await db.rpc("get_project_rfq_candidate_snapshot", { p_order_id: projectId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const snapshot = data as unknown as RfqCandidateProjectSnapshot;
  if (snapshot.id !== projectId || !Array.isArray(snapshot.lines)) return null;

  // Rebind the invitation to the actor's current organisation and capture the
  // spine in this same authorization snapshot. There is deliberately no later
  // service-role order lookup that could observe a changed spine.
  const { data: authorizationData, error: authorizationError } = await admin
    .from("project_rfq_candidates")
    .select("organization_id,project_rfqs!inner(order_id,status,deadline,orders!inner(id,spine_id,deleted_at))")
    .eq("organization_id", actorOrganisationId)
    .eq("project_rfqs.order_id", projectId)
    .eq("project_rfqs.status", "open")
    .gt("project_rfqs.deadline", now.toISOString())
    .is("project_rfqs.orders.deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (authorizationError || !authorizationData) return null;

  const authorization = authorizationData as CandidateAuthorizationRow;
  const rfq = firstRelation(authorization.project_rfqs);
  const order = rfq ? firstRelation(rfq.orders) : null;
  if (
    authorization.organization_id !== actorOrganisationId
    || !rfq
    || rfq.order_id !== projectId
    || rfq.status !== "open"
    || !Number.isFinite(Date.parse(rfq.deadline))
    || Date.parse(rfq.deadline) <= now.getTime()
    || !order
    || order.id !== projectId
    || order.deleted_at !== null
  ) return null;

  return { snapshot, spineId: order.spine_id };
}
