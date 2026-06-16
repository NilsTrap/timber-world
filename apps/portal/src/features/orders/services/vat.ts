/**
 * VAT rule resolution — Nils's confirmed rules (route-based; per-goods-group is a
 * later refinement). Country codes are ISO-3166 alpha-2. Salvaged from the deals
 * build, now canonical on orders.
 */
export interface VatRule {
  rate: number;
  reference: string | null;
  rule: "domestic_reverse_charge" | "domestic_standard" | "intra_eu" | "export" | "unknown";
}

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);
const DOMESTIC_STANDARD_RATE: Record<string, number> = { GB: 20, LV: 21 };

function norm(cc: string | null | undefined): string {
  return (cc ?? "").trim().toUpperCase();
}
export function isEuCountry(cc: string | null | undefined): boolean {
  return EU_COUNTRIES.has(norm(cc));
}

export function resolveVat({ fromCountry, toCountry }: { fromCountry: string | null | undefined; toCountry: string | null | undefined }): VatRule {
  const from = norm(fromCountry);
  const to = norm(toCountry);
  if (!from || !to) return { rate: 0, reference: null, rule: "unknown" };

  if (from === to) {
    if (from === "LV") {
      return {
        rate: 0,
        reference: "Reverse charge — domestic timber supply (Latvian VAT Act, special arrangement). VAT accounted for by the recipient.",
        rule: "domestic_reverse_charge",
      };
    }
    const rate = DOMESTIC_STANDARD_RATE[from];
    if (rate != null) return { rate, reference: null, rule: "domestic_standard" };
    return { rate: 0, reference: null, rule: "unknown" };
  }

  const fromEu = isEuCountry(from);
  const toEu = isEuCountry(to);
  if (fromEu && toEu) {
    return { rate: 0, reference: "Intra-Community supply, Art. 138 of Directive 2006/112/EC — 0% VAT.", rule: "intra_eu" };
  }
  return { rate: 0, reference: "Export of goods, Art. 146 of Directive 2006/112/EC — 0% VAT.", rule: "export" };
}
