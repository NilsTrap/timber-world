/**
 * Production Feature Types
 */

export interface Process {
  id: string;
  value: string;
  sortOrder: number;
}

export interface ProductionEntry {
  id: string;
  processId: string;
  productionDate: string;
  status: "draft" | "validated";
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

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
