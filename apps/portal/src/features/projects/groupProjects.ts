import type { ProjectListItem } from "./types";

export interface ProjectGroupingCandidate {
  item: ProjectListItem;
  spineId: string | null;
  spineCode: string | null;
  upstreamDealId: string | null;
  dealKind: string;
  createdAt?: string;
  sortOrder?: number | null;
  spineThumbnailUrl?: string | null;
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

    const byOrder = (a: ProjectGroupingCandidate, b: ProjectGroupingCandidate) =>
      (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
      || (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
      || a.item.reference.localeCompare(b.item.reference);
    const ordered = [...group].sort(byOrder);

    const spineCode = parent.spineCode ?? parent.item.reference;
    if (parent.spineId) {
      output.push({
        ...parent.item,
        spineId: parent.spineId,
        rowKind: "spine",
        spineCode,
        groupKey,
        depth: 0,
        buyer: null,
        seller: null,
        counterparty: null,
        fileCount: 0,
        valueCents: null,
        thumbnailUrl: parent.spineThumbnailUrl ?? parent.item.thumbnailUrl ?? null,
      });
    }
    ordered.forEach((candidate) => {
      output.push({
        ...candidate.item,
        rowKind: "leg",
        spineCode,
        groupKey,
        depth: parent.spineId ? 1 : 0,
        stage: parent.spineId ? "" : candidate.item.stage,
        stageLabel: parent.spineId ? "" : candidate.item.stageLabel,
        deliveryDeadline: parent.spineId ? null : candidate.item.deliveryDeadline,
      });
    });
  }
  return output;
}
