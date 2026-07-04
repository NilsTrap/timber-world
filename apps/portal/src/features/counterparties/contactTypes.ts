/**
 * K1 · CRM contacts (org_contacts) — named people attached to a counterparty
 * organisation. Plain types module (NOT "use server") so it is safe to import
 * from both server actions and client components.
 */

export interface OrgContactRow {
  id: string;
  organisationId: string;
  name: string;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  /** At most one primary per org (enforced by a DB trigger, first-wins). */
  isPrimary: boolean;
  isActive: boolean;
}

export interface OrgContactInput {
  name: string;
  roleTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  /** Read on create only (setPrimaryContact manages it afterwards). */
  isPrimary?: boolean;
  /** Read on update only. */
  isActive?: boolean;
}
