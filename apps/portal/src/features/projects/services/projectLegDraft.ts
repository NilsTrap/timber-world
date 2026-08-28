import type { SpineOriginAllocation } from "./spineOriginSpecification";

export function buildDefaultLegQuantities(allocation: SpineOriginAllocation[]): Record<string, number> {
  return reconcileLegQuantities(allocation, {});
}

export function reconcileLegQuantities(allocation: SpineOriginAllocation[], current: Record<string, number>): Record<string, number> {
  return Object.fromEntries(allocation
    .filter((line) => Number.isFinite(line.remainingQuantity) && line.remainingQuantity > 0)
    .map((line) => {
      const existing = current[line.originLineItemId];
      const quantity = existing === undefined || !Number.isFinite(existing)
        ? line.remainingQuantity
        : Math.min(Math.max(existing, 0), line.remainingQuantity);
      return [line.originLineItemId, quantity];
    }));
}

export function buildLegWorkPackages(allocation: SpineOriginAllocation[], quantities: Record<string, number>) {
  return allocation.map((line) => ({ originLineItemId: line.originLineItemId, quantity: quantities[line.originLineItemId] ?? 0, remainingQuantity: line.remainingQuantity }))
    .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0 && line.quantity <= line.remainingQuantity)
    .map(({ originLineItemId, quantity }) => ({ originLineItemId, quantity }));
}
