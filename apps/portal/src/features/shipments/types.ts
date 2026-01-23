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

/** Shipment list item for overview table */
export interface ShipmentListItem {
  id: string;
  shipmentCode: string;
  fromPartyName: string;
  fromPartyCode: string;
  toPartyName: string;
  toPartyCode: string;
  shipmentDate: string;
  transportCostEur: number | null;
  packageCount: number;
  totalVolumeM3: number;
}

/** Package detail for shipment detail view */
export interface PackageDetail {
  id: string;
  packageNumber: string;
  packageSequence: number;
  productNameId: string | null;
  productName: string | null;
  woodSpeciesId: string | null;
  woodSpecies: string | null;
  humidityId: string | null;
  humidity: string | null;
  typeId: string | null;
  typeName: string | null;
  processingId: string | null;
  processing: string | null;
  fscId: string | null;
  fsc: string | null;
  qualityId: string | null;
  quality: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
  volumeIsCalculated: boolean;
}

/** Shipment detail with all packages */
export interface ShipmentDetail {
  id: string;
  shipmentCode: string;
  shipmentNumber: number;
  fromPartyId: string;
  fromPartyName: string;
  toPartyId: string;
  toPartyName: string;
  shipmentDate: string;
  transportCostEur: number | null;
  packages: PackageDetail[];
}

/** Package list item for packages overview tab */
export interface PackageListItem {
  id: string;
  packageNumber: string;
  shipmentCode: string;
  shipmentId: string;
  productName: string | null;
  woodSpecies: string | null;
  humidity: string | null;
  typeName: string | null;
  processing: string | null;
  fsc: string | null;
  quality: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
}

/** Input for updating shipment packages */
export interface UpdateShipmentInput {
  shipmentId: string;
  transportCostEur: number | null;
  packages: PackageInput[];
}

/** Helper to validate UUID format */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
