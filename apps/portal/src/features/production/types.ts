/**
 * Production Feature Types
 */

export interface Process {
  id: string;
  value: string;
  sortOrder: number;
}

export type EntryType = "standard" | "correction";

export interface ProductionEntry {
  id: string;
  processId: string;
  productionDate: string;
  status: "draft" | "validated";
  entryType: EntryType;
  correctsEntryId: string | null;
  notes: string | null;
  totalInputM3: number | null;
  totalOutputM3: number | null;
  outcomePercentage: number | null;
  wastePercentage: number | null;
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
}

export interface ProductionListItem {
  id: string;
  processName: string;
  productionDate: string;
  status: "draft" | "validated";
  createdAt: string;
}

export interface ProductionHistoryItem {
  id: string;
  processName: string;
  productionDate: string;
  totalInputM3: number;
  totalOutputM3: number;
  outcomePercentage: number;
  wastePercentage: number;
  validatedAt: string;
  entryType: EntryType;
}

export interface ProductionInput {
  id: string;
  productionEntryId: string;
  packageId: string;
  packageNumber: string;
  shipmentCode: string;
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
  availablePieces: string | null;
  totalVolumeM3: number | null;
  piecesUsed: number | null;
  volumeM3: number;
  createdAt: string;
}

export interface ProductionOutput {
  id: string;
  productionEntryId: string;
  packageNumber: string;
  productNameId: string | null;
  woodSpeciesId: string | null;
  humidityId: string | null;
  typeId: string | null;
  processingId: string | null;
  fscId: string | null;
  qualityId: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number;
  createdAt: string;
}

export interface OutputRow {
  clientId: string;
  dbId: string | null;
  packageNumber: string;
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

export interface ReferenceOption {
  id: string;
  value: string;
}

export interface ReferenceDropdowns {
  productNames: ReferenceOption[];
  woodSpecies: ReferenceOption[];
  humidity: ReferenceOption[];
  types: ReferenceOption[];
  processing: ReferenceOption[];
  fsc: ReferenceOption[];
  quality: ReferenceOption[];
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
