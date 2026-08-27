import type { ProjectListItem } from "./types";

export interface ProjectGroupingCandidate {
  item: ProjectListItem;
  spineId: string | null;
  spineCode: string | null;
  upstreamDealId: string | null;
  dealKind: string;
}

/** Order already-authorised rows into presentation-only spine groups. */
export function groupProjectRows(candidates: readonly ProjectGroupingCandidate[]): ProjectListItem[] {
  const groups = new Map<string, ProjectGroupingCandidate[]>();
  for (const candidate of candidates) {
    const key = candidate.spineId ? `spine:${candidate.spineId}` : `deal:${candidate.item.id}`;
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  const output: ProjectListItem[] = [];
  for (const [groupKey, group] of groups) {
    const ids = new Set(group.map((candidate) => candidate.item.id));
    const parent =
      group.find((candidate) => candidate.dealKind !== "purchase_only" && !candidate.upstreamDealId) ??
      group.find((candidate) => candidate.dealKind !== "purchase_only") ??
      group.find((candidate) => !candidate.upstreamDealId || !ids.has(candidate.upstreamDealId)) ??
      group[0];
    if (!parent) continue;

    const ordered: ProjectGroupingCandidate[] = [];
    const visited = new Set<string>();
    const childrenOf = (id: string) => group
      .filter((candidate) => candidate.upstreamDealId === id)
      .sort((a, b) => a.item.reference.localeCompare(b.item.reference));
    const visit = (candidate: ProjectGroupingCandidate) => {
      if (visited.has(candidate.item.id)) return;
      visited.add(candidate.item.id);
      ordered.push(candidate);
      childrenOf(candidate.item.id).forEach(visit);
    };
    visit(parent);
    group.filter((candidate) => !visited.has(candidate.item.id))
      .sort((a, b) => a.item.reference.localeCompare(b.item.reference))
      .forEach(visit);

    const spineCode = parent.spineCode ?? parent.item.reference;
    ordered.forEach((candidate, index) => {
      output.push({
        ...candidate.item,
        spineCode,
        groupKey,
        depth: index === 0 ? 0 : 1,
        stage: index === 0 ? candidate.item.stage : "",
        stageLabel: index === 0 ? candidate.item.stageLabel : "",
        deliveryDeadline: index === 0 ? candidate.item.deliveryDeadline : null,
      });
    });
  }
  return output;
}
