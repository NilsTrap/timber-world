export type SpecificationComponentType = "material" | "process" | "service";

export function moneyToCents(value: number): number {
  return Math.round(value * 100);
}

export function calculateLineTotalCents(quantity: number, unitPrice: number): number {
  return moneyToCents(quantity * unitPrice);
}

export function calculateComponentTotalCents(quantity: number, unitCost: number): number {
  return moneyToCents(quantity * unitCost);
}

export function isRootProjectSpecificationLeg(input: {
  dealKind: string;
}): boolean {
  return input.dealKind === "buy_sell" || input.dealKind === "sale_only";
}

export function isProjectSpecificationEditableStage(lifecycleStage: string): boolean {
  return lifecycleStage === "draft" || lifecycleStage === "specification";
}

export function canEditProjectSpecification(input: {
  isPlatformAdmin: boolean;
  actorOrganisationId: string | null;
  sellerOrganisationId: string | null;
  sellerIsActiveTrader: boolean;
  lifecycleStage: string;
  dealKind: string;
}): boolean {
  if (!isProjectSpecificationEditableStage(input.lifecycleStage)) return false;
  if (!isRootProjectSpecificationLeg(input)) return false;
  if (input.isPlatformAdmin) return true;
  return Boolean(
    input.actorOrganisationId &&
    input.actorOrganisationId === input.sellerOrganisationId &&
    input.sellerIsActiveTrader,
  );
}

export function projectSpecificationEditDenialCode(
  input: Parameters<typeof canEditProjectSpecification>[0],
): "FORBIDDEN" | "NOT_DRAFT" | null {
  if (canEditProjectSpecification(input)) return null;
  return isRootProjectSpecificationLeg(input) && !isProjectSpecificationEditableStage(input.lifecycleStage)
    ? "NOT_DRAFT"
    : "FORBIDDEN";
}
