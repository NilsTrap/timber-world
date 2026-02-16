/**
 * Reference Data Types
 *
 * Types for managing dropdown options in reference tables.
 * All 7 reference tables share the same structure.
 */

/**
 * Valid reference table names that can be managed
 */
export type ReferenceTableName =
  | "ref_product_names"
  | "ref_wood_species"
  | "ref_humidity"
  | "ref_types"
  | "ref_processing"
  | "ref_fsc"
  | "ref_quality"
  | "ref_processes";

/**
 * Array of valid table names for runtime validation
 * Used by server actions to prevent SQL injection
 */
export const VALID_REFERENCE_TABLES: ReferenceTableName[] = [
  "ref_product_names",
  "ref_wood_species",
  "ref_humidity",
  "ref_types",
  "ref_processing",
  "ref_fsc",
  "ref_quality",
  "ref_processes",
];

/**
 * Route parameter to table name mapping
 */
export const REFERENCE_TABLE_MAP: Record<string, ReferenceTableName> = {
  "product-names": "ref_product_names",
  "wood-species": "ref_wood_species",
  humidity: "ref_humidity",
  types: "ref_types",
  processing: "ref_processing",
  fsc: "ref_fsc",
  quality: "ref_quality",
  processes: "ref_processes",
};

/**
 * Display names for each reference table
 */
export const REFERENCE_TABLE_DISPLAY_NAMES: Record<ReferenceTableName, string> =
  {
    ref_product_names: "Product Names",
    ref_wood_species: "Wood Species",
    ref_humidity: "Humidity",
    ref_types: "Types",
    ref_processing: "Processing",
    ref_fsc: "FSC",
    ref_quality: "Quality",
    ref_processes: "Processes",
  };

/**
 * Work formula types for auto-calculating planned work
 */
export type WorkFormula = 'length_x_pieces' | 'area' | 'volume' | 'pieces' | 'hours' | null;

/**
 * Reference option as stored in the database
 */
export interface ReferenceOption {
  id: string;
  value: string;
  code?: string;
  workUnit?: string;
  workFormula?: WorkFormula;
  price?: number | null;
  sortOrder: number;
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
