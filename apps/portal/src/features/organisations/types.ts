/**
 * Organisations Types
 *
 * Types for managing organisations in the platform.
 */

/**
 * Organisation as stored in the database
 */
export interface Organisation {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  /** External organisations don't use the platform - they're suppliers/customers */
  isExternal: boolean;
  createdAt: string;
  updatedAt: string;
  /** Number of portal users in this organisation */
  userCount?: number;
}

/**
 * User status in the invitation lifecycle
 * - created: User record exists but no credentials sent yet
 * - invited: Credentials have been sent, user can log in
 * - active: User has logged in at least once
 */
export type UserStatus = "created" | "invited" | "active";

/**
 * Organisation User as stored in portal_users
 */
export interface OrganisationUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "producer";
  organisationId: string;
  authUserId: string | null;
  isActive: boolean;
  status: UserStatus;
  invitedAt: string | null;
  invitedBy: string | null;
  /** Name of the user who sent the invitation/credentials */
  invitedByName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
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
 * Organisation code validation regex (letter + 2 alphanumeric characters)
 */
const ORG_CODE_REGEX = /^[A-Z][A-Z0-9]{2}$/;

/**
 * Validate organisation code format
 */
export function isValidOrgCode(code: string): boolean {
  return ORG_CODE_REGEX.test(code);
}

/**
 * Trading Partner - an organisation that appears in shipment dropdowns
 */
export interface TradingPartner {
  id: string;
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  createdAt: string;
}
