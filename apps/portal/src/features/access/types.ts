import type { DealScope, FieldDomain, FieldGrant } from "@/lib/access/types";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export interface AccessGroupSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  sortOrder: number;
  memberCount: number;
}

export interface AccessRightRow {
  rightType: "module" | "action" | "visibility" | "field" | "scope";
  resource: string;
  key: string;
  value: Record<string, unknown> | string;
}

export interface AccessGroupDetail {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  /** Convenience decomposition of the rights rows for the editor UI. */
  modules: string[];
  dealVisibility: string[];
  fieldDomains: Partial<Record<FieldDomain, FieldGrant>>;
  fieldOverrides: Record<string, FieldGrant>;
  scope: DealScope;
  actions: string[]; // "<resource>:<key>"
}

export interface GroupRightsInput {
  modules: string[];
  dealVisibility: string[];
  fieldDomains: Partial<Record<FieldDomain, FieldGrant>>;
  fieldOverrides: Record<string, FieldGrant>;
  scope: DealScope;
  actions: string[]; // "<resource>:<key>"
}

export interface UserGroupAssignment {
  groupId: string;
  groupKey: string;
  groupName: string;
  isSystem: boolean;
  assigned: boolean;
}
