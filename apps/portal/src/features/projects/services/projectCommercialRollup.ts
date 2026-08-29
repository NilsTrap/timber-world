export type RollupScope = "full" | "partial";
export type MarginMode = "amount" | "percentage";

export interface RollupContribution {
  sourceOrderId: string;
  sourceCandidateId: string | null;
  originLineItemId: string;
  selectedQuantity: number;
  availableQuantity: number;
  availableAmountCents: number;
  sourceVersion: number;
  sourceUpdatedAt: string;
}

export interface RollupRequirement { originLineItemId: string; requiredQuantity: number }
export interface RollupLineResult {
  originLineItemId: string;
  offeredQuantity: number;
  purchaseCostCents: number;
  adjustmentCents: number;
  marginCents: number;
  offeredValueCents: number;
}

const MAX_CENTS = Number.MAX_SAFE_INTEGER;

function assertSafeCents(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) throw new Error(`${label} is invalid`);
  return value;
}

function largestRemainder(total: number, weights: number[]): number[] {
  assertSafeCents(total, "Allocation");
  if (weights.length === 0) return [];
  const sum = weights.reduce((value, weight) => value + weight, 0);
  if (!(sum > 0)) throw new Error("Allocation weights are empty");
  const exact = weights.map((weight) => total * weight / sum);
  const base = exact.map(Math.floor);
  let remainder = total - base.reduce((value, cents) => value + cents, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - base[index]! }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; index < remainder; index += 1) base[order[index % order.length]!.index]! += 1;
  return base;
}

export function calculateCommercialRollup(input: {
  scope: RollupScope;
  requirements: RollupRequirement[];
  contributions: RollupContribution[];
  adjustmentCents: number;
  marginMode: MarginMode;
  marginValue: number;
}): { lines: RollupLineResult[]; purchaseCostCents: number; marginAmountCents: number; salesAmountCents: number; marginPercent: number } {
  if (input.requirements.length === 0 || input.contributions.length === 0) throw new Error("Select at least one source contribution");
  const requirements = new Map(input.requirements.map((line) => [line.originLineItemId, line.requiredQuantity]));
  if (requirements.size !== input.requirements.length || [...requirements.values()].some((quantity) => !Number.isFinite(quantity) || quantity <= 0)) throw new Error("Target requirements are invalid");
  const grouped = new Map<string, { quantity: number; cost: number }>();
  const sourceLineKeys = new Set<string>();
  for (const source of input.contributions) {
    const key = `${source.sourceOrderId}:${source.originLineItemId}`;
    if (sourceLineKeys.has(key)) throw new Error("A source line was selected twice");
    sourceLineKeys.add(key);
    if (!requirements.has(source.originLineItemId) || !Number.isFinite(source.selectedQuantity) || source.selectedQuantity <= 0 || source.selectedQuantity > source.availableQuantity || source.availableQuantity <= 0) throw new Error("Selected source quantity is invalid");
    assertSafeCents(source.availableAmountCents, "Source amount");
    const cost = Math.round(source.availableAmountCents * source.selectedQuantity / source.availableQuantity);
    assertSafeCents(cost, "Scaled source amount");
    const previous = grouped.get(source.originLineItemId) ?? { quantity: 0, cost: 0 };
    const quantity = previous.quantity + source.selectedQuantity;
    const required = requirements.get(source.originLineItemId)!;
    if (quantity > required + Number.EPSILON) throw new Error(`Over-covered line ${source.originLineItemId}`);
    grouped.set(source.originLineItemId, { quantity, cost: assertSafeCents(previous.cost + cost, "Line cost") });
  }
  if (input.scope === "full") {
    for (const [lineId, required] of requirements) {
      if (Math.abs((grouped.get(lineId)?.quantity ?? 0) - required) > Number.EPSILON) throw new Error(`Missing quantity for line ${lineId}`);
    }
  }
  const selected = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
  const purchaseCostCents = assertSafeCents(selected.reduce((total, [, line]) => total + line.cost, 0), "Purchase cost");
  const adjustmentCents = assertSafeCents(input.adjustmentCents, "Additional cost");
  const baseCents = assertSafeCents(purchaseCostCents + adjustmentCents, "Adjusted cost");
  let marginAmountCents: number;
  let salesAmountCents: number;
  if (input.marginMode === "percentage") {
    if (!Number.isFinite(input.marginValue) || input.marginValue < 0 || input.marginValue >= 100) throw new Error("Margin percentage is invalid");
    salesAmountCents = assertSafeCents(Math.round(baseCents / (1 - input.marginValue / 100)), "Sales amount");
    marginAmountCents = salesAmountCents - baseCents;
  } else {
    marginAmountCents = assertSafeCents(input.marginValue, "Margin amount");
    salesAmountCents = assertSafeCents(baseCents + marginAmountCents, "Sales amount");
  }
  const costs = selected.map(([, line]) => line.cost);
  const safeWeights = costs.some((weight) => weight > 0) ? costs : selected.map(([, line]) => line.quantity);
  const adjustments = largestRemainder(adjustmentCents, safeWeights);
  const margins = largestRemainder(marginAmountCents, safeWeights);
  const lines = selected.map(([originLineItemId, line], index) => ({
    originLineItemId, offeredQuantity: line.quantity, purchaseCostCents: line.cost,
    adjustmentCents: adjustments[index]!, marginCents: margins[index]!,
    offeredValueCents: assertSafeCents(line.cost + adjustments[index]! + margins[index]!, "Offered line value"),
  }));
  if (lines.reduce((total, line) => total + line.offeredValueCents, 0) !== salesAmountCents) throw new Error("Line allocation does not match sales total");
  return { lines, purchaseCostCents, marginAmountCents, salesAmountCents,
    marginPercent: salesAmountCents === 0 ? 0 : Number((marginAmountCents / salesAmountCents * 100).toFixed(4)) };
}
