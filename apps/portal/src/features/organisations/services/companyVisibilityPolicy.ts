import type { CompanyVisibilityGroup } from "../types";

export interface CompanyRoleFacts {
  id: string;
  is_customer?: boolean | null;
  is_trader?: boolean | null;
  is_supplier?: boolean | null;
  is_manufacturer?: boolean | null;
  is_producer?: boolean | null;
}

/** Multi-role companies appear in every applicable list; the source never appears. */
export function visibilityGroupsForCompany(
  company: CompanyRoleFacts,
  sourceTraderId: string,
): CompanyVisibilityGroup[] {
  if (company.id === sourceTraderId) return [];

  const groups: CompanyVisibilityGroup[] = [];
  if (company.is_customer === true) groups.push("customers");
  if (company.is_trader === true) groups.push("traders");
  if (
    company.is_supplier === true ||
    company.is_manufacturer === true ||
    company.is_producer === true
  ) {
    groups.push("suppliers");
  }
  return groups;
}
