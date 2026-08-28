/**
 * Timber MCP · CATALOG domain — controlled vocabulary (attributes / category
 * fields), the catalog products/variants read surface, variant stock, AND (T6) the
 * full catalog AUTHORING write surface: categories · global fields + options +
 * category assignments · products (+ bulk) · variants · packaging types + variant
 * packaging · currencies + derived prices.
 *
 * Exports (aggregated by ../tools.ts + ../route.ts): `catalogTools` (ToolDef[]),
 * `catalogCaps` (USER_WRITE_CAPABILITY) and `catalogHandlers` (dispatch handlers).
 *
 * AUTHZ (T6): EVERY catalog WRITE table is RLS-walled to platform admins
 * (`is_current_user_platform_admin`), so all catalog write tools carry cap `admin`
 * — the env owner token (SERVICE_ACTOR, real admin) passes; a non-admin user key is
 * refused (FORBIDDEN) at the route BEFORE dispatch AND blocked at the DB by RLS.
 * Reads are open (authenticated + anon SELECT) → readOnly tools need no capability.
 * The write DB logic is a pure `(db,…)` service (`services/catalogAdmin.ts`) that
 * mirrors the `"use server"` twins under `catalog/actions/*` MINUS their
 * session-bound side-effects (revalidatePath / logAudit / recomputeEntityCurrencies)
 * — so an MCP catalog write does NOT re-derive non-EUR prices nor emit an audit row.
 */
import { listDefinitions, getOptions, listCategoryDefinitions } from "@/features/catalog/services/attributes";
import { getVariantStock, saveVariantStockEntry, deleteVariantStockEntry } from "@/features/catalog/services/stock";
import { listCatalogProducts, getCatalogVariant } from "@/features/catalog/services/products";
import {
  listCategories, getCategory as getCategoryService, saveCategory, duplicateCategory, deleteCategory,
  saveField, deleteField, saveFieldOption, deleteFieldOption, saveFieldAssignment, removeFieldAssignment,
  saveProduct, duplicateProduct, deleteProduct,
  bulkDeleteProducts, bulkSetProductsActive, bulkSetProductsVisibility, bulkMoveProductsToCategory,
  saveVariant, deleteVariant,
  savePackagingType, deletePackagingType, assignVariantPackaging, removeVariantPackaging,
  listCurrencies, getCatalogCurrencyPrices, saveCurrency, deleteCurrency, updateCurrencyPrices, setVariantCurrencyOverride,
} from "@/features/catalog/services/catalogAdmin";
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

  // ── T3: variant stock delete ────────────────────────────────────────────────
  {
    name: "timber_delete_variant_stock",
    description:
      "Delete ONE catalog variant stock line by its stock-entry id (catalog_variant_stock.id — from timber_get_variant_stock[].id). Removes the whole (variant, packaging form) quantity line. Admin-only, FULL token. To zero a line instead, use timber_set_variant_stock with quantity 0.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { stock_entry_id: { type: "string", description: "catalog_variant_stock row id (from timber_get_variant_stock)." } },
      required: ["stock_entry_id"],
    },
  },

  // ── T6: categories (read + write) ───────────────────────────────────────────
  {
    name: "timber_list_categories",
    description:
      "List all catalog categories: id, slug, name, primary unit, default EUR price (cents), commission %s, active + per-surface visibility (agents/internal/marketing), sort order, and field/product counts. Read-only.",
    readOnly: true,
    lifecycle: "catalog",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "timber_get_category",
    description: "Get one catalog category by category_id (UUID) or category_slug, with its field + product counts. Read-only.",
    readOnly: true,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        category_id: { type: "string", description: "Category UUID. Provide this OR category_slug." },
        category_slug: { type: "string", description: "Category slug (resolved to the id)." },
      },
    },
  },
  {
    name: "timber_save_category",
    description:
      "Create (omit id) or update (pass id) a catalog category. slug + name + primary_unit are required; primary_unit is one of 'm2' | 'm3' | 'piece' | 'linear_m'. Slug must be unique (duplicate → error). Admin-only, FULL token. NOTE: does NOT re-derive non-EUR prices — run timber_update_currency_prices after price changes.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Category UUID to update. Omit to create." },
        slug: { type: "string", description: "URL slug, unique across categories." },
        name: { type: "string" },
        description: { type: "string" },
        primary_unit: { type: "string", description: "'m2' | 'm3' | 'piece' | 'linear_m'." },
        default_price_eur_cents: { type: "number", description: "Default price in EUR cents (or null)." },
        commission_standard_pct: { type: "number" },
        commission_max_discount_pct: { type: "number" },
        commission_discounted_pct: { type: "number" },
        is_active: { type: "boolean" },
        visible_agents: { type: "boolean" },
        visible_internal: { type: "boolean" },
        visible_marketing: { type: "boolean" },
        sort_order: { type: "number" },
      },
      required: ["slug", "name", "primary_unit"],
    },
  },
  {
    name: "timber_duplicate_category",
    description: "Duplicate a category (slug '-copy', name '(Copy)', created inactive) including its field assignments. Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { category_id: { type: "string", description: "Source category UUID." } },
      required: ["category_id"],
    },
  },
  {
    name: "timber_delete_category",
    description:
      "DESTRUCTIVE — delete a category AND cascade-delete every product + variant in it (variant field values, images, stock, packaging cascade too). External links (orders/inventory) are unlinked, not deleted. Use timber_get_category to check counts first. Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { category_id: { type: "string", description: "Category UUID to delete (with its products + variants)." } },
      required: ["category_id"],
    },
  },

  // ── T6: global fields + options + category assignments ──────────────────────
  {
    name: "timber_save_field",
    description:
      "Create (omit id) or update (pass id) a GLOBAL catalog field (attribute). field_key must be a plain slug — letters/digits/underscores, starting with a letter or underscore (it is interpolated into document line-item expressions, so quotes/braces are rejected). field_type is 'select' | 'number' | 'text' | 'boolean' | 'file'. System (dimension) fields allow ONLY label/unit edits. Duplicate key → error. Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Field UUID to update. Omit to create." },
        field_key: { type: "string", description: "Slug key: ^[A-Za-z_][A-Za-z0-9_]*$." },
        field_label: { type: "string" },
        field_type: { type: "string", description: "'select' | 'number' | 'text' | 'boolean' | 'file'." },
        unit: { type: "string" },
        ref_table: { type: "string" },
      },
      required: ["field_key", "field_label", "field_type"],
    },
  },
  {
    name: "timber_delete_field",
    description: "Delete a global catalog field by id. System (dimension) fields cannot be deleted — pricing depends on them (guard mirrors the UI). Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { field_id: { type: "string", description: "catalog_fields UUID." } },
      required: ["field_id"],
    },
  },
  {
    name: "timber_save_field_option",
    description: "Create (omit id) or update (pass id) a select-field option (value + label). Duplicate value on the same field → error. Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Option UUID to update. Omit to create." },
        field_id: { type: "string", description: "Owning catalog_fields UUID." },
        value: { type: "string", description: "Stored value (unique per field)." },
        label: { type: "string", description: "Display label." },
        ref_value_id: { type: "string" },
        description: { type: "string" },
        sort_order: { type: "number" },
        is_active: { type: "boolean" },
      },
      required: ["field_id", "value", "label"],
    },
  },
  {
    name: "timber_delete_field_option",
    description: "Delete a field option by id. Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { option_id: { type: "string", description: "catalog_field_options UUID." } },
      required: ["option_id"],
    },
  },
  {
    name: "timber_save_field_assignment",
    description:
      "Assign a global field to a category (create; omit id) or update its per-category settings (pass id): applies_to ('product' | 'variant' | 'process'), the R6 show flags (show_in_filter / show_in_detail / show_in_price_list), is_required, sort_order. A field already assigned to the category → duplicate error. Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Assignment UUID to update. Omit to create." },
        category_id: { type: "string" },
        field_id: { type: "string" },
        applies_to: { type: "string", enum: ["product", "variant", "process"], description: "Field scope." },
        show_in_filter: { type: "boolean" },
        show_in_detail: { type: "boolean" },
        show_in_price_list: { type: "boolean" },
        is_required: { type: "boolean" },
        sort_order: { type: "number" },
      },
      required: ["category_id", "field_id", "applies_to"],
    },
  },
  {
    name: "timber_remove_field_assignment",
    description: "Remove a field-to-category assignment by its assignment id. Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { assignment_id: { type: "string", description: "catalog_category_field_assignments UUID." } },
      required: ["assignment_id"],
    },
  },

  // ── T6: products (+ bulk) ───────────────────────────────────────────────────
  {
    name: "timber_save_product",
    description:
      "Create (omit id) or update (pass id) a catalog product. category_id + slug + name required; slug is unique per category (duplicate → error). Optional field_values replace ALL of the product's field values. Admin-only, FULL token. Does NOT re-derive non-EUR prices.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Product UUID to update. Omit to create." },
        category_id: { type: "string" },
        slug: { type: "string", description: "Unique per category." },
        name: { type: "string" },
        description: { type: "string" },
        base_price_eur_cents: { type: "number" },
        is_active: { type: "boolean" },
        visible_agents: { type: "boolean" },
        visible_internal: { type: "boolean" },
        visible_marketing: { type: "boolean" },
        sort_order: { type: "number" },
        field_values: {
          type: "array",
          description: "Full replacement set of the product's field values.",
          items: {
            type: "object",
            properties: {
              field_id: { type: "string" },
              option_id: { type: "string" },
              value_text: { type: "string" },
              value_number: { type: "number" },
            },
            required: ["field_id"],
          },
        },
      },
      required: ["category_id", "slug", "name"],
    },
  },
  {
    name: "timber_duplicate_product",
    description: "Duplicate a product (slug '-copy', name '(Copy)', created inactive) including its field values AND all variants (with their field values). Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "string", description: "Source product UUID." } },
      required: ["product_id"],
    },
  },
  {
    name: "timber_delete_product",
    description: "Delete a product by id. Fails if it still has variants (remove them first — guard mirrors the UI). Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "string", description: "catalog_products UUID." } },
      required: ["product_id"],
    },
  },
  {
    name: "timber_bulk_product_action",
    description:
      "Apply ONE batched action to many products. action = 'delete' (DESTRUCTIVE — deletes the products AND their variants) | 'set_active' (needs is_active) | 'set_visibility' (needs visibility, only the given surfaces change) | 'move_to_category' (needs target_category_id; slug collision in the target → error). Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "'delete' | 'set_active' | 'set_visibility' | 'move_to_category'." },
        product_ids: { type: "array", items: { type: "string" }, description: "Product UUIDs to act on." },
        is_active: { type: "boolean", description: "Required for action 'set_active'." },
        visibility: {
          type: "object",
          description: "Required for 'set_visibility' — only the given surfaces are written.",
          properties: {
            visible_agents: { type: "boolean" },
            visible_internal: { type: "boolean" },
            visible_marketing: { type: "boolean" },
          },
        },
        target_category_id: { type: "string", description: "Required for 'move_to_category'." },
      },
      required: ["action", "product_ids"],
    },
  },

  // ── T6: variants ────────────────────────────────────────────────────────────
  {
    name: "timber_save_variant",
    description:
      "Create (omit id) or update (pass id) a product variant: dimensions (thickness/width/length + min/max length in mm), price_eur_cents, stock_unit ('piece' | 'package'), sku, active, sort order. Optional field_values replace ALL of the variant's field values. Admin-only, FULL token. Does NOT re-derive non-EUR prices.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Variant UUID to update. Omit to create." },
        product_id: { type: "string" },
        sku: { type: "string" },
        thickness_mm: { type: "number" },
        width_mm: { type: "number" },
        length_mm: { type: "number" },
        length_min_mm: { type: "number" },
        length_max_mm: { type: "number" },
        price_eur_cents: { type: "number" },
        stock_quantity: { type: "number" },
        stock_unit: { type: "string", description: "'piece' | 'package'." },
        is_active: { type: "boolean" },
        sort_order: { type: "number" },
        field_values: {
          type: "array",
          description: "Full replacement set of the variant's field values.",
          items: {
            type: "object",
            properties: {
              field_id: { type: "string" },
              option_id: { type: "string" },
              value_text: { type: "string" },
              value_number: { type: "number" },
            },
            required: ["field_id"],
          },
        },
      },
      required: ["product_id"],
    },
  },
  {
    name: "timber_delete_variant",
    description: "Delete a variant by id (its stock, images, field values, packaging assignments cascade). Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { variant_id: { type: "string", description: "catalog_variants UUID." } },
      required: ["variant_id"],
    },
  },

  // ── T6: packaging types + variant packaging ─────────────────────────────────
  {
    name: "timber_save_packaging_type",
    description: "Create (omit id) or update (pass id) a GLOBAL packaging type (name + pieces_per_package). Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Packaging type UUID to update. Omit to create." },
        name: { type: "string" },
        pieces_per_package: { type: "number", description: "Pieces contained in one package of this form." },
        description: { type: "string" },
        is_active: { type: "boolean" },
        sort_order: { type: "number" },
      },
      required: ["name", "pieces_per_package"],
    },
  },
  {
    name: "timber_delete_packaging_type",
    description: "Delete a global packaging type by id. Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { packaging_type_id: { type: "string", description: "catalog_packaging_types UUID." } },
      required: ["packaging_type_id"],
    },
  },
  {
    name: "timber_assign_variant_packaging",
    description:
      "Assign a packaging form to a variant (or update its price override / default). Upserts by (variant, packaging form). is_default:true clears any other default on the variant. This is what makes a form eligible to hold stock (see timber_set_variant_stock's guard). Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        variant_id: { type: "string" },
        packaging_type_id: { type: "string" },
        price_override_cents: { type: "number", description: "Per-package price override in cents (or null)." },
        is_default: { type: "boolean", description: "Make this the variant's default packaging form." },
      },
      required: ["variant_id", "packaging_type_id"],
    },
  },
  {
    name: "timber_remove_variant_packaging",
    description: "Remove a variant↔packaging assignment by its assignment id. Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { assignment_id: { type: "string", description: "catalog_variant_packaging_assignments UUID." } },
      required: ["assignment_id"],
    },
  },

  // ── T6: currencies + derived prices ─────────────────────────────────────────
  {
    name: "timber_list_currencies",
    description: "List catalog currencies: code, name, symbol, is_base, exchange_rate + source + fetched-at, rounding rule, active, sort order. Read-only.",
    readOnly: true,
    lifecycle: "catalog",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "timber_get_catalog_currency_prices",
    description:
      "Get the stored derived-currency prices for a set of catalog entities (categories/products/variants). Returns a map keyed 'entityType:entityId' → { currencyCode: { priceCents, isManual } }. Read-only.",
    readOnly: true,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { entity_ids: { type: "array", items: { type: "string" }, description: "Entity UUIDs (category/product/variant ids)." } },
      required: ["entity_ids"],
    },
  },
  {
    name: "timber_save_currency",
    description:
      "Create or update (upsert by code) a catalog currency: code (e.g. 'GBP'), name, symbol, optional rounding_rule, active, sort order. is_base is never set here (EUR is the seeded base). Admin-only, FULL token. Run timber_update_currency_prices to (re)compute its derived prices.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "ISO-ish currency code, e.g. 'GBP' (upper-cased)." },
        name: { type: "string" },
        symbol: { type: "string" },
        rounding_rule: { type: "object", description: "Optional charm-rounding rule ({ bands: [...] })." },
        is_active: { type: "boolean" },
        sort_order: { type: "number" },
      },
      required: ["code", "name", "symbol"],
    },
  },
  {
    name: "timber_delete_currency",
    description: "Delete a catalog currency by code. The base currency (EUR) cannot be deleted (guard mirrors the UI). Its derived prices cascade. Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string", description: "Currency code to delete (not the base EUR)." } },
      required: ["code"],
    },
  },
  {
    name: "timber_update_currency_prices",
    description:
      "Fetch the latest ECB EUR→code daily reference rate, store it on the currency, then recompute + replace every AUTO (non-manual) derived price for that currency across categories/products/variants (manual overrides preserved). The base currency needs no conversion. Returns { rate, updated, fetchedAt }. Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string", description: "Non-base currency code to refresh (e.g. 'GBP')." } },
      required: ["code"],
    },
  },
  {
    name: "timber_set_variant_currency_override",
    description:
      "Hand-set (or clear) a variant's price in a derived currency. price_cents = the manual price in that currency's cents; pass null (or omit) to CLEAR the override so the variant falls back to the auto-computed price. Admin-only, FULL token.",
    readOnly: false,
    lifecycle: "catalog",
    inputSchema: {
      type: "object",
      properties: {
        variant_id: { type: "string" },
        currency_code: { type: "string" },
        price_cents: { type: ["number", "null"], description: "Manual price in the currency's cents; null clears the override." },
      },
      required: ["variant_id", "currency_code"],
    },
  },
];

/** T2 · WRITE capabilities for this domain.
 *  - timber_set_variant_stock keeps its existing "catalogue" cap (variant-stock
 *    upsert — the catalogue.view module gate it shipped with).
 *  - EVERY T6 catalog-authoring write + the T3 stock DELETE carry "admin": all
 *    catalog write tables are RLS-walled to platform admins, so a non-admin user
 *    key is refused here (deny-by-default → FORBIDDEN) and blocked again at the DB.
 *    (Note the deliberate asymmetry with set_variant_stock's looser "catalogue"
 *    cap on the same admin-only-RLS table — see the T6 authz finding.) */
export const catalogCaps: Record<string, UserWriteCapability> = {
  timber_set_variant_stock: "catalogue",
  timber_delete_variant_stock: "admin",
  // categories
  timber_save_category: "admin",
  timber_duplicate_category: "admin",
  timber_delete_category: "admin",
  // fields + options + assignments
  timber_save_field: "admin",
  timber_delete_field: "admin",
  timber_save_field_option: "admin",
  timber_delete_field_option: "admin",
  timber_save_field_assignment: "admin",
  timber_remove_field_assignment: "admin",
  // products (+ bulk)
  timber_save_product: "admin",
  timber_duplicate_product: "admin",
  timber_delete_product: "admin",
  timber_bulk_product_action: "admin",
  // variants
  timber_save_variant: "admin",
  timber_delete_variant: "admin",
  // packaging types + variant packaging
  timber_save_packaging_type: "admin",
  timber_delete_packaging_type: "admin",
  timber_assign_variant_packaging: "admin",
  timber_remove_variant_packaging: "admin",
  // currencies + derived prices
  timber_save_currency: "admin",
  timber_delete_currency: "admin",
  timber_update_currency_prices: "admin",
  timber_set_variant_currency_override: "admin",
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

/** Map the MCP snake_case field_values arg → the service's FieldValueInput[]
 *  (camelCase). Undefined stays undefined so saveProduct/saveVariant leave existing
 *  field values untouched (they only replace when a non-empty array is passed). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFieldValues(fvs: any): { fieldId: string; optionId?: string | null; valueText?: string | null; valueNumber?: number | null; valueStoragePath?: string | null; valueFileName?: string | null; valueMimeType?: string | null; valueFileSizeBytes?: number | null }[] | undefined {
  if (!Array.isArray(fvs)) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fvs.map((fv: any) => ({
    fieldId: fv.field_id,
    optionId: fv.option_id ?? null,
    valueText: fv.value_text ?? null,
    valueNumber: fv.value_number ?? null,
    valueStoragePath: fv.value_storage_path ?? null,
    valueFileName: fv.value_file_name ?? null,
    valueMimeType: fv.value_mime_type ?? null,
    valueFileSizeBytes: fv.value_file_size_bytes ?? null,
  }));
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

  // ── T3: variant stock delete ────────────────────────────────────────────────
  timber_delete_variant_stock: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.stock_entry_id || !UUID_RE.test(args.stock_entry_id)) return toolErr("stock_entry_id (UUID) is required");
    const res = await deleteVariantStockEntry(db, args.stock_entry_id);
    return res.success ? toolOk({ deleted: true }) : toolErr(res.error);
  },

  // ── T6: categories ──────────────────────────────────────────────────────────
  timber_list_categories: async (_args, ctx) => {
    const res = await listCategories(ctx.db);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_get_category: async (args, ctx) => {
    const { db } = ctx;
    const cat = await resolveCategoryId(db, args);
    if (!cat.ok) return toolErr(cat.error);
    const res = await getCategoryService(db, cat.id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_save_category: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.slug || !args?.name || !args?.primary_unit) return toolErr("slug, name and primary_unit are required");
    const res = await saveCategory(db, {
      id: args.id ?? undefined,
      slug: args.slug,
      name: args.name,
      description: args.description ?? null,
      primaryUnit: args.primary_unit,
      defaultPriceEurCents: args.default_price_eur_cents ?? null,
      commissionStandardPct: args.commission_standard_pct ?? null,
      commissionMaxDiscountPct: args.commission_max_discount_pct ?? null,
      commissionDiscountedPct: args.commission_discounted_pct ?? null,
      isActive: args.is_active,
      visibleAgents: args.visible_agents,
      visibleInternal: args.visible_internal,
      visibleMarketing: args.visible_marketing,
      sortOrder: args.sort_order,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_duplicate_category: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.category_id || !UUID_RE.test(args.category_id)) return toolErr("category_id (UUID) is required");
    const res = await duplicateCategory(db, args.category_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_delete_category: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.category_id || !UUID_RE.test(args.category_id)) return toolErr("category_id (UUID) is required");
    const res = await deleteCategory(db, args.category_id);
    return res.success ? toolOk({ deleted: true }) : toolErr(res.error);
  },

  // ── T6: fields + options + assignments ──────────────────────────────────────
  timber_save_field: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.field_key || !args?.field_label || !args?.field_type) return toolErr("field_key, field_label and field_type are required");
    const res = await saveField(db, {
      id: args.id ?? undefined,
      fieldKey: args.field_key,
      fieldLabel: args.field_label,
      fieldType: args.field_type,
      unit: args.unit ?? null,
      refTable: args.ref_table ?? null,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_delete_field: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.field_id || !UUID_RE.test(args.field_id)) return toolErr("field_id (UUID) is required");
    const res = await deleteField(db, args.field_id);
    return res.success ? toolOk({ deleted: true }) : toolErr(res.error);
  },
  timber_save_field_option: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.field_id || !args?.value || !args?.label) return toolErr("field_id, value and label are required");
    const res = await saveFieldOption(db, {
      id: args.id ?? undefined,
      fieldId: args.field_id,
      value: args.value,
      label: args.label,
      refValueId: args.ref_value_id ?? null,
      description: args.description ?? null,
      sortOrder: args.sort_order,
      isActive: args.is_active,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_delete_field_option: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.option_id || !UUID_RE.test(args.option_id)) return toolErr("option_id (UUID) is required");
    const res = await deleteFieldOption(db, args.option_id);
    return res.success ? toolOk({ deleted: true }) : toolErr(res.error);
  },
  timber_save_field_assignment: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.category_id || !args?.field_id || !args?.applies_to) return toolErr("category_id, field_id and applies_to are required");
    const res = await saveFieldAssignment(db, {
      id: args.id ?? undefined,
      categoryId: args.category_id,
      fieldId: args.field_id,
      appliesTo: args.applies_to,
      showInFilter: args.show_in_filter,
      showInDetail: args.show_in_detail,
      showInPriceList: args.show_in_price_list,
      isRequired: args.is_required,
      sortOrder: args.sort_order,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_remove_field_assignment: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.assignment_id || !UUID_RE.test(args.assignment_id)) return toolErr("assignment_id (UUID) is required");
    const res = await removeFieldAssignment(db, args.assignment_id);
    return res.success ? toolOk({ removed: true }) : toolErr(res.error);
  },

  // ── T6: products (+ bulk) ───────────────────────────────────────────────────
  timber_save_product: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.category_id || !args?.slug || !args?.name) return toolErr("category_id, slug and name are required");
    const res = await saveProduct(db, {
      id: args.id ?? undefined,
      categoryId: args.category_id,
      slug: args.slug,
      name: args.name,
      description: args.description ?? null,
      basePriceEurCents: args.base_price_eur_cents ?? null,
      isActive: args.is_active,
      visibleAgents: args.visible_agents,
      visibleInternal: args.visible_internal,
      visibleMarketing: args.visible_marketing,
      sortOrder: args.sort_order,
      fieldValues: mapFieldValues(args.field_values),
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_duplicate_product: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.product_id || !UUID_RE.test(args.product_id)) return toolErr("product_id (UUID) is required");
    const res = await duplicateProduct(db, args.product_id);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_delete_product: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.product_id || !UUID_RE.test(args.product_id)) return toolErr("product_id (UUID) is required");
    const res = await deleteProduct(db, args.product_id);
    return res.success ? toolOk({ deleted: true }) : toolErr(res.error);
  },
  timber_bulk_product_action: async (args, ctx) => {
    const { db } = ctx;
    const action = args?.action;
    const ids: string[] = Array.isArray(args?.product_ids) ? args.product_ids : [];
    if (!action) return toolErr("action is required ('delete' | 'set_active' | 'set_visibility' | 'move_to_category')");
    if (ids.length === 0) return toolErr("product_ids (non-empty array) is required");
    switch (action) {
      case "delete": {
        const res = await bulkDeleteProducts(db, ids);
        return res.success ? toolOk(res.data) : toolErr(res.error);
      }
      case "set_active": {
        if (typeof args?.is_active !== "boolean") return toolErr("is_active (boolean) is required for action 'set_active'");
        const res = await bulkSetProductsActive(db, ids, args.is_active);
        return res.success ? toolOk(res.data) : toolErr(res.error);
      }
      case "set_visibility": {
        const v = args?.visibility ?? {};
        const res = await bulkSetProductsVisibility(db, ids, {
          visibleAgents: v.visible_agents,
          visibleInternal: v.visible_internal,
          visibleMarketing: v.visible_marketing,
        });
        return res.success ? toolOk(res.data) : toolErr(res.error);
      }
      case "move_to_category": {
        if (!args?.target_category_id) return toolErr("target_category_id is required for action 'move_to_category'");
        const res = await bulkMoveProductsToCategory(db, ids, args.target_category_id);
        return res.success ? toolOk(res.data) : toolErr(res.error);
      }
      default:
        return toolErr(`Unknown action "${action}" — use 'delete' | 'set_active' | 'set_visibility' | 'move_to_category'`);
    }
  },

  // ── T6: variants ────────────────────────────────────────────────────────────
  timber_save_variant: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.product_id) return toolErr("product_id is required");
    const res = await saveVariant(db, {
      id: args.id ?? undefined,
      productId: args.product_id,
      sku: args.sku ?? null,
      thicknessMm: args.thickness_mm ?? null,
      widthMm: args.width_mm ?? null,
      lengthMm: args.length_mm ?? null,
      lengthMinMm: args.length_min_mm ?? null,
      lengthMaxMm: args.length_max_mm ?? null,
      priceEurCents: args.price_eur_cents ?? null,
      stockQuantity: args.stock_quantity ?? null,
      stockUnit: args.stock_unit,
      isActive: args.is_active,
      sortOrder: args.sort_order,
      fieldValues: mapFieldValues(args.field_values),
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_delete_variant: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.variant_id || !UUID_RE.test(args.variant_id)) return toolErr("variant_id (UUID) is required");
    const res = await deleteVariant(db, args.variant_id);
    return res.success ? toolOk({ deleted: true }) : toolErr(res.error);
  },

  // ── T6: packaging types + variant packaging ─────────────────────────────────
  timber_save_packaging_type: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.name || typeof args?.pieces_per_package !== "number") return toolErr("name and pieces_per_package (number) are required");
    const res = await savePackagingType(db, {
      id: args.id ?? undefined,
      name: args.name,
      piecesPerPackage: args.pieces_per_package,
      description: args.description ?? null,
      isActive: args.is_active,
      sortOrder: args.sort_order,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_delete_packaging_type: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.packaging_type_id || !UUID_RE.test(args.packaging_type_id)) return toolErr("packaging_type_id (UUID) is required");
    const res = await deletePackagingType(db, args.packaging_type_id);
    return res.success ? toolOk({ deleted: true }) : toolErr(res.error);
  },
  timber_assign_variant_packaging: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.variant_id || !args?.packaging_type_id) return toolErr("variant_id and packaging_type_id are required");
    const res = await assignVariantPackaging(db, {
      variantId: args.variant_id,
      packagingTypeId: args.packaging_type_id,
      priceOverrideCents: args.price_override_cents ?? null,
      isDefault: args.is_default,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_remove_variant_packaging: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.assignment_id || !UUID_RE.test(args.assignment_id)) return toolErr("assignment_id (UUID) is required");
    const res = await removeVariantPackaging(db, args.assignment_id);
    return res.success ? toolOk({ removed: true }) : toolErr(res.error);
  },

  // ── T6: currencies + derived prices ─────────────────────────────────────────
  timber_list_currencies: async (_args, ctx) => {
    const res = await listCurrencies(ctx.db);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_get_catalog_currency_prices: async (args, ctx) => {
    const { db } = ctx;
    if (!Array.isArray(args?.entity_ids)) return toolErr("entity_ids (array of UUIDs) is required");
    const res = await getCatalogCurrencyPrices(db, args.entity_ids);
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_save_currency: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.code || !args?.name || !args?.symbol) return toolErr("code, name and symbol are required");
    const res = await saveCurrency(db, {
      code: args.code,
      name: args.name,
      symbol: args.symbol,
      roundingRule: args.rounding_rule ?? null,
      isActive: args.is_active,
      sortOrder: args.sort_order,
    });
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_delete_currency: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.code) return toolErr("code is required");
    const res = await deleteCurrency(db, String(args.code).trim().toUpperCase());
    return res.success ? toolOk({ deleted: true }) : toolErr(res.error);
  },
  timber_update_currency_prices: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.code) return toolErr("code is required");
    const res = await updateCurrencyPrices(db, String(args.code).trim().toUpperCase());
    return res.success ? toolOk(res.data) : toolErr(res.error);
  },
  timber_set_variant_currency_override: async (args, ctx) => {
    const { db } = ctx;
    if (!args?.variant_id || !args?.currency_code) return toolErr("variant_id and currency_code are required");
    const priceCents = args.price_cents == null ? null : args.price_cents;
    if (priceCents != null && typeof priceCents !== "number") return toolErr("price_cents must be a number or null");
    const res = await setVariantCurrencyOverride(db, args.variant_id, String(args.currency_code).trim().toUpperCase(), priceCents);
    return res.success ? toolOk({ ok: true }) : toolErr(res.error);
  },
};
