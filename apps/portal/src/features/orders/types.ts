/**
 * Orders Types
 *
 * Types for managing orders in the platform.
 */

/**
 * Order status enum
 */
export type OrderStatus =
  | "draft"
  | "confirmed"
  | "loaded";

/**
 * Order as stored in the database
 */
export interface Order {
  id: string;
  name: string;
  projectNumber: string | null;
  /** Derived summary e.g. "FJ110, FS40" from ordered products' type + thickness */
  typeSummary: string | null;
  /** Count of tread products (pieces) */
  treads: number;
  /** Count of unique winder products */
  winders: number;
  /** Count of unique quarter products */
  quarters: number;
  /** Total pieces across all ordered products */
  totalPieces: number;
  /** Tread length in mm (manually entered) */
  treadLength: string | null;
  /** Total price in pence (computed from order products) */
  totalPricePence: number;
  /** Total kg (computed from order products: sum of m³ × 700 × pcs) */
  totalKg: number;
  /** Maximum m³ (total of all package volumes from detail) */
  maxM3: number;
  /** Produced tread volume in m³ */
  treadM3: number;
  /** Produced winder volume in m³ */
  winderM3: number;
  /** Produced quarter volume in m³ */
  quarterM3: number;
  /** Total produced volume in m³ (tread + winder + quarter) */
  totalProducedM3: number;
  /** Used material volume in m³ (from production inputs) */
  usedMaterialM3: number;
  /** Waste volume in m³ (used material - total produced) */
  wasteM3: number;
  /** Waste percentage (waste / used material × 100) */
  wastePercent: number;
  /** Production cost fields */
  productionMaterial: number;
  productionWork: number;
  productionFinishing: number;
  productionTotal: number;
  productionInvoiceNumber: string | null;
  productionPaymentDate: string | null;
  /** Wood art cost fields */
  woodArt: number;
  glowing: number;
  woodArtCnc: number;
  woodArtTotal: number;
  woodArtInvoiceNumber: string | null;
  woodArtPaymentDate: string | null;
  /** Advance invoice number */
  advanceInvoiceNumber: string | null;
  /** Invoice number */
  invoiceNumber: string | null;
  /** Package number (shipping/tracking) */
  packageNumber: string | null;
  /** Transport invoice number */
  transportInvoiceNumber: string | null;
  /** Transport price */
  transportPrice: string | null;
  /** Customer (buyer) organisation */
  customerOrganisationId: string;
  customerOrganisationName?: string;
  customerOrganisationCode?: string;
  /** Seller (trading company) organisation */
  sellerOrganisationId: string | null;
  sellerOrganisationName?: string;
  sellerOrganisationCode?: string;
  /** Producer (manufacturer) organisation */
  producerOrganisationId: string | null;
  producerOrganisationName?: string;
  producerOrganisationCode?: string;
  /** Planned production date */
  plannedDate: string | null;
  /** EUR per m³ from staircase pricing (first product row) */
  eurPerM3: number;
  /** Work cost per piece from staircase pricing (first product row) */
  workPerPiece: number;
  /** Invoiced work = sum of workPerPiece × pieces per package */
  invoicedWork: number;
  /** Used work = finishing + woodArt + woodArtCnc */
  usedWork: number;
  /** PL Material = diff_m3 × eurPerM3 × 0.70 */
  plMaterialValue: number;
  /** PL Work = invoicedWork - usedWork */
  plWorkValue: number;
  /** Invoiced transport = sum of (vol × 300 + 11) × pieces per package */
  invoicedTransport: number;
  /** Used transport = transport_price from order */
  usedTransport: number;
  /** PL Transport = invoicedTransport - usedTransport */
  plTransportValue: number;
  /** PL Materials = invoiced_m3 × eurPerM3 × 0.30 */
  plMaterialsValue: number;
  /** PL Total = plMaterial + plWork + plTransport + plMaterials */
  plTotalValue: number;
  /** PL % from invoice = plTotal / (totalPrice GBP × 0.9) × 100 */
  plPercentFromInvoice: number;
  dateReceived: string;
  dateLoaded: string | null;
  volumeM3: number | null;
  valueCents: number | null;
  currency: "EUR" | "GBP" | "USD";
  status: OrderStatus;
  notes: string | null;
  createdBy: string | null;
  /** Creator name for display */
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  /** Number of attached files */
  fileCount: number;
}

/**
 * Server action result type
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * UUID validation regex pattern
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Status badge variant mapping
 */
export function getStatusBadgeVariant(
  status: OrderStatus
): "outline" | "secondary" | "default" | "success" {
  switch (status) {
    case "draft":
      return "outline";
    case "confirmed":
      return "default";
    case "loaded":
      return "success";
    default:
      return "outline";
  }
}

/**
 * Status display labels
 */
export function getStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "confirmed":
      return "Confirmed";
    case "loaded":
      return "Loaded";
    default:
      return status;
  }
}

/**
 * All order statuses in order
 */
export const ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "confirmed",
  "loaded",
];

/**
 * Currency options
 */
export const CURRENCIES = ["EUR", "GBP", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

/**
 * Order file category
 */
export type OrderFileCategory = "customer" | "production";

/**
 * Order file attachment
 */
export interface OrderFile {
  id: string;
  orderId: string;
  category: OrderFileCategory;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadedByName: string | null;
  isThumbnail: boolean;
  createdAt: string;
}

/**
 * Client-side order product row for DataEntryTable editing
 */
export interface OrderProductRow {
  clientId: string;
  dbId: string | null;
  staircaseCodeId: string;
  productNameId: string;
  woodSpeciesId: string;
  typeId: string;
  qualityId: string;
  thickness: string;
  width: string;
  riser: string;
  length: string;
  pieces: string;
  volumeM3: string;
  /** Work cost per piece in EUR (e.g. "28.00") */
  workPerPiece: string;
  /** Transport cost per piece in EUR (e.g. "20.24") */
  transportPerPiece: string;
  /** EUR per m³ price (e.g. "850.00") */
  eurPerM3: string;
  /** EUR per piece = m³/pc × EUR/m³ (e.g. "12.50") */
  eurPerPiece: string;
  unitPrice: string;
}

