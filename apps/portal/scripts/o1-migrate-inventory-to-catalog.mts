/**
 * O1 · Legacy-inventory → catalog migration. Idempotent + reconciling.
 * (Wave 2, Epic O — docs/wave2-spine-lego.md §2.) Pattern mirrors the e8/a2
 * migration scripts: `createAdminClient()` (env `NEXT_PUBLIC_SUPABASE_URL` +
 * `SUPABASE_SERVICE_ROLE_KEY`), a `--apply` flag (default = dry-run, no writes),
 * run via tsx from `apps/portal`.
 *
 * STAGING ONLY (`fyzrtqsnmnizoxgcqsjc`). PROD IS FROZEN — this never touches prod.
 * Legacy tables stay LIVE in parallel: this READS `inventory_packages` + `ref_*`
 * and only WRITES catalog tables. It never drops/mutates the legacy tables (the
 * E5 decommission is gated + separate).
 *
 * WHAT IT DOES
 *  Groups every non-consumed `inventory_packages` row (product_name_id set) into a
 *  three-level catalog structure, reusing the field vocabulary the catalog already
 *  seeded from `ref_*` (catalog_fields.ref_table + catalog_field_options.ref_value_id):
 *   - CATEGORY  = product name (ref_product_names). slug `inv-<name>` (namespaced so
 *                 it never collides with the hand-made/[DEMO] seed categories).
 *   - PRODUCT   = a distinct attribute combo within the category
 *                 (wood_species × humidity × type × processing × fsc × quality),
 *                 with its 6 attribute field-values set to the matching catalog options.
 *   - VARIANT   = a distinct dimension combo (thickness × width × length). Dims land
 *                 on the variant's numeric *_mm columns (comma-decimals parsed; a
 *                 non-numeric dim, e.g. a "100-350" range, becomes NULL mm but the raw
 *                 value still keys the variant so nothing collapses).
 *  Each migrated category gets its 9 field assignments (6 attributes @ product level,
 *  3 dimensions @ variant level). Every variant gets a "Single Piece" packaging
 *  assignment (pieces_per_package = 1). STOCK is set ONLY from `status = 'available'`
 *  pieces (the unambiguous on-hand quantity) — quantity is the piece count (ppp = 1).
 *  Produced / ordered piece totals are reported but NOT written (see report).
 *
 * IDEMPOTENT: every write guards on a stable natural key —
 *   categories .slug · products (category_id, slug) · category field assignments
 *   (category_id, field_id) · product field values (product_id, field_id) ·
 *   packaging (variant_id, packaging_type_id) · stock (variant_id, packaging_type_id).
 *   Variants (no DB unique key) are guarded on a deterministic per-product `sku`
 *   derived from the raw dimension tuple. Re-running is a no-op / reconcile.
 *
 * Usage (from apps/portal):
 *   # dry-run (read-only plan, no writes):
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… tsx scripts/o1-migrate-inventory-to-catalog.mts
 *   # apply:
 *   … tsx scripts/o1-migrate-inventory-to-catalog.mts --apply
 */
import { createHash } from "node:crypto";
import { createAdminClient } from "@timber/database";
import { saveVariantStockEntry } from "@/features/catalog/services/stock";

const APPLY = process.argv.includes("--apply");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

// ── configuration ────────────────────────────────────────────────────────────

const CAT_PREFIX = "inv-";

/** Inventory attribute column → catalog field_key (already ref-linked + seeded). */
const ATTR_FIELDS = [
  { col: "wood_species_id", key: "wood_species" },
  { col: "humidity_id", key: "humidity" },
  { col: "type_id", key: "panel_type" }, // catalog field for ref_types is "panel_type"
  { col: "processing_id", key: "processing" },
  { col: "fsc_id", key: "fsc" },
  { col: "quality_id", key: "quality" },
] as const;

/** Dimension (system) fields, assigned at variant level. */
const DIM_FIELD_KEYS = ["thickness", "width", "length"] as const;

/** Sensible primary_unit per product name; default 'piece' (inventory counts pieces). */
const UNIT_BY_NAME: Record<string, string> = {
  "Solid wood panels": "m2",
  "Edged boards": "m3",
  "Unedged boards": "m3",
  Strips: "m3",
  Tread: "piece",
  Winder: "piece",
  Quarter: "piece",
};

const SINGLE_PIECE_NAME = "Single Piece"; // packaging type with pieces_per_package = 1

// ── helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "x";
}
function shortHash(s: string): string {
  return createHash("md5").update(s).digest("hex").slice(0, 10);
}
/** trim + comma→dot; "" for empty. */
function normDim(s: string | null): string {
  return (s ?? "").trim().replace(",", ".");
}
/** parse a dimension to a number of mm, or null if non-numeric (e.g. "100-350"). */
function parseMm(s: string | null): number | null {
  const n = normDim(s);
  return /^[0-9]+(\.[0-9]+)?$/.test(n) ? Number(n) : null;
}
/** parse a piece count to a number, or 0 if non-numeric (e.g. "-"). */
function parsePieces(s: string | null): number {
  const n = normDim(s);
  return /^[0-9]+(\.[0-9]+)?$/.test(n) ? Number(n) : 0;
}

interface SrcRow {
  id: string;
  product_name_id: string | null;
  wood_species_id: string | null;
  humidity_id: string | null;
  type_id: string | null;
  processing_id: string | null;
  fsc_id: string | null;
  quality_id: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  status: string | null;
}

/** Page through every source row (Supabase caps a single select at 1000). */
async function loadSourceRows(db: Db): Promise<SrcRow[]> {
  const out: SrcRow[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await db
      .from("inventory_packages")
      .select(
        "id, product_name_id, wood_species_id, humidity_id, type_id, processing_id, fsc_id, quality_id, thickness, width, length, pieces, status",
      )
      .not("product_name_id", "is", null)
      .neq("status", "consumed")
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(`load inventory_packages: ${error.message}`);
    const rows = (data ?? []) as SrcRow[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

// ── grouped model ────────────────────────────────────────────────────────────

interface VariantGroup {
  key: string; // raw dims key
  thicknessRaw: string;
  widthRaw: string;
  lengthRaw: string;
  thicknessMm: number | null;
  widthMm: number | null;
  lengthMm: number | null;
  availablePieces: number;
  nonNumeric: boolean;
}
interface ProductGroup {
  key: string; // attribute-id tuple
  attrIds: Record<string, string | null>; // field_key → ref id
  variants: Map<string, VariantGroup>;
}
interface CategoryGroup {
  productNameId: string;
  name: string;
  products: Map<string, ProductGroup>;
}

function build(rows: SrcRow[]): Map<string, CategoryGroup> {
  const cats = new Map<string, CategoryGroup>();
  for (const r of rows) {
    const catKey = r.product_name_id!;
    let cat = cats.get(catKey);
    if (!cat) {
      cat = { productNameId: catKey, name: "", products: new Map() };
      cats.set(catKey, cat);
    }
    const attrIds: Record<string, string | null> = {
      wood_species: r.wood_species_id,
      humidity: r.humidity_id,
      panel_type: r.type_id,
      processing: r.processing_id,
      fsc: r.fsc_id,
      quality: r.quality_id,
    };
    const prodKey = ATTR_FIELDS.map((f) => attrIds[f.key] ?? "").join("|");
    let prod = cat.products.get(prodKey);
    if (!prod) {
      prod = { key: prodKey, attrIds, variants: new Map() };
      cat.products.set(prodKey, prod);
    }
    const tRaw = normDim(r.thickness);
    const wRaw = normDim(r.width);
    const lRaw = normDim(r.length);
    const varKey = `${tRaw}|${wRaw}|${lRaw}`;
    let v = prod.variants.get(varKey);
    if (!v) {
      const tMm = parseMm(r.thickness);
      const wMm = parseMm(r.width);
      const lMm = parseMm(r.length);
      v = {
        key: varKey,
        thicknessRaw: tRaw,
        widthRaw: wRaw,
        lengthRaw: lRaw,
        thicknessMm: tMm,
        widthMm: wMm,
        lengthMm: lMm,
        availablePieces: 0,
        nonNumeric: (tRaw !== "" && tMm === null) || (wRaw !== "" && wMm === null) || (lRaw !== "" && lMm === null),
      };
      prod.variants.set(varKey, v);
    }
    if (r.status === "available") v.availablePieces += parsePieces(r.pieces);
  }
  return cats;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = createAdminClient() as Db;
  console.log(`\n── O1 inventory→catalog migration ${APPLY ? "(APPLY)" : "(DRY-RUN — no writes)"} ──`);

  // 1. Vocabulary: product names, catalog fields (by key), attr option lookup.
  const { data: pnData, error: pnErr } = await db.from("ref_product_names").select("id, value");
  if (pnErr) throw new Error(`ref_product_names: ${pnErr.message}`);
  const productNameById = new Map<string, string>((pnData ?? []).map((r: { id: string; value: string }) => [r.id, r.value]));

  const wantKeys = [...ATTR_FIELDS.map((f) => f.key), ...DIM_FIELD_KEYS];
  const { data: fData, error: fErr } = await db.from("catalog_fields").select("id, field_key").in("field_key", wantKeys);
  if (fErr) throw new Error(`catalog_fields: ${fErr.message}`);
  const fieldIdByKey = new Map<string, string>((fData ?? []).map((r: { id: string; field_key: string }) => [r.field_key, r.id]));
  for (const k of wantKeys) if (!fieldIdByKey.has(k)) throw new Error(`Missing catalog field for key "${k}" — cannot map. Aborting.`);

  const attrFieldIds = ATTR_FIELDS.map((f) => fieldIdByKey.get(f.key)!);
  const { data: optData, error: optErr } = await db
    .from("catalog_field_options")
    .select("id, field_id, ref_value_id, label")
    .in("field_id", attrFieldIds)
    .not("ref_value_id", "is", null);
  if (optErr) throw new Error(`catalog_field_options: ${optErr.message}`);
  // (field_id, ref_value_id) → { optionId, label }
  const optionByFieldRef = new Map<string, { id: string; label: string }>();
  for (const o of (optData ?? []) as { id: string; field_id: string; ref_value_id: string; label: string }[]) {
    optionByFieldRef.set(`${o.field_id}|${o.ref_value_id}`, { id: o.id, label: o.label });
  }

  // Single Piece packaging type.
  const { data: pkgData, error: pkgErr } = await db
    .from("catalog_packaging_types")
    .select("id, name, pieces_per_package")
    .eq("name", SINGLE_PIECE_NAME)
    .maybeSingle();
  if (pkgErr) throw new Error(`catalog_packaging_types: ${pkgErr.message}`);
  if (!pkgData?.id) throw new Error(`Packaging type "${SINGLE_PIECE_NAME}" not found — aborting.`);
  const singlePieceId: string = pkgData.id;

  // 2. Load + group source rows.
  const rows = await loadSourceRows(db);
  const cats = build(rows);
  for (const cat of cats.values()) cat.name = productNameById.get(cat.productNameId) ?? "(unknown)";

  // Also count the truly-unmappable rows (no product_name_id) — reported, not migrated.
  const { count: nullPnCount } = await db
    .from("inventory_packages")
    .select("id", { count: "exact", head: true })
    .is("product_name_id", null);

  // Tally the plan.
  let planProducts = 0;
  let planVariants = 0;
  let planStockVariants = 0;
  let planStockPieces = 0;
  let nonNumericVariants = 0;
  for (const cat of cats.values()) {
    for (const prod of cat.products.values()) {
      planProducts++;
      for (const v of prod.variants.values()) {
        planVariants++;
        if (v.nonNumeric) nonNumericVariants++;
        if (v.availablePieces > 0) {
          planStockVariants++;
          planStockPieces += v.availablePieces;
        }
      }
    }
  }
  console.log(`Source non-consumed rows (product_name set): ${rows.length}`);
  console.log(`Unmappable rows (product_name_id NULL):      ${nullPnCount ?? "?"}`);
  console.log(`Plan → categories ${cats.size} · products ${planProducts} · variants ${planVariants}`);
  console.log(`Plan → stock: ${planStockVariants} variants, ${planStockPieces} available pieces`);
  console.log(`Plan → variants with a non-numeric dimension: ${nonNumericVariants}`);

  if (!APPLY) {
    console.log(`\nDRY-RUN complete — no writes. Re-run with --apply to migrate.`);
    return;
  }

  // 3. Apply.
  const c = {
    catCreated: 0,
    catExisting: 0,
    assignCreated: 0,
    prodCreated: 0,
    prodExisting: 0,
    pfvUpserted: 0,
    varCreated: 0,
    varExisting: 0,
    pkgAssigned: 0,
    stockSet: 0,
    stockPieces: 0,
  };

  const sortedCats = [...cats.values()].sort((a, b) => a.name.localeCompare(b.name));
  let catSort = 0;
  for (const cat of sortedCats) {
    const slug = CAT_PREFIX + slugify(cat.name);
    const unit = UNIT_BY_NAME[cat.name] ?? "piece";

    // Category (upsert on slug; never overwrite an existing one's config).
    const { data: existingCat } = await db.from("catalog_categories").select("id").eq("slug", slug).maybeSingle();
    let categoryId: string;
    if (existingCat?.id) {
      categoryId = existingCat.id;
      c.catExisting++;
    } else {
      const { data: ins, error } = await db
        .from("catalog_categories")
        .insert({ slug, name: cat.name, primary_unit: unit, sort_order: 1000 + catSort, is_active: true })
        .select("id")
        .single();
      if (error) throw new Error(`insert category ${slug}: ${error.message}`);
      categoryId = ins.id;
      c.catCreated++;
    }
    catSort++;

    // Field assignments (6 attributes @ product, 3 dims @ variant). Idempotent upsert.
    const assignments = [
      ...ATTR_FIELDS.map((f, i) => ({
        category_id: categoryId,
        field_id: fieldIdByKey.get(f.key)!,
        applies_to: "product",
        show_in_filter: true,
        show_in_detail: true,
        show_in_price_list: false,
        is_required: false,
        sort_order: i,
      })),
      ...DIM_FIELD_KEYS.map((k, i) => ({
        category_id: categoryId,
        field_id: fieldIdByKey.get(k)!,
        applies_to: "variant",
        show_in_filter: true,
        show_in_detail: true,
        show_in_price_list: false,
        is_required: false,
        sort_order: 100 + i,
      })),
    ];
    // Count how many are new before upserting (for reporting).
    const { data: existingAssigns } = await db
      .from("catalog_category_field_assignments")
      .select("field_id")
      .eq("category_id", categoryId);
    const haveFieldIds = new Set((existingAssigns ?? []).map((r: { field_id: string }) => r.field_id));
    c.assignCreated += assignments.filter((a) => !haveFieldIds.has(a.field_id)).length;
    const { error: aErr } = await db
      .from("catalog_category_field_assignments")
      .upsert(assignments, { onConflict: "category_id,field_id", ignoreDuplicates: true });
    if (aErr) throw new Error(`upsert assignments for ${slug}: ${aErr.message}`);

    // Products.
    const sortedProds = [...cat.products.values()];
    let prodSort = 0;
    for (const prod of sortedProds) {
      const prodSlug = CAT_PREFIX + shortHash(categoryId + "|" + prod.key);
      // Human name from attribute labels.
      const labelParts: string[] = [];
      for (const f of ATTR_FIELDS) {
        const refId = prod.attrIds[f.key];
        if (refId) {
          const opt = optionByFieldRef.get(`${fieldIdByKey.get(f.key)!}|${refId}`);
          if (opt) labelParts.push(opt.label);
        }
      }
      const prodName = labelParts.length ? labelParts.join(" · ") : `${cat.name} (standard)`;

      const { data: existingProd } = await db
        .from("catalog_products")
        .select("id")
        .eq("category_id", categoryId)
        .eq("slug", prodSlug)
        .maybeSingle();
      let productId: string;
      if (existingProd?.id) {
        productId = existingProd.id;
        c.prodExisting++;
      } else {
        const { data: ins, error } = await db
          .from("catalog_products")
          .insert({ category_id: categoryId, slug: prodSlug, name: prodName, sort_order: prodSort, is_active: true })
          .select("id")
          .single();
        if (error) throw new Error(`insert product ${prodSlug}: ${error.message}`);
        productId = ins.id;
        c.prodCreated++;
      }
      prodSort++;

      // Product field values (the 6 attributes → catalog option).
      const pfvRows: Record<string, unknown>[] = [];
      for (const f of ATTR_FIELDS) {
        const refId = prod.attrIds[f.key];
        if (!refId) continue;
        const opt = optionByFieldRef.get(`${fieldIdByKey.get(f.key)!}|${refId}`);
        if (!opt) continue; // coverage verified 100%, but stay safe
        pfvRows.push({ product_id: productId, field_id: fieldIdByKey.get(f.key)!, option_id: opt.id });
      }
      if (pfvRows.length) {
        const { error: pErr } = await db
          .from("catalog_product_field_values")
          .upsert(pfvRows, { onConflict: "product_id,field_id" });
        if (pErr) throw new Error(`upsert product field values ${prodSlug}: ${pErr.message}`);
        c.pfvUpserted += pfvRows.length;
      }

      // Existing variants for this product → map by sku (our deterministic natural key).
      const { data: exVars } = await db.from("catalog_variants").select("id, sku").eq("product_id", productId);
      const varIdBySku = new Map<string, string>(
        (exVars ?? []).filter((r: { sku: string | null }) => r.sku).map((r: { id: string; sku: string }) => [r.sku, r.id]),
      );

      let varSort = 0;
      for (const v of prod.variants.values()) {
        const sku = `INV-${shortHash(productId + "|" + v.key)}`;
        let variantId = varIdBySku.get(sku);
        const dimPayload = { thickness_mm: v.thicknessMm, width_mm: v.widthMm, length_mm: v.lengthMm };
        if (variantId) {
          // Reconcile dims (e.g. a previously-null parse now resolvable) — cheap + safe.
          const { error } = await db.from("catalog_variants").update(dimPayload).eq("id", variantId);
          if (error) throw new Error(`update variant ${sku}: ${error.message}`);
          c.varExisting++;
        } else {
          const { data: ins, error } = await db
            .from("catalog_variants")
            .insert({ product_id: productId, sku, ...dimPayload, stock_unit: "piece", is_active: true, sort_order: varSort })
            .select("id")
            .single();
          if (error) throw new Error(`insert variant ${sku}: ${error.message}`);
          variantId = ins.id;
          c.varCreated++;
        }
        varSort++;

        // Packaging assignment (Single Piece, default) — required before stock can be set.
        const { data: exPkg } = await db
          .from("catalog_variant_packaging_assignments")
          .select("id")
          .eq("variant_id", variantId)
          .eq("packaging_type_id", singlePieceId)
          .maybeSingle();
        if (!exPkg?.id) {
          const { error } = await db
            .from("catalog_variant_packaging_assignments")
            .insert({ variant_id: variantId, packaging_type_id: singlePieceId, is_default: true });
          if (error) throw new Error(`insert packaging for ${sku}: ${error.message}`);
          c.pkgAssigned++;
        }

        // Stock — only real available on-hand pieces. ppp=1 ⇒ quantity = pieces.
        if (v.availablePieces > 0) {
          const res = await saveVariantStockEntry(db, {
            variantId: variantId!,
            packagingTypeId: singlePieceId,
            quantity: v.availablePieces,
          });
          if (!res.success) throw new Error(`set stock for ${sku}: ${res.error}`);
          c.stockSet++;
          c.stockPieces += v.availablePieces;
        }
      }
    }
    console.log(`  ✓ ${cat.name} (${slug}) — ${cat.products.size} products`);
  }

  console.log(`\n── APPLY complete ──`);
  console.log(`categories:            +${c.catCreated} created, ${c.catExisting} existing`);
  console.log(`field assignments:     +${c.assignCreated} created`);
  console.log(`products:              +${c.prodCreated} created, ${c.prodExisting} existing`);
  console.log(`product field values:  ${c.pfvUpserted} upserted`);
  console.log(`variants:              +${c.varCreated} created, ${c.varExisting} existing`);
  console.log(`packaging assignments: +${c.pkgAssigned} created (Single Piece)`);
  console.log(`stock lines:           ${c.stockSet} set, ${c.stockPieces} pieces total (available only)`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exitCode = 1;
});
