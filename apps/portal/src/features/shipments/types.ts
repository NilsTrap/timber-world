/** Shipment record from database */
export interface Shipment {
  id: string;
  shipmentCode: string;
  shipmentNumber: number;
  fromPartyId: string;
  toPartyId: string;
  shipmentDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Organisation option for dropdowns */
export interface OrganisationOption {
  id: string;
  code: string;
  name: string;
}

/** Reference dropdown option */
export interface ReferenceOption {
  id: string;
  value: string;
}

/** All reference dropdowns for the package form */
export interface ReferenceDropdowns {
  productNames: ReferenceOption[];
  woodSpecies: ReferenceOption[];
  humidity: ReferenceOption[];
  types: ReferenceOption[];
  processing: ReferenceOption[];
  fsc: ReferenceOption[];
  quality: ReferenceOption[];
}

/** A package row in the form (client-side state) */
export interface PackageRow {
  clientId: string; // Temporary client-side ID for React key
  packageNumber: string; // Preview number (actual generated server-side)
  productNameId: string;
  woodSpeciesId: string;
  humidityId: string;
  typeId: string;
  processingId: string;
  fscId: string;
  qualityId: string;
  thickness: string;
  width: string;
  length: string;
  pieces: string;
  volumeM3: string;
  volumeIsCalculated: boolean;
}

/** Input for creating a shipment with packages */
export interface CreateShipmentInput {
  fromPartyId: string;
  toPartyId: string;
  shipmentDate: string;
  transportCostEur: number | null;
  packages: PackageInput[];
}

/** Package data for server submission */
export interface PackageInput {
  productNameId: string | null;
  woodSpeciesId: string | null;
  humidityId: string | null;
  typeId: string | null;
  processingId: string | null;
  fscId: string | null;
  qualityId: string | null;
  thickness: string;
  width: string;
  length: string;
  pieces: string;
  volumeM3: number | null;
  volumeIsCalculated: boolean;
}

/** Result type for server actions */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/** Helper to validate UUID format */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
