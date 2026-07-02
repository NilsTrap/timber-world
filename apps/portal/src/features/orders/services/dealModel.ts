/**
 * Universal deal model types — the `orders` table extended into the canonical
 * deal (Oscar-integration phase). Shared by the order-deal service, the document
 * data assembly, and the MCP route.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = any;

export type DealSide = "sell" | "buy";
export type DealKind = "buy_sell" | "sale_only" | "purchase_only";
export type TransportBilling = "in_price" | "separate_line" | "separate_invoice";
export type LineUnit = "m3" | "m2" | "piece" | "linear_m" | "package" | "crate" | "loose_m3";
export type DocType =
  | "sales_spec"
  | "purchase_spec"
  | "contract"
  | "proforma_invoice"
  | "invoice"
  | "packing_list"
  | "cmr";

export interface ActorContext {
  portalUserId: string | null;
  isPlatformAdmin: boolean;
  isServiceAgent: boolean;
  label?: string;
}

export interface OrderLineItem {
  id?: string;
  orderId?: string;
  side: DealSide;
  lineNo: number;
  productName: string | null;
  woodSpecies: string | null;
  humidity: string | null;
  processing: string | null;
  quality: string | null;
  productType: string | null;
  gradeNote: string | null;
  productNameOptionId: string | null;
  woodSpeciesOptionId: string | null;
  humidityOptionId: string | null;
  processingOptionId: string | null;
  qualityOptionId: string | null;
  productTypeOptionId: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
  unit: LineUnit;
  unitPriceCents: number | null;
  vatRate: number | null;
  lineTotalCents: number | null;
  notes: string | null;
  /** E5: catalog linkage. Set when the line was picked from the catalog
   * (standard product, auto-priced); null for a non-standard per-deal line. */
  catalogProductId: string | null;
  catalogVariantId: string | null;
  isStandard: boolean;
}

export interface OrderExternalRef {
  id?: string;
  orderId?: string;
  refType: "client_project" | "client_job" | "client_po" | "other";
  refValue: string;
  label: string | null;
}

export interface OrderDocumentMeta {
  id: string;
  orderId: string;
  docType: DocType;
  side: DealSide;
  docNumber: string;
  status: "draft" | "issued";
  storagePath: string | null;
  fileName: string | null;
  oscarDocId: string | null;
  oscarDocUrl: string | null;
  createdAt: string;
}

/** Universal deal-level fields layered onto `orders`. */
export interface DealFieldsPatch {
  dealKind?: DealKind;
  productGroup?: string | null;
  incoterms?: string | null;
  incotermsPlace?: string | null;
  advancePct?: number | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  deliveryDeadline?: string | null;
  transportBilling?: TransportBilling;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapLineItem(row: any): OrderLineItem {
  return {
    id: row.id,
    orderId: row.order_id,
    side: row.side,
    lineNo: row.line_no,
    productName: row.product_name ?? null,
    woodSpecies: row.wood_species ?? null,
    humidity: row.humidity ?? null,
    processing: row.processing ?? null,
    quality: row.quality ?? null,
    productType: row.product_type ?? null,
    gradeNote: row.grade_note ?? null,
    productNameOptionId: row.product_name_option_id ?? null,
    woodSpeciesOptionId: row.wood_species_option_id ?? null,
    humidityOptionId: row.humidity_option_id ?? null,
    processingOptionId: row.processing_option_id ?? null,
    qualityOptionId: row.quality_option_id ?? null,
    productTypeOptionId: row.product_type_option_id ?? null,
    thickness: row.thickness ?? null,
    width: row.width ?? null,
    length: row.length ?? null,
    pieces: row.pieces ?? null,
    volumeM3: row.volume_m3 != null ? Number(row.volume_m3) : null,
    unit: row.unit,
    unitPriceCents: row.unit_price_cents ?? null,
    vatRate: row.vat_rate != null ? Number(row.vat_rate) : null,
    lineTotalCents: row.line_total_cents ?? null,
    notes: row.notes ?? null,
    catalogProductId: row.catalog_product_id ?? null,
    catalogVariantId: row.catalog_variant_id ?? null,
    isStandard: row.is_standard ?? false,
  };
}

export function lineItemToRow(orderId: string, it: Partial<OrderLineItem>, index: number) {
  return {
    order_id: orderId,
    side: it.side ?? "sell",
    line_no: it.lineNo ?? index + 1,
    product_name: it.productName ?? null,
    wood_species: it.woodSpecies ?? null,
    humidity: it.humidity ?? null,
    processing: it.processing ?? null,
    quality: it.quality ?? null,
    product_type: it.productType ?? null,
    grade_note: it.gradeNote ?? null,
    product_name_option_id: it.productNameOptionId ?? null,
    wood_species_option_id: it.woodSpeciesOptionId ?? null,
    humidity_option_id: it.humidityOptionId ?? null,
    processing_option_id: it.processingOptionId ?? null,
    quality_option_id: it.qualityOptionId ?? null,
    product_type_option_id: it.productTypeOptionId ?? null,
    thickness: it.thickness ?? null,
    width: it.width ?? null,
    length: it.length ?? null,
    pieces: it.pieces ?? null,
    volume_m3: it.volumeM3 ?? null,
    unit: it.unit ?? "m3",
    unit_price_cents: it.unitPriceCents ?? null,
    vat_rate: it.vatRate ?? null,
    line_total_cents: it.lineTotalCents ?? null,
    notes: it.notes ?? null,
    catalog_product_id: it.catalogProductId ?? null,
    catalog_variant_id: it.catalogVariantId ?? null,
    is_standard: it.isStandard ?? false,
  };
}
