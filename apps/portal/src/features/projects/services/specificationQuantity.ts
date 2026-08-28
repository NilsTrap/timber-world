export type SpecificationUnit = "m3" | "m2" | "piece" | "linear_m" | "package" | "crate" | "loose_m3";

const MAX_DISCRETE_QUANTITY = 1_000_000;
const MAX_MEASURED_QUANTITY = 100_000_000;

export function validQuantityForUnit(unit: SpecificationUnit, quantity: number) {
  const discrete = ["piece", "package", "crate"].includes(unit);
  const maximum = discrete ? MAX_DISCRETE_QUANTITY : MAX_MEASURED_QUANTITY;
  return Number.isFinite(quantity) && quantity > 0 && quantity <= maximum && (!discrete || Number.isInteger(quantity));
}
