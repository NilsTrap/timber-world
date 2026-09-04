import type { DbClient } from "../../../orders/services/dealModel";
import { loadAuthorizedRfqCandidateSnapshot } from "../projectRfqCandidateSnapshot";

let passed = 0;
let failed = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n expected ${JSON.stringify(expected)}\n actual ${JSON.stringify(actual)}`);
  }
}

function fakeRpcClient(projectId: string): DbClient {
  return {
    rpc: () => Promise.resolve({
      data: {
        id: projectId,
        reference: "RFQ-1",
        name: "Candidate project",
        stage: "draft",
        deliveryDeadline: null,
        currency: "EUR",
        lines: [],
      },
      error: null,
    }),
  } as unknown as DbClient;
}

function fakeAuthorizationClient(row: unknown, tables: string[], selections: string[] = []): DbClient {
  const query: Record<string, unknown> = {
    select: (selection: string) => { selections.push(selection); return query; },
    eq: () => query,
    gt: () => query,
    is: () => query,
    limit: () => query,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  };
  return {
    from: (table: string) => {
      tables.push(table);
      return query;
    },
  } as unknown as DbClient;
}

function authorization(input: {
  projectId: string;
  organisationId?: string;
  deadline?: string;
  deletedAt?: string | null;
  relationshipArrays?: boolean;
}) {
  const order = {
    id: input.projectId,
    spine_id: "spine-authorized",
    upstream_deal_id: "source-order",
    deleted_at: input.deletedAt ?? null,
  };
  const rfq = {
    order_id: input.projectId,
    status: "open",
    deadline: input.deadline ?? "2026-09-03T00:00:00Z",
    orders: input.relationshipArrays ? [order] : order,
  };
  return {
    organization_id: input.organisationId ?? "current-org",
    project_rfqs: input.relationshipArrays ? [rfq] : rfq,
  };
}

async function main() {
  const projectId = "project-1";
  const now = new Date("2026-09-02T12:00:00Z");
  const tables: string[] = [];
  const selections: string[] = [];
  const authorized = await loadAuthorizedRfqCandidateSnapshot(
    fakeRpcClient(projectId),
    fakeAuthorizationClient(authorization({ projectId, relationshipArrays: true }), tables, selections),
    projectId,
    "current-org",
    now,
  );
  eq("candidate authorization returns the spine from the current-org invitation snapshot",
    authorized?.spineId, "spine-authorized");
  eq("candidate authorization returns the upstream file source without exposing it in the project payload",
    authorized?.sourceOrderId, "source-order");
  eq("candidate authorization performs no second raw-order lookup", tables, ["project_rfq_candidates"]);
  eq("candidate authorization pins the invitation RFQ relationship",
    selections[0]?.includes("project_rfqs!project_rfq_candidates_rfq_id_fkey!inner"), true);

  const wrongCurrentOrg = await loadAuthorizedRfqCandidateSnapshot(
    fakeRpcClient(projectId),
    fakeAuthorizationClient(authorization({ projectId, organisationId: "other-membership" }), []),
    projectId,
    "current-org",
    now,
  );
  eq("an invitation for another membership cannot authorize the current organisation", wrongCurrentOrg, null);

  const deleted = await loadAuthorizedRfqCandidateSnapshot(
    fakeRpcClient(projectId),
    fakeAuthorizationClient(authorization({ projectId, deletedAt: "2026-09-02T11:00:00Z" }), []),
    projectId,
    "current-org",
    now,
  );
  eq("soft-deleted candidate orders are rejected", deleted, null);

  const expired = await loadAuthorizedRfqCandidateSnapshot(
    fakeRpcClient(projectId),
    fakeAuthorizationClient(authorization({ projectId, deadline: "2026-09-02T11:59:59Z" }), []),
    projectId,
    "current-org",
    now,
  );
  eq("expired candidate invitations are rejected", expired, null);

  eq("a missing current organisation is rejected before candidate authorization",
    await loadAuthorizedRfqCandidateSnapshot(fakeRpcClient(projectId), fakeAuthorizationClient(null, []), projectId, null, now),
    null);

  console.log(`\nprojectRfqCandidateSnapshot.test.ts: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
