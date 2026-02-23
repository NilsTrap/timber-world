/**
 * Orders Types
 *
 * Types for managing orders in the platform.
 */

/**
 * Order status enum
 */
export type OrderStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "in_progress"
  | "shipped"
  | "completed";

/**
 * Order as stored in the database
 */
export interface Order {
  id: string;
  code: string;
  name: string;
  organisationId: string;
  /** Organisation name for display */
  organisationName?: string;
  /** Organisation code for display */
  organisationCode?: string;
  orderDate: string;
  volumeM3: number | null;
  valueCents: number | null;
  currency: "EUR" | "GBP" | "USD";
  status: OrderStatus;
  notes: string | null;
  createdBy: string | null;
  /** Creator name for display */
  createdByName?: string;
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
 * Status badge variant mapping
 */
export function getStatusBadgeVariant(
  status: OrderStatus
): "outline" | "secondary" | "default" | "success" {
  switch (status) {
    case "draft":
      return "outline";
    case "pending":
      return "secondary";
    case "confirmed":
    case "in_progress":
      return "default";
    case "shipped":
    case "completed":
      return "success";
    default:
      return "outline";
  }
}

/**
 * Status display labels
 */
export function getStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "in_progress":
      return "In Progress";
    case "shipped":
      return "Shipped";
    case "completed":
      return "Completed";
    default:
      return status;
  }
}

/**
 * All order statuses in order
 */
export const ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "pending",
  "confirmed",
  "in_progress",
  "shipped",
  "completed",
];

/**
 * Currency options
 */
export const CURRENCIES = ["EUR", "GBP", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
