export function quoteTotalToCents(total: number): number {
  if (!Number.isFinite(total) || total < 0) throw new Error("Invalid quote total");
  return Math.round(total * 100);
}

export function canManageProjectRfq(input: { isPlatformAdmin:boolean; actorOrganisationId:string|null; ownerOrganisationId:string; lifecycleStage:string }): boolean {
  return input.lifecycleStage === "draft" && (input.isPlatformAdmin || input.actorOrganisationId === input.ownerOrganisationId);
}

export function candidateCanSee(candidateOrganisationId:string, actorOrganisationId:string|null): boolean {
  return Boolean(actorOrganisationId && candidateOrganisationId === actorOrganisationId);
}
