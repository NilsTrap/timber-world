/**
 * S2/S5 · readLineFieldValues tests (tsx assertion script — repo convention).
 * Run: from apps/portal →
 *   ../../tests/rls-and-perf/node_modules/.bin/tsx \
 *     src/features/catalog/services/__tests__/lineFieldValues.test.ts
 *
 * This is the FIRST half of the dynamic-attr chain — the reader that turns a
 * line's `catalogVariantId` (/ productId) into the `attr` map a document later
 * places via `{{lookup attr "<field_key>"}}`. The SECOND half (that a populated
 * DocLineItem.attr renders through the merge pipeline) is proven end-to-end in
 * documents/__tests__/templateMerge.test.ts (`<td>GL24h</td>`) + the S3 column
 * compiler in compiler/__tests__/slate.test.ts. Together they close the loop
 *   catalogVariantId → DocLineItem.attr[field_key] → {{lookup attr}} column.
 *
 * The reader takes an INJECTED db client (zero imports, no I/O of its own), so we
 * feed a tiny fake matching the Supabase `.from(t).select(s).eq(c,v)` shape and
 * assert the three EAV resolution modes, variant-over-product precedence, default
 * packaging, the empty-on-no-linkage short-circuit, null-value skipping, and the
 * never-throws contract.
 */
import { readLineFieldValues } from "../lineFieldValues";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}
function ok(label: string, cond: boolean) {
  if (cond) passed++;
  else { failed++; console.error(`✗ ${label}`); }
}

// ── Fake Supabase client ─────────────────────────────────────────────────────
// The reader calls db.from(table).select(sel).eq(col, val) and awaits the result
// ({ data }). We key the returned rows by table name; `.eq` resolves immediately.
type Rows = Record<string, unknown[]>;
function fakeDb(tables: Rows) {
  return {
    from(table: string) {
      return {
        select(_sel: string) {
          return {
            eq(_col: string, _val: string) {
              return Promise.resolve({ data: tables[table] ?? [] });
            },
          };
        },
      };
    },
  };
}

// An EAV row shaped like the FV_SELECT embed (catalog_fields + catalog_field_options).
function fv(
  fieldKey: string,
  fieldLabel: string,
  fieldType: string,
  opts: { optionLabel?: string | null; valueText?: string | null; valueNumber?: number | null; unit?: string | null },
) {
  return {
    field_id: `f_${fieldKey}`,
    option_id: opts.optionLabel != null ? `opt_${fieldKey}` : null,
    value_text: opts.valueText ?? null,
    value_number: opts.valueNumber ?? null,
    catalog_fields: { field_key: fieldKey, field_label: fieldLabel, field_type: fieldType, unit: opts.unit ?? null },
    catalog_field_options: opts.optionLabel != null ? { label: opts.optionLabel } : null,
  };
}

// ── 1 · No catalog linkage → EMPTY (never hits the db) ───────────────────────
(async () => {
  const empty = await readLineFieldValues(fakeDb({}), { variantId: null, productId: null });
  eq("no linkage → empty fields", empty.fields, {});
  eq("no linkage → null packaging", empty.packaging, null);

  // ── 2 · option_id → catalog_field_options.label wins ───────────────────────
  const optRes = await readLineFieldValues(
    fakeDb({
      catalog_variant_field_values: [
        fv("glulam_grade", "Glulam grade", "select", { optionLabel: "GL24h" }),
      ],
    }),
    { variantId: "v1", productId: null },
  );
  eq("select field resolves to option label", optRes.fields.glulam_grade?.value, "GL24h");
  eq("select field carries its label", optRes.fields.glulam_grade?.label, "Glulam grade");
  eq("select field carries its type", optRes.fields.glulam_grade?.type, "select");

  // ── 3 · value_text verbatim ─────────────────────────────────────────────────
  const textRes = await readLineFieldValues(
    fakeDb({
      catalog_variant_field_values: [
        fv("coating", "Coating", "text", { valueText: "UV lacquer" }),
      ],
    }),
    { variantId: "v1", productId: null },
  );
  eq("text field resolves verbatim", textRes.fields.coating?.value, "UV lacquer");

  // ── 4 · value_number + unit → "N unit"; without unit → String(N) ─────────────
  const numRes = await readLineFieldValues(
    fakeDb({
      catalog_variant_field_values: [
        fv("char_strength", "Char. strength", "number", { valueNumber: 24, unit: "N/mm²" }),
        fv("layers", "Layers", "number", { valueNumber: 5, unit: null }),
      ],
    }),
    { variantId: "v1", productId: null },
  );
  eq("number field appends unit", numRes.fields.char_strength?.value, "24 N/mm²");
  eq("number field without unit → bare number", numRes.fields.layers?.value, "5");
  eq("number field carries unit", numRes.fields.char_strength?.unit, "N/mm²");

  // ── 5 · Product ∪ variant, VARIANT wins on a shared field_key ────────────────
  const mergeRes = await readLineFieldValues(
    fakeDb({
      catalog_product_field_values: [
        fv("glulam_grade", "Glulam grade", "select", { optionLabel: "GL20h (product default)" }),
        fv("origin", "Origin", "text", { valueText: "Latvia" }),
      ],
      catalog_variant_field_values: [
        fv("glulam_grade", "Glulam grade", "select", { optionLabel: "GL28c (variant override)" }),
      ],
    }),
    { variantId: "v1", productId: "p1" },
  );
  eq("variant overrides product on shared key", mergeRes.fields.glulam_grade?.value, "GL28c (variant override)");
  eq("product-only field still present", mergeRes.fields.origin?.value, "Latvia");
  eq("merged field count", Object.keys(mergeRes.fields).length, 2);

  // ── 6 · Default packaging (is_default row preferred, else first) ─────────────
  const packRes = await readLineFieldValues(
    fakeDb({
      catalog_variant_packaging_assignments: [
        { is_default: false, catalog_packaging_types: { name: "Loose", pieces_per_package: 1 } },
        { is_default: true, catalog_packaging_types: { name: "Bundle", pieces_per_package: 48 } },
      ],
    }),
    { variantId: "v1", productId: null },
  );
  eq("packaging picks the is_default row", packRes.packaging, { name: "Bundle", piecesPerPackage: 48 });

  const packFallback = await readLineFieldValues(
    fakeDb({
      catalog_variant_packaging_assignments: [
        { is_default: false, catalog_packaging_types: { name: "Crate", pieces_per_package: 12 } },
      ],
    }),
    { variantId: "v1", productId: null },
  );
  eq("packaging falls back to first when no default", packFallback.packaging, { name: "Crate", piecesPerPackage: 12 });

  const noPack = await readLineFieldValues(
    fakeDb({ catalog_variant_field_values: [fv("x", "X", "text", { valueText: "y" })] }),
    { variantId: "v1", productId: null },
  );
  eq("no packaging assignment → null", noPack.packaging, null);

  // ── 7 · Rows carrying no display value are skipped ──────────────────────────
  const skipRes = await readLineFieldValues(
    fakeDb({
      catalog_variant_field_values: [
        fv("blank", "Blank", "text", { valueText: "" }), // empty text → skipped
        { field_id: "f_nil", option_id: null, value_text: null, value_number: null,
          catalog_fields: { field_key: "nil", field_label: "Nil", field_type: "text", unit: null },
          catalog_field_options: null }, // all-null → skipped
        fv("real", "Real", "text", { valueText: "kept" }),
      ],
    }),
    { variantId: "v1", productId: null },
  );
  eq("empty/null rows skipped, real kept", Object.keys(skipRes.fields), ["real"]);

  // ── 8 · Never throws — a rejecting client yields the empty set ──────────────
  const throwingDb = {
    from() {
      return { select() { return { eq() { return Promise.reject(new Error("boom")); } }; } };
    },
  };
  const safe = await readLineFieldValues(throwingDb, { variantId: "v1", productId: "p1" });
  eq("db failure → empty fields (never blocks generation)", safe.fields, {});
  eq("db failure → null packaging", safe.packaging, null);

  let strictRejected = false;
  try {
    await readLineFieldValues(throwingDb, { variantId: "v1", productId: "p1" }, { strict: true });
  } catch (error) {
    strictRejected = error instanceof Error && error.message === "boom";
  }
  ok("strict snapshot reads propagate catalogue failures", strictRejected);

  const packagingFailureDb = {
    from(table: string) {
      return { select() { return { eq() { return Promise.resolve(table === "catalog_variant_packaging_assignments"
        ? { data: null, error: { message: "packaging unavailable" } }
        : { data: table === "catalog_product_field_values" ? [fv("safe", "Safe", "text", { valueText: "kept" })] : [], error: null }); } }; } };
    },
  };
  const strictWithPackagingFailure = await readLineFieldValues(packagingFailureDb, { productId: "p1", variantId: "v1" }, { strict: true });
  eq("strict field read ignores unrelated packaging failure", strictWithPackagingFailure.fields.safe?.value, "kept");

  // ── 9 · product-only linkage (no variant) still resolves ────────────────────
  const prodOnly = await readLineFieldValues(
    fakeDb({
      catalog_product_field_values: [fv("cert", "Certificate", "text", { valueText: "FSC" })],
    }),
    { variantId: null, productId: "p1" },
  );
  eq("product-only linkage resolves field", prodOnly.fields.cert?.value, "FSC");
  ok("product-only linkage got a field", Object.keys(prodOnly.fields).length === 1);

  console.log(`\nreadLineFieldValues: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
})();
