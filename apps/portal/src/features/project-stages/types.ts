import type { ProjectPersona } from "../projects/personas";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export interface StageOption {
  key: string;
  label: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  availableToBuyer: boolean;
  availableToTrader: boolean;
  availableToSupplier: boolean;
  updatedAt: string;
}

export interface ProjectStageViewer {
  isPlatformAdmin: boolean;
  personas: readonly ProjectPersona[];
}

export interface ProjectStageConfiguration {
  current: StageOption | null;
  selectable: StageOption[];
}

