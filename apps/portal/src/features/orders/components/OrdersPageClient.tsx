"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@timber/ui";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import { OrdersTable, type OrdersTableHandle, type OrderColumn } from "./OrdersTable";
import { OrderPricesTable } from "./OrderPricesTable";

interface OrdersPageClientProps {
  isAdmin: boolean;
  canSelectCustomer: boolean;
  userOrganisationId: string | null;
  userOrganisationName: string | null;
  visibleTabs?: string[];
}

export function OrdersPageClient({
  isAdmin,
  canSelectCustomer,
  userOrganisationId,
  userOrganisationName,
  visibleTabs = ["list", "prices", "sales", "production", "analytics"],
}: OrdersPageClientProps) {
  const [rawTab, setActiveTab] = usePersistedTab("orders-tab", visibleTabs[0] || "list");
  // If persisted tab isn't available for this org, fall back to first visible tab
  const activeTab = visibleTabs.includes(rawTab) ? rawTab : (visibleTabs[0] || "list");
  const tableRef = useRef<OrdersTableHandle>(null);
  const salesRef = useRef<OrdersTableHandle>(null);
  const productionRef = useRef<OrdersTableHandle>(null);
  const analyticsRef = useRef<OrdersTableHandle>(null);

  const getActiveRef = useCallback(() => {
    switch (activeTab) {
      case "list": return tableRef;
      case "sales": return salesRef;
      case "production": return productionRef;
      case "analytics": return analyticsRef;
      default: return null;
    }
  }, [activeTab]);

  const [showClear, setShowClear] = useState(false);

  // Check filter state periodically when filters might change
  const checkFilters = useCallback(() => {
    const ref = getActiveRef();
    setShowClear(ref?.current?.hasActiveFilters() ?? false);
  }, [getActiveRef]);

  // Re-check on tab change
  useEffect(() => { checkFilters(); }, [activeTab, checkFilters]);

  // Listen for clicks/changes that might toggle filters (re-check after interaction)
  useEffect(() => {
    const handler = () => setTimeout(checkFilters, 50);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [checkFilters]);

  const showTab = (tab: string) => visibleTabs.includes(tab);

  const SALES_COLUMNS: OrderColumn[] = [
    "customer", "seller", "producer", "dateReceived", "dateLoaded", "purchaseOrderNr", "projectNumber",
    "type", "treadLength", "treads", "winders", "quarters", "totalPieces", "totalPrice", "totalKg",
    "advanceInvoiceNumber", "invoiceNumber", "packageNumber", "transportInvoiceNumber", "transportPrice", "status",
  ];

  const PRODUCTION_COLUMNS: OrderColumn[] = [
    "seller", "producer", "dateReceived", "dateLoaded", "purchaseOrderNr", "projectNumber",
    "type", "treadLength", "treads", "winders", "quarters", "totalPieces",
    "plannedDate", "treadM3", "winderM3", "quarterM3", "totalProducedM3", "usedMaterialM3", "wasteM3", "wastePercent",
    "productionMaterial", "productionFinishing", "productionTotal", "productionInvoiceNumber", "productionPaymentDate",
    "woodArt", "woodArtCnc", "woodArtTotal", "woodArtInvoiceNumber", "woodArtPaymentDate", "status",
  ];

  const ANALYTICS_COLUMNS: OrderColumn[] = [
    "customer", "seller", "producer", "dateReceived", "dateLoaded", "purchaseOrderNr", "projectNumber",
    "type", "treadLength", "treads", "winders", "quarters", "totalPieces", "totalPrice",
    "invoicedM3", "usedM3", "diffM3", "diffPercent", "plMaterial",
    "invoicedWork", "usedWork", "diffWork", "diffWorkPercent", "plWork",
    "invoicedTransport", "usedTransport", "diffTransport", "diffTransportPercent", "plTransport",
    "plMaterials", "plTotal", "plPercentFromInvoice", "status",
  ];

  const orgKey = userOrganisationId ?? "admin";
  const commonProps = {
    isAdmin,
    canSelectCustomer,
    userOrganisationId,
    userOrganisationName,
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="flex items-center justify-between">
        <TabsList>
          {showTab("list") && <TabsTrigger value="list">List</TabsTrigger>}
          {showTab("prices") && <TabsTrigger value="prices">Prices</TabsTrigger>}
          {showTab("sales") && <TabsTrigger value="sales">Sales</TabsTrigger>}
          {showTab("production") && <TabsTrigger value="production">Production</TabsTrigger>}
          {showTab("analytics") && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
        </TabsList>
        <div className="flex items-center gap-2">
          {showClear && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                getActiveRef()?.current?.clearFilters();
                checkFilters();
              }}
            >
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          )}
          {activeTab === "list" && (
            <Button onClick={() => tableRef.current?.addOrder()}>
              <Plus className="h-4 w-4" />
              Add Order
            </Button>
          )}
        </div>
      </div>

      {showTab("list") && (
      <TabsContent value="list">
        <OrdersTable
          key={orgKey}
          ref={tableRef}
          {...commonProps}
          tab="list"
        />
      </TabsContent>
      )}

      {showTab("prices") && (
      <TabsContent value="prices">
        <OrderPricesTable key={orgKey} />
      </TabsContent>
      )}

      {showTab("sales") && (
      <TabsContent value="sales">
        <OrdersTable
          key={orgKey}
          ref={salesRef}
          {...commonProps}
          tab="sales"
          columns={SALES_COLUMNS}
        />
      </TabsContent>
      )}

      {showTab("production") && (
      <TabsContent value="production">
        <OrdersTable
          key={orgKey}
          ref={productionRef}
          {...commonProps}
          tab="production"
          columns={PRODUCTION_COLUMNS}
        />
      </TabsContent>
      )}

      {showTab("analytics") && (
      <TabsContent value="analytics">
        <OrdersTable
          key={orgKey}
          ref={analyticsRef}
          {...commonProps}
          tab="analytics"
          columns={ANALYTICS_COLUMNS}
        />
      </TabsContent>
      )}
    </Tabs>
  );
}
