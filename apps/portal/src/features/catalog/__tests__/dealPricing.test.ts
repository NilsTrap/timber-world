/**
 * Pure-logic tests for the catalog → deal line pricing helpers (no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/catalog/__tests__/dealPricing.test.ts`
 */
import {
  calcMethodToLineUnit,
  deriveLineTotalCents,
  variantUnitQuantity,
  FIELD_KEY_TO_LINE_ATTR,
} from "../dealPricing";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

// ── calcMethodToLineUnit: calc_method → order_line_items.unit ──
eq("area → m2", calcMethodToLineUnit("area"), "m2");
eq("volume → m3", calcMethodToLineUnit("volume"), "m3");
eq("length → linear_m", calcMethodToLineUnit("length"), "linear_m");
eq("per_piece → piece", calcMethodToLineUnit("per_piece"), "piece");

// ── deriveLineTotalCents: piece → round(price × pieces) ──
eq("piece total 250×3", deriveLineTotalCents("piece", 250, { pieces: 3 }), 750);
eq("piece total string pieces", deriveLineTotalCents("piece", 250, { pieces: "4" }), 1000);
eq("piece rounds half-up", deriveLineTotalCents("piece", 333, { pieces: 1.5 }), 500);

// ── deriveLineTotalCents: m3 / loose_m3 → round(price × volumeM3) ──
eq("m3 total 1000×2", deriveLineTotalCents("m3", 1000, { volumeM3: 2 }), 2000);
eq("loose_m3 total 1000×2", deriveLineTotalCents("loose_m3", 1000, { volumeM3: 2 }), 2000);
eq("m3 rounding 4567×2.5 → 11418", deriveLineTotalCents("m3", 4567, { volumeM3: 2.5 }), 11418);

// ── deriveLineTotalCents: m2 / linear_m / package / crate → explicit total or null ──
eq("m2 uses explicit", deriveLineTotalCents("m2", 1000, {}, 4200), 4200);
eq("linear_m uses explicit", deriveLineTotalCents("linear_m", 1000, {}, 4200), 4200);
eq("package uses explicit", deriveLineTotalCents("package", 1000, {}, 4200), 4200);
eq("crate uses explicit", deriveLineTotalCents("crate", 1000, {}, 4200), 4200);
eq("m2 no explicit → null", deriveLineTotalCents("m2", 1000, {}), null);
eq("linear_m no explicit → null", deriveLineTotalCents("linear_m", 1000, {}), null);

// ── deriveLineTotalCents: null price → explicit ?? null ──
eq("null price with explicit", deriveLineTotalCents("m3", null, { volumeM3: 2 }, 999), 999);
eq("null price no explicit → null", deriveLineTotalCents("m3", null, { volumeM3: 2 }), null);
eq("undefined price → null", deriveLineTotalCents("piece", undefined, { pieces: 3 }), null);

// ── deriveLineTotalCents: zero / negative qty → null ──
eq("piece zero qty → null", deriveLineTotalCents("piece", 250, { pieces: 0 }), null);
eq("piece negative qty → null", deriveLineTotalCents("piece", 250, { pieces: -2 }), null);
eq("m3 zero volume → null", deriveLineTotalCents("m3", 1000, { volumeM3: 0 }), null);
eq("m3 negative volume → null", deriveLineTotalCents("m3", 1000, { volumeM3: -1 }), null);
eq("m3 missing volume → null", deriveLineTotalCents("m3", 1000, {}), null);

// ── variantUnitQuantity: per-variant billable quantity in the category unit ──
eq("per_piece → 1", variantUnitQuantity("per_piece", { widthMm: 100, lengthMm: 2000, thicknessMm: 20 }), 1);
eq("volume w100 l2000 t20 → 0.004", variantUnitQuantity("volume", { widthMm: 100, lengthMm: 2000, thicknessMm: 20 }), 0.004);
eq("area w100 l2000 → 0.2 (w×l in m)", variantUnitQuantity("area", { widthMm: 100, lengthMm: 2000 }), 0.2);
eq("length l2000 → 2 (m)", variantUnitQuantity("length", { lengthMm: 2000 }), 2);
eq("volume missing thickness → null", variantUnitQuantity("volume", { widthMm: 100, lengthMm: 2000 }), null);
eq("area missing width → null", variantUnitQuantity("area", { lengthMm: 2000 }), null);
eq("length missing length → null", variantUnitQuantity("length", {}), null);

// ── FIELD_KEY_TO_LINE_ATTR: catalog field_key → line attr + option columns ──
eq("wood_species → woodSpecies/woodSpeciesOptionId", FIELD_KEY_TO_LINE_ATTR.wood_species, {
  value: "woodSpecies",
  option: "woodSpeciesOptionId",
});
eq("panel_type → productType/productTypeOptionId", FIELD_KEY_TO_LINE_ATTR.panel_type, {
  value: "productType",
  option: "productTypeOptionId",
});
eq("quality → quality/qualityOptionId", FIELD_KEY_TO_LINE_ATTR.quality, {
  value: "quality",
  option: "qualityOptionId",
});
eq("unknown key → undefined", FIELD_KEY_TO_LINE_ATTR.does_not_exist, undefined);

console.log(`\ndealPricing.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
