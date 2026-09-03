import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync("../../supabase/migrations/20260903211000_create_rfq_from_specification.sql","utf8");
const action=readFileSync("src/features/projects/actions/projectRfqActions.ts","utf8");
const dialog=readFileSync("src/features/projects/components/CreateProjectRfqDialog.tsx","utf8");
const loader=readFileSync("src/features/projects/actions/getProject.ts","utf8");
const editor=readFileSync("src/features/projects/components/ProjectSpecificationEditor.tsx","utf8");

// Create: all available lines start selected; one atomic RPC creates one leg and one RFQ.
assert.match(dialog,/useState\(\(\)=>composer\.availableLines\.map/);
assert.match(dialog,/candidateIds\.length>=2/);
assert.match(dialog,/lineIds\.length<=500/);
assert.match(dialog,/candidateIds\.length<=20/);
assert.match(dialog,/new Date\(deadlineTime\)\.toISOString\(\)/);
assert.match(dialog,/const \[minimumDeadline\]=useState\(earliestDeadlineValue\)/);
assert.match(dialog,/useEffect\(\(\)=>/);
assert.match(dialog,/router\.push\(`\/projects\/\$\{result\.data\.projectId\}`\)/);
assert.match(action,/rpc\("create_project_rfq_from_specification"/);
assert.match(migration,/INSERT INTO public\.orders[\s\S]*INSERT INTO public\.project_rfqs/);
assert.match(migration,/p_line_item_ids UUID\[\][\s\S]*p_candidate_ids UUID\[\][\s\S]*p_deadline TIMESTAMPTZ/);

// Empty scope: visible action is disabled and both action/RPC reject an empty selection.
assert.match(dialog,/disabled=\{composer\.availableLines\.length===0\}/);
assert.match(dialog,/At least one available specification line is required/);
assert.match(action,/lineItemIds: z\.array\(uuid\)\.min\(1\)/);
assert.match(migration,/RFQ_LINES_INVALID/);

// Existing sourcing leg: loader projects it and the action changes to Manage RFQ.
assert.match(loader,/upstream_deal_id/);
assert.match(loader,/project_rfqs/);
assert.match(loader,/existingProjectId=.*order_id/);
assert.match(dialog,/Manage RFQ/);
assert.match(migration,/SOURCING_LEG_EXISTS/);

// Stale allocation: rows and spine are locked, conflict aborts the same transaction.
assert.match(migration,/pg_advisory_xact_lock/);
assert.ok(migration.indexOf("pg_advisory_xact_lock")<migration.indexOf("FOR UPDATE"));
assert.match(migration,/ORDER BY l\.id FOR UPDATE/);
assert.match(migration,/WORK_PACKAGE_OVER_ALLOCATED/);
assert.equal((migration.match(/IF v_required-v_allocated<=0/g)??[]).length,2);
assert.match(action,/code:"CONFLICT"/);

// Authorization and eligible suppliers remain server/database enforced.
assert.match(migration,/current_user_can_create_deal_in_org/);
assert.match(migration,/is_supplier OR o\.is_producer OR o\.is_trader OR o\.is_manufacturer/);
assert.match(migration,/array_length\(p_candidate_ids,1\),0\) NOT BETWEEN 2 AND 20/);
assert.match(migration,/array_length\(p_line_item_ids,1\),0\) NOT BETWEEN 1 AND 500/);
assert.match(migration,/p_deadline IS NULL/);
assert.match(migration,/RFQ_ALLOCATION_ORIGINS_DUPLICATE/);
assert.match(loader,/const canCreateSpineLeg = a\.isPlatformAdmin/);
assert.match(loader,/!raw\.upstreamDealId/);
assert.match(loader,/a\.profile\.actions\.has\("deal:create"\)/);
assert.match(loader,/loadPartyOptions\(a\.db, a\.isPlatformAdmin, raw\.seller\.id, "seller"\)/);
assert.match(loader,/origin_line_item_id\?\?line\.id/);
assert.match(action,/actor\.profile\.actions\.has\("deal:create"\)/);
assert.match(editor,/CreateProjectRfqDialog/);

console.log("project RFQ from specification tests passed");
