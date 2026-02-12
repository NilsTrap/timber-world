"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@timber/ui";
import { OverviewMetrics } from "./OverviewMetrics";
import { VisitorsByCountry } from "./VisitorsByCountry";
import { TopProductsTable } from "./TopProductsTable";
import { QuoteFunnelChart } from "./QuoteFunnelChart";
import { DeviceBreakdownChart } from "./DeviceBreakdownChart";
import { VisitorEngagementCard } from "./VisitorEngagementCard";
import { DetailedFilterUsageCard } from "./DetailedFilterUsageCard";
import { JourneyOverviewCard } from "./JourneyOverviewCard";
import {
  getAnalyticsOverview,
  getVisitorsByCountry,
  getProductMetrics,
  getQuoteFunnelMetrics,
  getFilterUsage,
  getJourneyMetrics,
  getDeviceBreakdown,
  getBrowserBreakdown,
  getVisitorEngagement,
  getDetailedFilterUsage,
  getJourneyEngagement,
  getConsentMetrics,
} from "../actions";
import type { VisitorEngagement } from "../actions/getVisitorEngagement";
import type { DetailedFilterUsage } from "../actions/getDetailedFilterUsage";
import type { JourneyEngagement } from "../actions/getJourneyEngagement";
import type { ConsentMetrics } from "../actions/getConsentMetrics";
import type {
  DateRange,
  AnalyticsOverview,
  VisitorsByCountry as VisitorsByCountryType,
  TopProduct,
  QuoteFunnelMetrics,
  FilterUsage,
  JourneyStageView,
  DeviceBreakdown,
  BrowserBreakdown,
} from "../types";

interface AnalyticsData {
  overview: AnalyticsOverview | null;
  countries: VisitorsByCountryType[];
  products: TopProduct[];
  funnel: QuoteFunnelMetrics | null;
  filters: FilterUsage[];
  journey: JourneyStageView[];
  devices: DeviceBreakdown[];
  browsers: BrowserBreakdown[];
  visitorEngagement: VisitorEngagement | null;
  detailedFilters: DetailedFilterUsage[];
  journeyEngagement: JourneyEngagement | null;
  consentMetrics: ConsentMetrics | null;
}

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

export function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData>({
    overview: null,
    countries: [],
    products: [],
    funnel: null,
    filters: [],
    journey: [],
    devices: [],
    browsers: [],
    visitorEngagement: null,
    detailedFilters: [],
    journeyEngagement: null,
    consentMetrics: null,
  });

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [
        overviewResult,
        countriesResult,
        productsResult,
        funnelResult,
        filtersResult,
        journeyResult,
        devicesResult,
        browsersResult,
        visitorEngagementResult,
        detailedFiltersResult,
        journeyEngagementResult,
        consentMetricsResult,
      ] = await Promise.all([
        getAnalyticsOverview(dateRange, true),
        getVisitorsByCountry(dateRange, true, 10),
        getProductMetrics(dateRange, 10),
        getQuoteFunnelMetrics(dateRange),
        getFilterUsage(dateRange),
        getJourneyMetrics(dateRange),
        getDeviceBreakdown(dateRange, true),
        getBrowserBreakdown(dateRange, true),
        getVisitorEngagement(dateRange),
        getDetailedFilterUsage(dateRange),
        getJourneyEngagement(dateRange),
        getConsentMetrics(dateRange),
      ]);

      setData({
        overview: overviewResult.success ? overviewResult.data : null,
        countries: countriesResult.success ? countriesResult.data : [],
        products: productsResult.success ? productsResult.data : [],
        funnel: funnelResult.success ? funnelResult.data : null,
        filters: filtersResult.success ? filtersResult.data : [],
        journey: journeyResult.success ? journeyResult.data : [],
        devices: devicesResult.success ? devicesResult.data : [],
        browsers: browsersResult.success ? browsersResult.data : [],
        visitorEngagement: visitorEngagementResult.success ? visitorEngagementResult.data : null,
        detailedFilters: detailedFiltersResult.success ? detailedFiltersResult.data : [],
        journeyEngagement: journeyEngagementResult.success ? journeyEngagementResult.data : null,
        consentMetrics: consentMetricsResult.success ? consentMetricsResult.data : null,
      });

      // Check if any critical data failed
      if (!overviewResult.success) {
        setError(overviewResult.error);
      }
    } catch (err) {
      console.error("Error loading analytics:", err);
      setError("Failed to load analytics data");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  if (error && !data.overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
        <TabsList>
          {Object.entries(DATE_RANGE_LABELS).map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Overview Metrics */}
      {data.overview && <OverviewMetrics data={data.overview} consentMetrics={data.consentMetrics} />}

      {/* Visitor Engagement & Countries */}
      <div className="grid gap-6 lg:grid-cols-2">
        {data.visitorEngagement && <VisitorEngagementCard data={data.visitorEngagement} />}
        <VisitorsByCountry data={data.countries} />
      </div>

      {/* Quote Funnel & Products */}
      <div className="grid gap-6 lg:grid-cols-2">
        {data.funnel && <QuoteFunnelChart data={data.funnel} />}
        <TopProductsTable data={data.products} />
      </div>

      {/* Filter Usage & Journey Overview */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DetailedFilterUsageCard data={data.detailedFilters} />
        <JourneyOverviewCard stageViews={data.journey} engagement={data.journeyEngagement} />
      </div>

      {/* Devices */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DeviceBreakdownChart devices={data.devices} browsers={data.browsers} />
      </div>

    </div>
  );
}
