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

export function canEditProjectSpecification(input: {
  isPlatformAdmin: boolean;
  actorOrganisationId: string | null;
  sellerOrganisationId: string | null;
  dealTermsEditable: boolean;
  lifecycleStage: string;
}): boolean {
  if (input.lifecycleStage !== "draft") return false;
  if (input.isPlatformAdmin) return true;
  return Boolean(
    input.actorOrganisationId &&
    input.actorOrganisationId === input.sellerOrganisationId &&
    input.dealTermsEditable,
  );
}
