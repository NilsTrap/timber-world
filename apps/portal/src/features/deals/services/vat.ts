/**
 * VAT rule resolution — Nils's confirmed rules (2026-06-13).
 *
 * "boards LV→LV: no VAT with a special reference; UK→UK: with VAT; LV→UK: no VAT,
 *  outside-EU reference; LV→SE: no VAT, intra-EU reference."
 *
 * MVP is route-based (origin/destination country). Per-goods-group nuance is a
 * later refinement (each goods group has its own legal codes). Country codes are
 * ISO-3166 alpha-2 (LV, GB, SE, EE, ...).
 */

export interface VatRule {
  /** VAT percentage, e.g. 0 or 20. */
  rate: number;
  /** Legal reference text to print on the invoice, or null for plain standard VAT. */
  reference: string | null;
  /** Machine label for the rule branch. */
  rule:
    | "domestic_reverse_charge"
    | "domestic_standard"
    | "intra_eu"
    | "export"
    | "unknown";
}

/** EU member states (alpha-2). GB is intentionally NOT included (post-Brexit). */
const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

/** Standard domestic VAT rates we know (extend per goods group later). */
const DOMESTIC_STANDARD_RATE: Record<string, number> = {
  GB: 20,
  LV: 21,
};

function norm(cc: string | null | undefined): string {
  return (cc ?? "").trim().toUpperCase();
}

export function isEuCountry(cc: string | null | undefined): boolean {
  return EU_COUNTRIES.has(norm(cc));
}

export interface ResolveVatParams {
  fromCountry: string | null | undefined;
  toCountry: string | null | undefined;
}

export function resolveVat({ fromCountry, toCountry }: ResolveVatParams): VatRule {
  const from = norm(fromCountry);
  const to = norm(toCountry);

  if (!from || !to) {
    return { rate: 0, reference: null, rule: "unknown" };
  }

  // Domestic (same country)
  if (from === to) {
    if (from === "LV") {
      // Latvia applies a domestic reverse charge for timber.
      return {
        rate: 0,
        reference:
          "Reverse charge — domestic timber supply (Latvian VAT Act, special arrangement). VAT accounted for by the recipient.",
        rule: "domestic_reverse_charge",
      };
    }
    const rate = DOMESTIC_STANDARD_RATE[from];
    if (rate != null) {
      return { rate, reference: null, rule: "domestic_standard" };
    }
    return { rate: 0, reference: null, rule: "unknown" };
  }

  // Cross-border
  const fromEu = isEuCountry(from);
  const toEu = isEuCountry(to);

  if (fromEu && toEu) {
    return {
      rate: 0,
      reference: "Intra-Community supply, Art. 138 of Directive 2006/112/EC — 0% VAT.",
      rule: "intra_eu",
    };
  }

  // At least one side outside the EU → export.
  return {
    rate: 0,
    reference: "Export of goods, Art. 146 of Directive 2006/112/EC — 0% VAT.",
    rule: "export",
  };
}
