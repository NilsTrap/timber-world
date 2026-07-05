/**
 * Timber MCP · CATALOG domain — controlled vocabulary (attributes / category
 * fields) + the catalog products/variants read surface and the variant-stock write.
 *
 * Exports (aggregated by ../tools.ts + ../route.ts): `catalogTools` (ToolDef[]),
 * `catalogCaps` (USER_WRITE_CAPABILITY — the "catalogue" stock write) and
 * `catalogHandlers` (dispatch handlers = the exact former route.ts switch-case
 * bodies, unchanged).
 */
import { listDefinitions, getOptions, listCategoryDefinitions } from "@/features/catalog/services/attributes";
import { getVariantStock, saveVariantStockEntry } from "@/features/catalog/services/stock";
import { listCatalogProducts, getCatalogVariant } from "@/features/catalog/services/products";
import type { ToolDef, ToolHandler, UserWriteCapability } from "../types";
import { toolOk, toolErr, UUID_RE } from "../types";

export const catalogTools: ToolDef[] = [
  {
    name: "timber_get_attribute_definitions",
    description:
      "List the controlled-vocabulary attribute definitions (deal/line-item fields like species, quality, humidity, processing, plus the dimension fields). Returns each attribute's key, label, type, unit and active-option count. Call this first to learn the valid keys, then timber_list_attribute_options for a key's allowed values.",
    readOnly: true,
    lifecycle: "vocabulary",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "timber_get_category_fields",
    description:
      "List the spec fields assigned to one product category (the AI's question set for that category, per E5). Identify the category by category_id (UUID) or category_slug (e.g. 'firewood', 'boards', 'stairs', 'solid-wood-panels'). Returns each field ordered, with key, label, type, unit, whether it applies to the product or variant, whether it is required, and its active select options. Use before creating a deal in a category to know exactly which attributes to ask about.",
    readOnly: true,
    lifecycle: "vocabulary",
    inputSchema: {
      type: "object",
      properties: {
        category_id: { type: "string", description: "Category UUID (from the catalog). Provide this OR category_slug." },
        category_slug: { type: "string", description: "Category slug, e.g. 'firewood', 'boards', 'stairs', 'solid-wood-panels'. Resolved to the category id." },
      },
    },
  },
  {
    name: "timber_list_attribute_options",
    description:
      "List the allowed options (value + label) for one attribute, identified by its key (from timber_get_attribute_definitions). Use these exact values when creating deals/line items so they match the controlled vocabulary. Returns only active options.",
    readOnly: true,
    lifecycle: "vocabulary",
    inputSchema: {
      type: "object",
      properties: {
        attribute_key: { type: "string", description: "Attribute key, e.g. 'wood_species' or 'quality' (from timber_get_attribute_definitions)." },
      },
      required: ["attribute_key"],
    },
  },
  {
    name: "timber_list_catalog_products",
    description:
      "List a product category's products, each with its variants and per-variant prices (EUR cents) + dimensions + stock unit. Identify the category by category_id (UUID) or category_slug (e.g. 'firewood', 'boards', 'stairs', 'solid-wood-panels'). Read-only. Use timber_get_catalog_variant for one variant's packaging + stock detail.",
    readOnly: true,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        category_id: { type: "string", description: "Category UUID. Provide this OR category_slug." },
        category_slug: { type: "string", description: "Category slug, e.g. 'firewood', 'boards'. Resolved to the category id." },
      },
    },
  },
  {
    name: "timber_get_catalog_variant",
    description:
      "Get one catalog variant's full detail: dimensions, price (EUR cents), its owning product, the packaging forms assigned to it (the ONLY forms stock may be held in), and its current stock (per-form quantities + total pieces). Read-only.",
    readOnly: true,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { variant_id: { type: "string", description: "Catalog variant UUID." } },
      required: ["variant_id"],
    },
  },
  {
    name: "timber_get_variant_stock",
    description: "Get a catalog variant's stock: the quantity held in each packaging form + the computed total pieces. Read-only.",
    readOnly: true,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { variant_id: { type: "string", description: "Catalog variant UUID." } },
      required: ["variant_id"],
    },
  },
  {
    name: "timber_set_variant_stock",
    description:
      "Set a catalog variant's stock quantity for ONE packaging form (create or update that line). ENFORCES the packaging-form guard: the form must already be assigned to the variant (see timber_get_catalog_variant.packaging) — an undefined form is rejected with the same error the UI shows. Quantity is the number of packages of that form and must be ≥ 0. FULL-token only.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        variant_id: { type: "string", description: "Catalog variant UUID." },
        packaging_type_id: { type: "string", description: "Packaging form (catalog_packaging_types) UUID — must be a form assigned to this variant." },
        quantity: { type: "number", description: "Number of packages of that form to record (≥ 0). Replaces the current quantity for that (variant, form)." },
      },
      required: ["variant_id", "packaging_type_id", "quantity"],
    },
  },
];

/** T2 · WRITE capability for this domain — the catalogue.view module (the RLS
 *  admin-walled stock write; capability mirrors the portal's own gate). */
export const catalogCaps: Record<string, UserWriteCapability> = {
  timber_set_variant_stock: "catalogue",
};

/**
 * Resolve a catalog category id from either a category_id (UUID) or a
 * category_slug arg (shared by timber_get_category_fields + list_catalog_products).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveCategoryId(db: any, args: any): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const slug: string | null =
    args?.category_slug ?? (args?.category_id && !UUID_RE.test(args.category_id) ? args.category_id : null);
  let categoryId: string | null = args?.category_id && UUID_RE.test(args.category_id) ? args.category_id : null;
  if (!categoryId && slug) {
    const { data: cat } = await db.from("catalog_categories").select("id").eq("slug", slug).maybeSingle();
    if (!cat) return { ok: false, error: `No category found for slug "${slug}"` };
    categoryId = cat.id as string;
  }
  if (!categoryId) return { ok: false, error: "category_id (UUID) or category_slug is required" };
  return { ok: true, id: categoryId };
}

/**
 * CATALOG dispatch handlers — each is the exact body of the former route.ts switch
 * case for that tool (arg validation + service call), unchanged.
 */
export const catalogHandlers: Record<string, ToolHandler> = {
  timber_get_attribute_definitions: async (_args, ctx) => {
    const { db } = ctx;
    const res = await listDefinitions(db);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_get_category_fields: async (args, ctx) => {
    const { db } = ctx;
    const categoryId = await resolveCategoryId(db, args);
    if (!categoryId.ok) return toolErr(categoryId.error);
    const res = await listCategoryDefinitions(db, categoryId.id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_list_attribute_options: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.attribute_key) return toolErr("attribute_key is required");
    const res = await getOptions(db, args.attribute_key);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_list_catalog_products: async (args, ctx) => {
    const { db } = ctx;
    const categoryId = await resolveCategoryId(db, args);
    if (!categoryId.ok) return toolErr(categoryId.error);
    const res = await listCatalogProducts(db, categoryId.id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_get_catalog_variant: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.variant_id) return toolErr("variant_id is required");
    const res = await getCatalogVariant(db, args.variant_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_get_variant_stock: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.variant_id) return toolErr("variant_id is required");
    const res = await getVariantStock(db, args.variant_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_set_variant_stock: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.variant_id || !args?.packaging_type_id) return toolErr("variant_id and packaging_type_id are required");
    if (typeof args?.quantity !== "number") return toolErr("quantity (number) is required");
    const res = await saveVariantStockEntry(db, {
      variantId: args.variant_id,
      packagingTypeId: args.packaging_type_id,
      quantity: args.quantity,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
};
