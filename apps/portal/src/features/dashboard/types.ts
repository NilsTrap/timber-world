/**
 * Dashboard Feature Types
 */

export interface ProducerMetrics {
  totalInventoryM3: number;
  totalProductionVolumeM3: number;
  overallOutcomePercent: number;
  overallWastePercent: number;
}

export interface ProcessBreakdownItem {
  processId: string;
  processName: string;
  totalEntries: number;
  totalInputM3: number;
  totalOutputM3: number;
  avgOutcomePercent: number;
  avgWastePercent: number;
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// ============================================
// Admin Dashboard Types (Story 5.4)
// ============================================

/** Date range filter options for admin dashboard */
export type DateRangeFilterType = "week" | "month" | "quarter" | "all" | "custom";

/** Date range with start and end dates (ISO strings for serialization) */
export interface DateRange {
  start: string;
  end: string;
}

/** Admin dashboard aggregate metrics */
export interface AdminMetrics {
  totalInventoryM3: number;
  packageCount: number;
  totalProductionVolumeM3: number;
  overallOutcomePercent: number;
  overallWastePercent: number;
  entryCount: number;
  /** Count of organizations with activity in last 30 days */
  activeOrganizations: number;
  /** Count of pending shipments awaiting acceptance */
  pendingShipments: number;
}

/** Trend direction indicator */
export type TrendDirection = "up" | "down" | "stable";

/** Admin per-process breakdown with trend indicators */
export interface AdminProcessBreakdownItem {
  processId: string;
  processName: string;
  totalEntries: number;
  totalInputM3: number;
  totalOutputM3: number;
  avgOutcomePercent: number;
  avgWastePercent: number;
  trend: TrendDirection;
  trendValue: number; // percentage point change
}

/** Single production entry for process history view */
export interface ProcessHistoryItem {
  entryId: string;
  date: string;
  inputM3: number;
  outputM3: number;
  outcomePercent: number;
  createdBy: string;
}

/** Chart data point for outcome % over time */
export interface ChartDataPoint {
  date: string;
  outcomePercent: number;
}

/** Complete data for process detail view */
export interface ProcessDetailData {
  processId: string;
  processName: string;
  historyItems: ProcessHistoryItem[];
  chartData: ChartDataPoint[];
  bestEntry: ProcessHistoryItem | null;
  worstEntry: ProcessHistoryItem | null;
}

// ============================================
// Consolidated Inventory Types
// ============================================

/** Consolidated inventory row grouped by 6 attributes */
export interface ConsolidatedInventoryItem {
  productName: string | null;
  woodSpecies: string | null;
  humidity: string | null;
  typeName: string | null;
  processing: string | null;
  quality: string | null;
  packageCount: number;
  totalPieces: number;
  totalVolumeM3: number;
}
