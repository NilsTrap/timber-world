/**
 * Parties Types
 *
 * Types for managing parties (organizations) in the platform.
 * Parties are used as source/destination for shipments.
 */

/**
 * Party as stored in the database
 */
export interface Party {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
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
 * Party code validation regex (letter + 2 alphanumeric characters)
 */
const PARTY_CODE_REGEX = /^[A-Z][A-Z0-9]{2}$/;

/**
 * Validate party code format
 */
export function isValidPartyCode(code: string): boolean {
  return PARTY_CODE_REGEX.test(code);
}
