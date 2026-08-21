import type { CounterpartyBook } from "./types";

export type CounterpartyAccessMode = "admin" | "manager" | "self";

export interface OrganisationBookFacts {
  is_customer?: boolean | null;
  is_supplier?: boolean | null;
  is_producer?: boolean | null;
  is_manufacturer?: boolean | null;
  is_trader?: boolean | null;
}

export function isOrganisationInBook(org: OrganisationBookFacts, book: CounterpartyBook): boolean {
  if (book === "clients") return org.is_customer === true;
  if (book === "traders") return org.is_trader === true;
  return org.is_supplier === true || org.is_producer === true;
}

export function isOrganisationSelfInBook(org: OrganisationBookFacts, book: CounterpartyBook): boolean {
  return isOrganisationInBook(org, book) || (book === "suppliers" && org.is_manufacturer === true);
}

export function isValidCounterpartyId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function canAccessCounterpartyRecord(input: {
  mode: CounterpartyAccessMode;
  callerOrgId: string | null;
  targetOrgId: string;
  linked: boolean;
  intent: "read" | "manage";
}): boolean {
  if (input.intent === "manage" && input.mode === "self") return false;
  if (input.mode === "admin") return true;
  if (input.mode === "self") return input.callerOrgId === input.targetOrgId;
  return Boolean(input.callerOrgId && input.linked);
}

export function decideCounterpartyBookMode(input: {
  book: CounterpartyBook;
  platformAdmin: boolean;
  hasExactBookGrant: boolean;
  callerOrgId: string | null;
  callerOrg: OrganisationBookFacts | null;
}): CounterpartyAccessMode | null {
  if (input.platformAdmin) return "admin";
  if (input.book === "traders") return null;
  if (input.hasExactBookGrant && input.callerOrgId) return "manager";
  if (input.callerOrgId && input.callerOrg && isOrganisationSelfInBook(input.callerOrg, input.book)) return "self";
  return null;
}
