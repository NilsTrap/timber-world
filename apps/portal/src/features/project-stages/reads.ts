import type { DbClient } from "../orders/services/dealModel";
import type { ProjectStageConfiguration, ProjectStageViewer, StageOption } from "./types";

interface StageRow {
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  available_to_buyer: boolean;
  available_to_trader: boolean;
  available_to_supplier: boolean;
  updated_at: string;
}

export const PROJECT_STAGE_COLUMNS =
  "key, label, color, sort_order, is_active, available_to_buyer, available_to_trader, available_to_supplier, updated_at";

export function toStageOption(row: StageRow): StageOption {
  return {
    key: row.key,
    label: row.label,
    color: row.color,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    availableToBuyer: row.available_to_buyer,
    availableToTrader: row.available_to_trader,
    availableToSupplier: row.available_to_supplier,
    updatedAt: row.updated_at,
  };
}

export function canViewerSelectStage(stage: StageOption, viewer: ProjectStageViewer): boolean {
  if (!stage.isActive) return false;
  if (viewer.isPlatformAdmin) return true;
  return viewer.personas.some((persona) =>
    persona === "buyer" ? stage.availableToBuyer
      : persona === "trader" ? stage.availableToTrader
        : persona === "supplier" ? stage.availableToSupplier
          : false,
  );
}

export async function getProjectStages(db: DbClient): Promise<StageOption[]> {
  const { data, error } = await db.from("project_stages").select(PROJECT_STAGE_COLUMNS)
    .order("sort_order", { ascending: true }).order("key", { ascending: true });
  if (error) throw new Error("PROJECT_STAGES_UNAVAILABLE");
  return ((data ?? []) as StageRow[]).map(toStageOption);
}

/** Current is retained even when inactive; selectable contains active stages only. */
export async function getProjectStageConfiguration(
  db: DbClient,
  currentKey: string,
  viewer: ProjectStageViewer,
): Promise<ProjectStageConfiguration> {
  const stages = await getProjectStages(db);
  return {
    current: stages.find((stage) => stage.key === currentKey) ?? null,
    selectable: stages.filter((stage) => canViewerSelectStage(stage, viewer)),
  };
}
