/**
 * Deals feature — domain types.
 *
 * The "deal" is the universal trade record (replaces per-product flows). One deal
 * has a SELL side (customer) and a BUY side (producer) — the buy/sell seam.
 */

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Loose Supabase client type. The generated Database types don't include the new
 * `deals*` tables (and `@supabase/supabase-js` isn't a direct portal dep), so
 * service functions accept this and query with the codebase's usual `any` casts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = any;

export type DealKind = "buy_sell" | "sale_only" | "purchase_only";
export type DealStatus =
  | "draft"
  | "quoted"
  | "confirmed"
  | "in_progress"
  | "shipped"
  | "completed"
  | "cancelled";
export type DealSide = "sell" | "buy";
export type Currency = "EUR" | "GBP" | "USD";
export type TransportBilling = "in_price" | "separate_line" | "separate_invoice";
export type LineUnit = "m3" | "m2" | "piece" | "linear_m" | "package";
export type DocType =
  | "sales_spec"
  | "purchase_spec"
  | "contract"
  | "proforma_invoice"
  | "invoice"
  | "packing_list"
  | "cmr";

export const DEAL_STATUSES: DealStatus[] = [
  "draft",
  "quoted",
  "confirmed",
  "in_progress",
  "shipped",
  "completed",
  "cancelled",
];
export const CURRENCIES: Currency[] = ["EUR", "GBP", "USD"];

/**
 * Actor making a service call. The UI passes a session-derived actor; the MCP
 * endpoint passes a service actor. Permission is checked by the CALLER; services
 * trust the actor and use it for audit (created_by / generated_by).
 */
export interface ActorContext {
  portalUserId: string | null;
  isPlatformAdmin: boolean;
  /** True for the Oscar agent / MCP service identity (admin client, RLS-bypassing). */
  isServiceAgent: boolean;
  /** Tagging label for audit, e.g. "oscar-agent". */
  label?: string;
}

export interface PartyRef {
  id: string | null;
  code?: string | null;
  name?: string | null;
}

export interface Deal {
  id: string;
  code: string;
  dealKind: DealKind;
  productGroup: string | null;
  seller: PartyRef;
  customer: PartyRef;
  producer: PartyRef;
  currency: Currency;
  incoterms: string | null;
  incotermsPlace: string | null;
  advancePct: number | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  deliveryDeadline: string | null;
  transportBilling: TransportBilling;
  status: DealStatus;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems?: DealLineItem[];
  externalRefs?: DealExternalRef[];
  documents?: DealDocumentMeta[];
}

export interface DealLineItem {
  id?: string;
  dealId?: string;
  side: DealSide;
  lineNo: number;
  productName: string | null;
  woodSpecies: string | null;
  humidity: string | null;
  processing: string | null;
  quality: string | null;
  gradeNote: string | null;
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
}

export interface DealExternalRef {
  id?: string;
  dealId?: string;
  refType: "client_project" | "client_job" | "client_po" | "other";
  refValue: string;
  label: string | null;
}

export interface DealDocumentMeta {
  id: string;
  dealId: string;
  docType: DocType;
  side: DealSide;
  docNumber: string;
  status: "draft" | "issued";
  storagePath: string | null;
  fileName: string | null;
  createdAt: string;
}

export interface CreateDealInput {
  productGroup?: string | null;
  dealKind?: DealKind;
  sellerOrganisationId?: string | null;
  customerOrganisationId?: string | null;
  producerOrganisationId?: string | null;
  currency?: Currency;
  incoterms?: string | null;
  incotermsPlace?: string | null;
  advancePct?: number | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  deliveryDeadline?: string | null;
  transportBilling?: TransportBilling;
  notes?: string | null;
  /** Optional human-readable customer name used for the deal code when no org row. */
  customerNameForCode?: string | null;
  /** Idempotency key (stored as an external ref of type "other") to dedupe MCP creates. */
  idempotencyKey?: string | null;
  lineItems?: Partial<DealLineItem>[];
  externalRefs?: DealExternalRef[];
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}
