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

export type OpenRfqAvailability = "open" | "closed" | "unavailable";
export function openRfqAvailability(result: { data: unknown; error: unknown }): OpenRfqAvailability {
  if (result.error) return "unavailable";
  return result.data ? "open" : "closed";
}

export function canOfferSellerCompletion(input: { isDraft: boolean; sellerMissing: boolean; openRfq: OpenRfqAvailability }): boolean {
  return input.isDraft && input.sellerMissing && input.openRfq === "closed";
}

export function mapCreateRfqError(message: string): { error: string; code: string } {
  const normalized = message.replaceAll("_", " ");
  if (/deadline/i.test(normalized)) return { error: "The quotation deadline must be in the future", code: "VALIDATION_ERROR" };
  if (/candidate|eligible|self deal/i.test(normalized)) return { error: "One or more candidates are no longer eligible", code: "VALIDATION_ERROR" };
  if (/already open|placeholder|required|allocation|quantity/i.test(normalized)) return { error: "A quotation request cannot be opened for this leg", code: "CONFLICT" };
  if (/forbidden/i.test(normalized)) return { error: "Not allowed", code: "FORBIDDEN" };
  if (/not found/i.test(normalized)) return { error: "Project leg not found", code: "NOT_FOUND" };
  return { error: "Could not create quotation requests", code: "CREATE_FAILED" };
}

export function mapAwardRfqError(message: string): { error: string; code: string } {
  const normalized = message.replaceAll("_", " ");
  if (/deadline|expired/i.test(normalized)) return { error: "The quotation deadline has passed", code: "CONFLICT" };
  if (/already|status|allocation|quantity|not open|not submitted|placeholder/i.test(normalized)) return { error: "The quotation can no longer be awarded", code: "CONFLICT" };
  if (/forbidden/i.test(normalized)) return { error: "Not allowed", code: "FORBIDDEN" };
  if (/not found/i.test(normalized)) return { error: "Quotation request not found", code: "NOT_FOUND" };
  return { error: "Could not award quotation", code: "AWARD_FAILED" };
}
