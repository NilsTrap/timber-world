import { groupProjectRows, type ProjectGroupingCandidate } from "../groupProjects";
import { filterProjectGroups, projectFilterOptions } from "../projectListFilters";
import type { ProjectListItem, ProjectPartyRef } from "../types";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else { failed++; console.error(`✗ ${label}\n expected ${JSON.stringify(expected)}\n actual ${JSON.stringify(actual)}`); }
}

const buyer: ProjectPartyRef = { id: "buyer", code: "BUY", name: "Buyer Ltd", personas: ["buyer"] };
const trader: ProjectPartyRef = { id: "trader", code: "TRD", name: "Trader Ltd", personas: ["trader"] };
const trader2: ProjectPartyRef = { id: "trader-2", code: "TR2", name: "Second Trader", personas: ["trader"] };
const supplier: ProjectPartyRef = { id: "supplier", code: "SUP", name: "Metal Works", personas: ["supplier"] };

function item(id: string, seller: ProjectPartyRef, buyerParty: ProjectPartyRef): ProjectListItem {
  return {
    id, rowKind: "leg", reference: id.toUpperCase(), name: "Stairs", spineCode: id.toUpperCase(), groupKey: id, depth: 0,
    stage: "confirmed", stageLabel: "Confirmed", direction: "sell", counterparty: buyerParty,
    buyer: buyerParty, seller, deliveryDeadline: "2026-09-01", fileCount: 2, currency: "EUR", valueCents: 10000,
  };
}

const candidates: ProjectGroupingCandidate[] = [
  { item: item("leg-2", trader2, trader), spineId: "spine", spineCode: "SP-007", upstreamDealId: "leg-1", dealKind: "purchase_only" },
  { item: item("leg-3", supplier, trader2), spineId: "spine", spineCode: "SP-007", upstreamDealId: "leg-2", dealKind: "purchase_only" },
  { item: item("leg-1", trader, buyer), spineId: "spine", spineCode: "SP-007", upstreamDealId: null, dealKind: "buy_sell" },
];
const grouped = groupProjectRows(candidates);
eq("adds a separate spine row before every deal", grouped.map((row) => [row.rowKind, row.id]), [["spine", "leg-1"], ["leg", "leg-1"], ["leg", "leg-2"], ["leg", "leg-3"]]);
eq("indents the original and downstream deals", grouped.map((row) => row.depth), [0, 1, 1, 1]);
eq("uses the persisted spine code", grouped.map((row) => row.spineCode), ["SP-007", "SP-007", "SP-007", "SP-007"]);
eq("keeps stage and delivery on the spine only", grouped.map((row) => [row.stage, row.deliveryDeadline]), [["confirmed", "2026-09-01"], ["", null], ["", null], ["", null]]);
eq("keeps per-leg values off the spine row", grouped.map((row) => row.valueCents), [null, 10000, 10000, 10000]);

const options = projectFilterOptions(grouped);
eq("customer options use buyer personas", options.customers.map((option) => option.label), ["Buyer Ltd"]);
eq("traders include both chain traders", options.traders.map((option) => option.label), ["Second Trader", "Trader Ltd"]);
eq("supplier options use supplier personas", options.suppliers.map((option) => option.label), ["Metal Works"]);
eq("counterparty search retains the full spine", filterProjectGroups(grouped, { search: "metal", customer: "", trader: "", supplier: "", stage: "" }).length, 4);
eq("combined filters use AND semantics", filterProjectGroups(grouped, { search: "", customer: "buyer", trader: "trader-2", supplier: "supplier", stage: "confirmed" }).length, 4);
eq("stale customer values are ignored safely", filterProjectGroups(grouped, { search: "", customer: "missing", trader: "", supplier: "", stage: "" }).length, 4);
eq("stale stage values are ignored safely", filterProjectGroups(grouped, { search: "", customer: "", trader: "trader", supplier: "supplier", stage: "draft" }).length, 4);

const branch = groupProjectRows([
  candidates[2]!, candidates[0]!,
  { ...candidates[1]!, item: item("leg-4", supplier, trader), upstreamDealId: "leg-1" },
]);
eq("orders sibling branches deterministically", branch.map((row) => [row.rowKind, row.id]), [["spine", "leg-1"], ["leg", "leg-1"], ["leg", "leg-2"], ["leg", "leg-4"]]);

const manuallyOrdered = groupProjectRows(candidates.map((candidate, index) => ({
  ...candidate,
  createdAt: `2026-08-0${index + 1}T00:00:00Z`,
  sortOrder: candidate.item.id === "leg-3" ? 1 : candidate.item.id === "leg-1" ? 2 : 3,
})));
eq("persisted order overrides creation order", manuallyOrdered.filter((row) => row.rowKind === "leg").map((row) => row.id), ["leg-3", "leg-1", "leg-2"]);

console.log(`\nprojects-list-grouping.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
