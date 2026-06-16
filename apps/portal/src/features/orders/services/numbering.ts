/**
 * Deal & document numbering — Nils's conventions (salvaged from the deals build,
 * now canonical on orders). Pure formatters + an atomic allocator that calls the
 * SQL `next_counter(scope)` function. Purchase and sale series stay separate.
 */
import type { DbClient, DocType } from "./dealModel";

/** First 3 alphabetic chars of a name, uppercased; "XXX" fallback. */
export function clientCodeFromName(name: string | null | undefined): string {
  const letters = (name ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  if (letters.length === 0) return "XXX";
  return letters.slice(0, 3).padEnd(3, "X");
}

export function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** YYYYMMDD from an ISO date string or Date. Pure — date is always passed in. */
export function yyyymmdd(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`;
}

/** Deal code: ENTITY + CLIENT3 + SEQ3, e.g. TIM + SOM + 001 = "TIMSOM001". */
export function buildDealCode(entityCode: string, clientCode: string, seq: number): string {
  const entity = (entityCode || "TIM").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "TIM";
  return `${entity}${clientCode}${pad(seq, 3)}`;
}

export function dealCodeScope(entityCode: string, clientCode: string): string {
  return `deal:${entityCode.toUpperCase()}:${clientCode}`;
}

export interface DocNumberParams {
  docType: DocType;
  entityCode: string;
  date: string | Date;
  seq: number;
}

export function buildDocNumber(p: DocNumberParams): string {
  const entity = p.entityCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "TIM";
  switch (p.docType) {
    case "sales_spec":
      return `Spec No ${p.seq}`;
    case "purchase_spec":
      return `Purchase Spec No ${p.seq}`;
    case "contract":
      return p.seq <= 1 ? `S-${yyyymmdd(p.date)}` : `S-${yyyymmdd(p.date)}-${p.seq}`;
    case "proforma_invoice":
      return `AV${pad(p.seq, 4)}`;
    case "invoice":
      return `${entity}${pad(p.seq, 4)}`;
    case "packing_list":
      return `${entity}-PL-${pad(p.seq, 3)}`;
    case "cmr":
      return `${entity}-CMR-${pad(p.seq, 3)}`;
    default:
      return `${entity}-${pad(p.seq, 4)}`;
  }
}

export function docNumberScope(docType: DocType, entityCode: string, date: string | Date, orderId?: string): string {
  const entity = entityCode.toUpperCase();
  switch (docType) {
    case "sales_spec":
    case "purchase_spec":
      return `doc:${docType}:order:${orderId ?? "unknown"}`;
    case "contract":
      return `doc:contract:${entity}:${yyyymmdd(date)}`;
    case "proforma_invoice":
      return `doc:proforma:${entity}`;
    case "invoice":
      return `doc:invoice:${entity}`;
    case "packing_list":
      return `doc:packing_list:${entity}`;
    case "cmr":
      return `doc:cmr:${entity}`;
    default:
      return `doc:${docType}:${entity}`;
  }
}

/** Atomically allocate the next value for a scope via the SQL counter. */
export async function allocateCounter(db: DbClient, scope: string): Promise<number> {
  const { data, error } = await db.rpc("next_counter", { p_scope: scope });
  if (error) throw new Error(`Counter allocation failed for ${scope}: ${error.message}`);
  const value = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(value)) throw new Error(`Counter allocation returned non-numeric value for ${scope}`);
  return value;
}
