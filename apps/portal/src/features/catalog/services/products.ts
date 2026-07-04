/**
 * Catalog product/variant read service — `(db, …)`-style projections for the MCP
 * agent surface (admin client), sitting alongside `services/stock.ts` and
 * `services/attributes.ts`. Deliberately COMPACT shapes (products with priced
 * variants; one variant with its packaging + stock) — the admin UI keeps its own
 * richer `actions/{products,variants,packaging}.ts` reads. No writes here: catalog
 * authoring stays in the portal (J4 scope note).
 */
import type { ActionResult } from "../types";
import { isValidUUID } from "@/features/orders/types";
import { getVariantStock, type VariantStockSummary } from "./stock";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

export interface CatalogVariantBrief {
  id: string;
  sku: string | null;
  thicknessMm: number | null;
  widthMm: number | null;
  lengthMm: number | null;
  lengthMinMm: number | null;
  lengthMaxMm: number | null;
  priceEurCents: number | null;
  stockUnit: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CatalogProductWithVariants {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  description: string | null;
  basePriceEurCents: number | null;
  isActive: boolean;
  sortOrder: number;
  variants: CatalogVariantBrief[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVariantBrief(row: any): CatalogVariantBrief {
  return {
    id: row.id,
    sku: row.sku ?? null,
    thicknessMm: row.thickness_mm ?? null,
    widthMm: row.width_mm ?? null,
    lengthMm: row.length_mm ?? null,
    lengthMinMm: row.length_min_mm ?? null,
    lengthMaxMm: row.length_max_mm ?? null,
    priceEurCents: row.price_eur_cents ?? null,
    stockUnit: row.stock_unit ?? "piece",
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? 0,
  };
}

/**
 * List a category's products, each with its variants + per-variant prices.
 * Resolve `categoryId` from a slug first (the route does this) or pass a UUID.
 */
export async function listCatalogProducts(db: DbClient, categoryId: string): Promise<ActionResult<CatalogProductWithVariants[]>> {
  if (!isValidUUID(categoryId)) return { success: false, error: "Invalid category id", code: "VALIDATION_ERROR" };
  const { data, error } = await db
    .from("catalog_products")
    .select(`
      id, category_id, slug, name, description, base_price_eur_cents, is_active, sort_order,
      catalog_variants(
        id, sku, thickness_mm, width_mm, length_mm, length_min_mm, length_max_mm,
        price_eur_cents, stock_unit, is_active, sort_order
      )
    `)
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: true });
  if (error) return { success: false, error: error.message, code: "FETCH_FAILED" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products: CatalogProductWithVariants[] = (data ?? []).map((row: any) => ({
    id: row.id,
    categoryId: row.category_id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    basePriceEurCents: row.base_price_eur_cents ?? null,
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? 0,
    variants: (row.catalog_variants ?? [])
      .map(toVariantBrief)
      .sort((a: CatalogVariantBrief, b: CatalogVariantBrief) => a.sortOrder - b.sortOrder),
  }));
  return { success: true, data: products };
}

export interface CatalogVariantPackaging {
  assignmentId: string;
  packagingTypeId: string;
  name: string;
  piecesPerPackage: number;
  priceOverrideCents: number | null;
  isDefault: boolean;
}

export interface CatalogVariantDetail extends CatalogVariantBrief {
  productId: string;
  product: { id: string; name: string; slug: string; categoryId: string } | null;
  packaging: CatalogVariantPackaging[];
  stock: VariantStockSummary;
}

/**
 * Get one variant's full agent-facing detail: dims + price, its owning product,
 * the packaging forms assigned to it, and its current stock (composed via the
 * stock service). The packaging list is exactly the set stock may be held in
 * (the guard in saveVariantStockEntry).
 */
export async function getCatalogVariant(db: DbClient, variantId: string): Promise<ActionResult<CatalogVariantDetail>> {
  if (!isValidUUID(variantId)) return { success: false, error: "Invalid variant id", code: "VALIDATION_ERROR" };
  const { data: row, error } = await db
    .from("catalog_variants")
    .select(`
      id, product_id, sku, thickness_mm, width_mm, length_mm, length_min_mm, length_max_mm,
      price_eur_cents, stock_unit, is_active, sort_order,
      catalog_products(id, name, slug, category_id),
      catalog_variant_packaging_assignments(
        id, packaging_type_id, price_override_cents, is_default,
        catalog_packaging_types(name, pieces_per_package)
      )
    `)
    .eq("id", variantId)
    .maybeSingle();
  if (error) return { success: false, error: error.message, code: "FETCH_FAILED" };
  if (!row) return { success: false, error: "Variant not found", code: "NOT_FOUND" };

  const stockRes = await getVariantStock(db, variantId);
  if (!stockRes.success) return stockRes;

  const prod = row.catalog_products;
  const packaging: CatalogVariantPackaging[] = (row.catalog_variant_packaging_assignments ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((a: any) => ({
      assignmentId: a.id,
      packagingTypeId: a.packaging_type_id,
      name: a.catalog_packaging_types?.name ?? "",
      piecesPerPackage: a.catalog_packaging_types?.pieces_per_package ?? 0,
      priceOverrideCents: a.price_override_cents ?? null,
      isDefault: a.is_default ?? false,
    }))
    .sort((a: CatalogVariantPackaging, b: CatalogVariantPackaging) => a.piecesPerPackage - b.piecesPerPackage);

  return {
    success: true,
    data: {
      ...toVariantBrief(row),
      productId: row.product_id,
      product: prod ? { id: prod.id, name: prod.name, slug: prod.slug, categoryId: prod.category_id } : null,
      packaging,
      stock: stockRes.data,
    },
  };
}
