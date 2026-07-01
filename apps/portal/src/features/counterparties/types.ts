/**
 * E4 · Counterparties (spec §9.3) — the two walled address books over the
 * organisations table:
 *
 *   clients   = organisations with is_customer = true
 *   suppliers = organisations with is_supplier = true OR is_producer = true
 *
 * A "counterparty record" IS an organisations row (created is_external +
 * is_active with the book flag). Access is rights-gated per book
 * (action/counterparty/clients|suppliers), not admin-only.
 */

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type CounterpartyBook = "clients" | "suppliers";

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
  isActive: boolean;
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
  /** Only read on update. */
  isActive?: boolean;
}
