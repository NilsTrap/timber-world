/**
 * UK Staircase Pricing Types
 */

export type ProductType = "FJ" | "FS" | "FJFS";

/**
 * Database row representation (stored values only)
 */
export interface PricingItemDb {
  id: string;
  code: string;
  name: string;
  product_type: ProductType;
  thickness_mm: number;
  width_mm: number;
  riser_mm: number | null;
  length_mm: number;
  eur_per_m3_cents: number;
  work_cost_cents: number;
  transport_cost_cents: number;
  gbp_rate: number; // 9000 = 0.90
  final_price_cents: number; // Final price from PDF
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Client-side row with calculated values and client ID for table editing
 */
export interface PricingRow {
  clientId: string;
  id: string | null; // null for new rows
  code: string;
  name: string;
  productType: ProductType;
  thicknessMm: string;
  widthMm: string;
  riserMm: string;
  lengthMm: string;
  eurPerM3Cents: string; // stored as string for input
  workCostCents: string;
  transportCostCents: string;
  gbpRate: string; // 9000 = 0.90
  isActive: boolean;
  sortOrder: number;
  // Calculated fields (readonly display)
  m3PerPiece: string;
  kgPerPiece: string;
  eurPerPiece: string;
  totalEurCents: string;
  priceGbpCents: string;
  // Final price from PDF
  finalPriceCents: string;
  // Track if row is modified
  isNew: boolean;
  isDeleted: boolean;
}

/**
 * Upsert payload for saving
 */
export interface PricingItemUpsert {
  id?: string;
  code: string;
  name: string;
  product_type: ProductType;
  thickness_mm: number;
  width_mm: number;
  riser_mm: number | null;
  length_mm: number;
  eur_per_m3_cents: number;
  work_cost_cents: number;
  transport_cost_cents: number;
  gbp_rate: number;
  final_price_cents: number;
  is_active: boolean;
  sort_order: number;
}

/**
 * Server action result type
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Global calculation parameters
 */
export interface GlobalParams {
  gbpRate: string; // e.g., "0.90"
  transportRate: string; // EUR per m³, e.g., "300"
  transportFlatEurCents: string; // flat EUR amount added per piece, in cents, e.g., "1100" = 11 EUR
}

export const DEFAULT_GLOBAL_PARAMS: GlobalParams = {
  gbpRate: "0.90",
  transportRate: "300",
  transportFlatEurCents: "1100",
};

/**
 * Calculate m³ per piece from dimensions (all in mm)
 */
export function calculateM3PerPiece(
  thicknessMm: number,
  widthMm: number,
  lengthMm: number,
  riserMm: number = 0,
  name: string = ""
): number {
  // Riser is added to width (e.g. step with riser = width + riser)
  const effectiveWidthMm = widthMm + riserMm;
  // Convert mm³ to m³
  let m3 = (thicknessMm * effectiveWidthMm * lengthMm) / 1_000_000_000;
  // Winders get 0.8 multiplier (irregular shape uses less material)
  if (name.toLowerCase() === "winder") m3 *= 0.8;
  return m3;
}

/**
 * Calculate transport cost in cents from m³ and rate (EUR/m³)
 */
export function calculateTransportCents(m3PerPiece: number, transportRateEur: number): number {
  return Math.round(m3PerPiece * transportRateEur * 100);
}

/**
 * Calculate EUR per piece from m³ and EUR/m³
 */
export function calculateEurPerPieceCents(
  m3PerPiece: number,
  eurPerM3Cents: number
): number {
  return Math.round(m3PerPiece * eurPerM3Cents);
}

/**
 * Calculate total EUR (EUR/piece + work + transport)
 */
export function calculateTotalEurCents(
  eurPerPieceCents: number,
  workCostCents: number,
  transportCostCents: number
): number {
  return eurPerPieceCents + workCostCents + transportCostCents;
}

/**
 * Calculate GBP price from EUR total and rate
 */
export function calculatePriceGbpCents(
  totalEurCents: number,
  gbpRate: number // 9000 = 0.90
): number {
  return Math.round(totalEurCents * (gbpRate / 10000));
}

/**
 * Generate code from name, thickness, type, and length
 */
export function generateCode(row: PricingRow): string {
  const name = row.name || "";
  const thickness = row.thicknessMm || "";
  const type = row.productType || "";
  const length = row.lengthMm || "";
  return `${name}${thickness}${type}${length}`;
}

/**
 * Recalculate all derived fields for a row using global params
 */
export function recalculateRowWithParams(row: PricingRow, params: GlobalParams): PricingRow {
  const thicknessMm = parseFloat(row.thicknessMm) || 0;
  const widthMm = parseFloat(row.widthMm) || 0;
  const lengthMm = parseFloat(row.lengthMm) || 0;
  const eurPerM3Cents = parseFloat(row.eurPerM3Cents) || 0;
  const workCostCents = parseFloat(row.workCostCents) || 0;

  // Parse global params
  const transportRateEur = parseFloat(params.transportRate) || 300;
  const transportFlatCents = parseFloat(params.transportFlatEurCents) || 0;
  const gbpRateDecimal = parseFloat(params.gbpRate) || 0.9;

  const riserMm = parseFloat(row.riserMm) || 0;
  const m3PerPiece = calculateM3PerPiece(thicknessMm, widthMm, lengthMm, riserMm, row.name);
  const transportCostCents = calculateTransportCents(m3PerPiece, transportRateEur) + transportFlatCents;
  const eurPerPieceCents = calculateEurPerPieceCents(m3PerPiece, eurPerM3Cents);
  const totalEurCents = calculateTotalEurCents(
    eurPerPieceCents,
    workCostCents,
    transportCostCents
  );
  const priceGbpCents = Math.round(totalEurCents * gbpRateDecimal);

  return {
    ...row,
    code: generateCode(row),
    transportCostCents: String(transportCostCents),
    m3PerPiece: m3PerPiece.toFixed(6),
    kgPerPiece: (m3PerPiece * 700).toFixed(2),
    eurPerPiece: String(eurPerPieceCents),
    totalEurCents: String(totalEurCents),
    priceGbpCents: String(priceGbpCents),
  };
}

/**
 * Recalculate all derived fields for a row (uses default params)
 */
export function recalculateRow(row: PricingRow): PricingRow {
  return recalculateRowWithParams(row, DEFAULT_GLOBAL_PARAMS);
}

/**
 * Convert database row to client row
 */
export function dbToClientRow(db: PricingItemDb, params: GlobalParams = DEFAULT_GLOBAL_PARAMS): PricingRow {
  const row: PricingRow = {
    clientId: `price-${db.id}`,
    id: db.id,
    code: db.code,
    name: db.name,
    productType: db.product_type,
    thicknessMm: String(db.thickness_mm),
    widthMm: String(db.width_mm),
    riserMm: db.riser_mm !== null ? String(db.riser_mm) : "",
    lengthMm: String(db.length_mm),
    eurPerM3Cents: String(db.eur_per_m3_cents),
    workCostCents: String(db.work_cost_cents),
    transportCostCents: String(db.transport_cost_cents),
    gbpRate: String(db.gbp_rate),
    isActive: db.is_active,
    sortOrder: db.sort_order,
    // Calculated - will be filled by recalculateRowWithParams
    m3PerPiece: "",
    kgPerPiece: "",
    eurPerPiece: "",
    totalEurCents: "",
    priceGbpCents: "",
    finalPriceCents: String(db.final_price_cents || 0),
    isNew: false,
    isDeleted: false,
  };
  return recalculateRowWithParams(row, params);
}

/**
 * Convert client row to upsert payload
 */
export function clientToUpsertPayload(row: PricingRow): PricingItemUpsert {
  return {
    id: row.id ?? undefined,
    code: row.code,
    name: row.name,
    product_type: row.productType,
    thickness_mm: parseInt(row.thicknessMm, 10) || 0,
    width_mm: parseInt(row.widthMm, 10) || 0,
    riser_mm: row.riserMm ? parseInt(row.riserMm, 10) : null,
    length_mm: parseInt(row.lengthMm, 10) || 0,
    eur_per_m3_cents: parseInt(row.eurPerM3Cents, 10) || 0,
    work_cost_cents: parseInt(row.workCostCents, 10) || 0,
    transport_cost_cents: parseInt(row.transportCostCents, 10) || 0,
    gbp_rate: parseInt(row.gbpRate, 10) || 9000,
    final_price_cents: parseInt(row.finalPriceCents, 10) || 0,
    is_active: row.isActive,
    sort_order: row.sortOrder,
  };
}

/**
 * Format cents as currency string with comma decimal separator
 */
export function formatCents(cents: number | string, currency: string = "EUR"): string {
  const value = typeof cents === "string" ? parseFloat(cents) : cents;
  if (isNaN(value)) return "-";
  const amount = value / 100;
  // Use lv locale for comma decimal separator
  return new Intl.NumberFormat("lv", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format number with comma decimal separator
 */
export function formatDecimal(value: number | string, decimals: number = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("lv", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Convert cents to EUR string for input display (200000 -> "2000" or "2000,50")
 */
export function centsToEurInput(cents: string): string {
  const value = parseFloat(cents);
  if (isNaN(value)) return "";
  return String(value / 100).replace(".", ",");
}

/**
 * Convert cents to whole EUR string for input display (200000 -> "2000")
 */
export function centsToWholeEurInput(cents: string): string {
  const value = parseFloat(cents);
  if (isNaN(value)) return "";
  return String(Math.round(value / 100));
}

/**
 * Convert EUR input to cents string ("2000" -> "200000")
 */
export function eurInputToCents(eur: string): string {
  // Handle comma as decimal separator
  const normalized = eur.replace(",", ".");
  const value = parseFloat(normalized);
  if (isNaN(value)) return "";
  return String(Math.round(value * 100));
}

/**
 * Format rate as decimal (9000 -> 0.90)
 */
export function formatRate(rate: number | string): string {
  const value = typeof rate === "string" ? parseFloat(rate) : rate;
  if (isNaN(value)) return "-";
  return (value / 10000).toFixed(4).replace(".", ",");
}
