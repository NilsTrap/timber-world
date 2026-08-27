import type { ProjectListFilterOption, ProjectListFilters, ProjectListItem, ProjectPartyRef } from "./types";

export const EMPTY_PROJECT_FILTERS: ProjectListFilters = {
  search: "", customer: "", trader: "", supplier: "", stage: "",
};

function partyHas(party: ProjectPartyRef | null, persona: "buyer" | "trader" | "supplier"): boolean {
  return Boolean(party?.personas.includes(persona));
}

export function projectFilterOptions(items: readonly ProjectListItem[]) {
  const byPersona = (persona: "buyer" | "trader" | "supplier"): ProjectListFilterOption[] => {
    const options = new Map<string, string>();
    for (const item of items) {
      for (const party of [item.buyer, item.seller]) {
        if (party?.id && partyHas(party, persona)) options.set(party.id, party.name ?? party.code ?? "Unnamed company");
      }
    }
    return [...options].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  };
  const stages = new Map<string, string>();
  for (const item of items) if (item.depth === 0 && item.stage) stages.set(item.stage, item.stageLabel);
  return {
    customers: byPersona("buyer"),
    traders: byPersona("trader"),
    suppliers: byPersona("supplier"),
    stages: [...stages].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label)),
  };
}

export function filterProjectGroups(items: readonly ProjectListItem[], filters: ProjectListFilters): ProjectListItem[] {
  const valid = projectFilterOptions(items);
  const allowed = (value: string, options: ProjectListFilterOption[]) => !value || options.some((option) => option.id === value);
  const safe = {
    search: filters.search.trim().toLocaleLowerCase(),
    customer: allowed(filters.customer, valid.customers) ? filters.customer : "",
    trader: allowed(filters.trader, valid.traders) ? filters.trader : "",
    supplier: allowed(filters.supplier, valid.suppliers) ? filters.supplier : "",
    stage: allowed(filters.stage, valid.stages) ? filters.stage : "",
  };
  const groups = new Map<string, ProjectListItem[]>();
  for (const item of items) groups.set(item.groupKey, [...(groups.get(item.groupKey) ?? []), item]);
  return [...groups.values()].flatMap((group) => {
    const parties = group.flatMap((item) => [item.buyer, item.seller]).filter((party): party is ProjectPartyRef => Boolean(party));
    const matches =
      (!safe.search || parties.some((party) => `${party.name ?? ""} ${party.code ?? ""}`.toLocaleLowerCase().includes(safe.search))) &&
      (!safe.customer || parties.some((party) => party.id === safe.customer && partyHas(party, "buyer"))) &&
      (!safe.trader || parties.some((party) => party.id === safe.trader && partyHas(party, "trader"))) &&
      (!safe.supplier || parties.some((party) => party.id === safe.supplier && partyHas(party, "supplier"))) &&
      (!safe.stage || group.some((item) => item.depth === 0 && item.stage === safe.stage));
    return matches ? group : [];
  });
}
