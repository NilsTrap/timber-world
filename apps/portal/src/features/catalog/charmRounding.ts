import type { RoundingRule } from "./types";

/**
 * Round a positive amount (in major currency units, e.g. pounds) UP to the next
 * "charm" price defined by an editable band config. Deterministic — no LLM.
 *
 * Bands are evaluated in order; the first whose `upTo` is null or >= amount wins.
 *  - `endings`: round up to the smallest value whose fractional part is one of
 *    the endings (e.g. [0.29, 0.49, 0.79, 0.99] turns 17.30 into 17.49).
 *  - `stepEnding {step, minus}`: round up to the next multiple of `step`, then
 *    subtract `minus` (e.g. step 10, minus 0.01 turns 117 into 119.99).
 */
export function applyCharmRounding(amount: number, rule: RoundingRule | null): number {
  if (amount <= 0 || !rule || !rule.bands?.length) return round2(amount);

  const band =
    rule.bands.find((b) => b.upTo == null || amount <= b.upTo) ??
    rule.bands[rule.bands.length - 1];
  if (!band) return round2(amount);

  if (band.stepEnding && band.stepEnding.step > 0) {
    const { step, minus } = band.stepEnding;
    const next = Math.ceil(roundEps(amount) / step) * step;
    return round2(next - minus);
  }

  if (band.endings && band.endings.length) {
    const endings = [...band.endings].sort((a, b) => a - b);
    let k = Math.floor(amount);
    // search current integer and the next few in case amount sits above all endings
    for (let i = 0; i <= 2; i++) {
      for (const e of endings) {
        const candidate = k + e;
        if (candidate >= amount - 1e-9) return round2(candidate);
      }
      k += 1;
    }
  }

  return round2(amount);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// guard against float noise like 119.99999 when an amount is already a multiple
function roundEps(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
