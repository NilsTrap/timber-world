/** Types for production plans (informational package groupings). */

export interface ProductionPlanListItem {
  id: string;
  name: string;
  description: string | null;
  packageCount: number;
  totalPieces: number;
  totalVolumeM3: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionPlanPackage {
  id: string;
  packageNumber: string | null;
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
  pieces: string | null;
  volumeM3: number | null;
  notes: string | null;
}

export interface ProductionPlanDetail {
  id: string;
  name: string;
  description: string | null;
  organisationId: string;
  createdAt: string;
  updatedAt: string;
  packages: ProductionPlanPackage[];
}
