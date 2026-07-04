/**
 * R3 (3rqucq) · Payment-terms → advance-% derivation.
 *
 * The deal's Payment terms is chosen from an admin-managed `payment_terms` select
 * field (Settings → Fields); the stored value is the human-readable term (also what
 * renders on generated documents). `orders.advance_pct` is DERIVED from that term
 * server-side (in updateDealTerms) so it stays authoritative and is no longer
 * hand-edited — documents keep reading `advance_pct` unchanged.
 *
 * Pure helper (NOT a server action) so it is safe to import into "use server"
 * modules without tripping the type-export trap.
 */

/** Advance % for the seeded payment-terms options that a plain %-parse can't
 *  recover (no explicit percent in the text, or a non-advance percent). */
const KNOWN_ADVANCE: Record<string, number> = {
  "100% advance": 100,
  "50% advance / 50% before dispatch": 50,
  "Payment after delivery": 0,
  "30% advance / balance before dispatch": 30,
  "Prepayment 14 days": 100,
};

/**
 * Recover the advance percentage encoded in a payment-terms value. Returns a
 * clamped 0–100 number; 0 when no advance is expressed.
 *
 * Resolution order: (1) the exact seeded option, then (2) a leading `NN%` parsed
 * from the text (covers legacy/custom free-text like "30% advance, balance before
 * dispatch"), else (3) 0.
 */
export function parseAdvanceFromPaymentTerm(value: string | null | undefined): number {
  if (!value) return 0;
  const v = value.trim();
  const known = KNOWN_ADVANCE[v];
  if (known !== undefined) return known;
  const m = v.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
  const pct = m?.[1];
  if (pct) {
    const n = Number(pct.replace(",", "."));
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
  }
  return 0;
}
