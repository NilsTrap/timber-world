export interface AnalyticsOverview {
  totalSessions: number;
  totalPageViews: number;
  uniqueVisitors: number;
  bounceRate: number;
  avgSessionDurationMs: number;
  botPercentage: number;
}

export interface VisitorsByCountry {
  countryCode: string;
  countryName: string;
  visitorCount: number;
  percentage: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  species: string | null;
  viewCount: number;
}

export interface QuoteFunnelMetrics {
  formViews: number;
  fieldInteractions: number;
  submissions: number;
  successes: number;
  conversionRate: number;
  avgTimeOnFormMs: number;
}

export interface FilterUsage {
  filterName: string;
  usageCount: number;
}

export interface JourneyStageView {
  stageNumber: number;
  stageName: string;
  viewCount: number;
  dropoffRate: number;
}

export interface DeviceBreakdown {
  deviceType: string;
  count: number;
  percentage: number;
}

export interface BrowserBreakdown {
  browser: string;
  count: number;
  percentage: number;
}

export type DateRange = "today" | "7d" | "30d" | "90d" | "all";

export interface AnalyticsFilters {
  dateRange: DateRange;
  excludeBots: boolean;
}
