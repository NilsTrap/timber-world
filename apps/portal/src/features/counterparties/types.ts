/**
 * E4 · Counterparties (spec §9.3) — the walled address books over the
 * organisations table:
 *
 *   clients   = organisations with is_customer = true
 *   suppliers = organisations with is_supplier = true OR is_producer = true
 *   traders   = organisations with is_trader = true  (L2, ADMIN-ONLY — the
 *               house's own trading companies; salespeople/purchasing never
 *               need a traders book)
 *
 * A "counterparty record" IS an organisations row (created is_active with the
 * book flag; clients/suppliers are is_external, traders are internal house
 * companies). Clients/suppliers access is rights-gated per book
 * (action/counterparty/clients|suppliers); the traders book is admin-only.
 */

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type CounterpartyBook = "clients" | "suppliers" | "traders";

export interface CounterpartyRow {
  id: string;
  code: string;
  name: string;
  registrationNumber: string | null;
  vatNumber: string | null;
  legalAddress: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  // G4: bank details — consumed by PartyCard on invoices/proformas.
  bankName: string | null;
  bankAccountNumber: string | null;
  bankSwiftCode: string | null;
  // G3: default signature block for this counterparty's documents.
  defaultSigneeName: string | null;
  defaultSigneeRole: string | null;
  logoUrl: string | null;
  isActive: boolean;
  /** Q3: active portal-user count for this org (list view only — batched into
   *  listCounterparties, mirrors the admin OrganisationsTable "Users" column).
   *  Undefined on create/update returns, which never render the count. */
  userCount?: number;
}

export interface CounterpartyDeliveryAddress {
  id: string;
  label: string;
  address: string;
  contactName: string | null;
  contactPhone: string | null;
  contactHours: string | null;
  isDefault: boolean;
}

export interface CounterpartyContact {
  id: string;
  name: string;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

export interface CounterpartyProfile extends CounterpartyRow {
  accessMode: "admin" | "manager" | "self";
  canManage: boolean;
  deliveryAddresses: CounterpartyDeliveryAddress[];
  contacts: CounterpartyContact[];
}

export interface CounterpartyBookContext {
  accessMode: "admin" | "manager" | "self";
  canManage: boolean;
}

export interface CounterpartyInput {
  /** Only read on create; codes are immutable afterwards. */
  code?: string;
  name: string;
  registrationNumber?: string | null;
  vatNumber?: string | null;
  legalAddress?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankSwiftCode?: string | null;
  defaultSigneeName?: string | null;
  defaultSigneeRole?: string | null;
  /** Only read on update. */
  isActive?: boolean;
}
