import type { ProjectPartyOption } from "../types";

export type PartyOptionRow = {
  id: string; code: string; name: string;
  is_customer: boolean; is_trader: boolean; is_supplier: boolean;
  is_producer: boolean; is_manufacturer: boolean;
};

export function toEligiblePartyOption(row: PartyOptionRow, side: "buyer" | "seller"): ProjectPartyOption | null {
  if (side === "buyer") return row.is_customer || row.is_trader ? { id: row.id, code: row.code, name: row.name, group: "buyers" } : null;
  if (!(row.is_trader || row.is_supplier || row.is_producer || row.is_manufacturer)) return null;
  return { id: row.id, code: row.code, name: row.name, group: row.is_trader ? "traders" : "suppliers" };
}

export function purchaseLegAllowsBuyerEdit(input: { isPlatformAdmin: boolean; dealKind: string; buyerMissing: boolean }): boolean {
  return input.dealKind !== "purchase_only" || (input.isPlatformAdmin && input.buyerMissing);
}
