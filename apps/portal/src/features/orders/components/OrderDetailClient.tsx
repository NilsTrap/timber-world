"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@timber/ui";
import { DealPanel } from "./DealPanel";
import { getOrder } from "../actions/getOrder";
import { getOrderPackages } from "../actions/getOrderPackages";
import { getStaircaseCodes } from "../actions/getStaircaseCodes";
import { getReferenceDropdowns } from "@/features/shipments/actions";
import type { Order } from "../types";
import type { OrderPackage } from "../actions/getOrderPackages";
import type { StaircaseCode } from "../actions/getStaircaseCodes";
import { getStatusLabel } from "../types";
import { OrderProductsSection } from "./OrderProductsSection";
import type { ProductColumnKey } from "./OrderProductsTable";
import { OrderPackagesTable } from "./OrderPackagesTable";
import { OrderFilesSection } from "./OrderFilesSection";
import { OrderActivityLog } from "./OrderActivityLog";
import { PdfThumbnail } from "./PdfThumbnail";
import { getOrderFiles } from "../actions/getOrderFiles";
import type { OrderFile } from "../types";

const ORDER_LAST_ENTRY_KEY = "order-last-entry";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  pending: "bg-blue-100 text-blue-800",
  confirmed: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-purple-100 text-purple-800",
  shipped: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  loaded: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

interface ReferenceOption {
  id: string;
  value: string;
}

interface RefDropdowns {
  productNames: ReferenceOption[];
  woodSpecies: ReferenceOption[];
  types: ReferenceOption[];
  quality: ReferenceOption[];
}

interface OrderDetailClientProps {
  orderId: string;
}

/** Columns hidden in the "list" tab detail view */
const LIST_TAB_HIDDEN_COLUMNS: ProductColumnKey[] = [
  "volumeM3", "totalVolume", "kgPerPiece", "totalKg",
  "eurPerM3", "eurPerPiece", "totalEurPerPiece",
  "workPerPiece", "totalWork", "transportPerPiece", "totalTransport",
];

/** Columns hidden in the "sales" tab detail view */
const SALES_TAB_HIDDEN_COLUMNS: ProductColumnKey[] = [
  "volumeM3", "totalVolume", "eurPerM3", "eurPerPiece", "totalEurPerPiece",
  "workPerPiece", "totalWork", "transportPerPiece", "totalTransport",
];

/** Columns hidden in the "production" tab detail view (all pricing) */
const PRODUCTION_TAB_HIDDEN_COLUMNS: ProductColumnKey[] = [
  "eurPerM3", "eurPerPiece", "totalEurPerPiece",
  "unitPrice", "totalPrice",
  "workPerPiece", "totalWork", "transportPerPiece", "totalTransport",
];

export function OrderDetailClient({ orderId }: OrderDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "list";
  // Local view axis: the existing order content vs. the universal Deal view
  // (line items + documents). Separate from the list-inherited `tab` above.
  const [view, setView] = useState<"order" | "deal">("order");
  const [order, setOrder] = useState<Order | null>(null);
  const [packages, setPackages] = useState<OrderPackage[]>([]);
  const [dropdowns, setDropdowns] = useState<RefDropdowns | null>(null);
  const [staircaseCodes, setStaircaseCodes] = useState<StaircaseCode[]>([]);
  const [orderFiles, setOrderFiles] = useState<OrderFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const search = searchParams.toString();
    sessionStorage.setItem(ORDER_LAST_ENTRY_KEY, search ? `${pathname}?${search}` : pathname);
  }, [pathname, searchParams]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [orderResult, pkgResult, refsResult, codesResult, filesResult] = await Promise.all([
      getOrder(orderId),
      getOrderPackages(orderId),
      getReferenceDropdowns(),
      getStaircaseCodes(),
      getOrderFiles(orderId),
    ]);

    if (!orderResult.success) {
      sessionStorage.removeItem(ORDER_LAST_ENTRY_KEY);
      router.replace("/orders");
      return;
    }

    setOrder(orderResult.data);
    if (pkgResult.success) setPackages(pkgResult.data);
    if (refsResult.success) {
      const d = refsResult.data;
      setDropdowns({
        productNames: d.productNames,
        woodSpecies: d.woodSpecies,
        types: d.types,
        quality: d.quality,
      });
    }
    if (codesResult.success) {
      setStaircaseCodes(codesResult.data ?? []);
    }
    if (filesResult.success) {
      setOrderFiles(filesResult.data);
    }
    setIsLoading(false);
  }, [orderId, router]);

  const refreshOrderFiles = useCallback(async () => {
    const result = await getOrderFiles(orderId);
    if (result.success) setOrderFiles(result.data);
  }, [orderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order || !dropdowns) return null;

  const isEditable = order.status === "draft" || order.status === "confirmed";
  // Ordered Products are inherently customer/sales data and must never be edited
  // from the Production tab — even when the order itself is in draft. The Production
  // tab is reserved for production-side metrics (m³, costs, invoice/payment) and
  // showing editable dropdowns there causes confusion for producer users who only
  // hold the Production tab (orders.tab.production) and may edit production fields only.
  const productsReadOnly = !isEditable || tab === "production";

  // Split packages by status
  const orderedPackages = packages.filter((p) => p.status === "ordered");
  const producedPackages = packages.filter((p) => p.status !== "ordered");

  const totalProducedPieces = producedPackages.reduce(
    (sum, p) => sum + (p.pieces ? parseInt(p.pieces, 10) || 0 : 0), 0
  );
  const totalProducedVolume = producedPackages.reduce(
    (sum, p) => sum + (p.volumeM3 || 0), 0
  );

  return (
    <div className="space-y-6">
      {/* Header — back button + title + stacked meta on the left, status badge + thumbnail on the right */}
      {(() => {
        const thumbnailCategory = tab === "list" ? "customer" : "production";
        const thumbnailFile = orderFiles.find((f) => f.isThumbnail && f.category === thumbnailCategory);
        const isPdf = thumbnailFile && (thumbnailFile.mimeType === "application/pdf" || thumbnailFile.fileName.toLowerCase().endsWith(".pdf"));
        const showCustomer = tab !== "production";
        const showProducer = tab !== "list";
        const metaRows: Array<{ label: string; value: string }> = [];
        if (showCustomer && order.customerOrganisationName) {
          metaRows.push({ label: "Customer", value: order.customerOrganisationName });
        }
        if (order.sellerOrganisationName) {
          metaRows.push({ label: "Manufacturer", value: order.sellerOrganisationName });
        }
        if (showProducer && order.producerOrganisationName) {
          metaRows.push({ label: "Producer", value: order.producerOrganisationName });
        }
        metaRows.push({ label: "Received", value: order.dateReceived });
        if (order.dateLoaded) {
          metaRows.push({ label: "Loaded", value: order.dateLoaded });
        }
        return (
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild className="shrink-0">
                  <Link href="/orders" onClick={() => sessionStorage.removeItem(ORDER_LAST_ENTRY_KEY)}>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back to orders</span>
                  </Link>
                </Button>
                <h1 className="text-3xl font-semibold tracking-tight">{order.name}</h1>
              </div>
              <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                {metaRows.map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-muted-foreground">{row.label}:</dt>
                    <dd className="font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-800"}`}
              >
                {getStatusLabel(order.status)}
              </span>
              {isPdf && thumbnailFile && (
                <PdfThumbnail key={thumbnailFile.id} file={thumbnailFile} height={140} />
              )}
            </div>
          </div>
        );
      })()}

      <Tabs value={view} onValueChange={(v) => setView(v as "order" | "deal")}>
        <TabsList>
          <TabsTrigger value="order">Order</TabsTrigger>
          <TabsTrigger value="deal">Deal</TabsTrigger>
        </TabsList>

        <TabsContent value="order" className="space-y-6 mt-4">
      {/* Ordered Products - DataEntryTable */}
      <OrderProductsSection
        orderId={orderId}
        // Packages belong to the manufacturer (seller) who manages the order, not the
        // end customer. inventory_packages RLS requires the inserting user to be in this
        // org, and the customer is often empty / a different org — using it breaks inserts.
        organisationId={order.sellerOrganisationId ?? order.customerOrganisationId}
        initialPackages={orderedPackages}
        dropdowns={dropdowns}
        staircaseCodes={staircaseCodes}
        readOnly={productsReadOnly}
        hiddenColumns={tab === "list" ? LIST_TAB_HIDDEN_COLUMNS : tab === "sales" ? SALES_TAB_HIDDEN_COLUMNS : tab === "production" ? PRODUCTION_TAB_HIDDEN_COLUMNS : undefined}
        tab={tab}
      />

      {/* Produced Packages (shown only when there are any) */}
      {producedPackages.length > 0 && (
        <OrderPackagesTable
          title="Produced Packages"
          subtitle={`${producedPackages.length} packages · ${totalProducedPieces} pcs · ${totalProducedVolume.toFixed(4)} m³`}
          packages={producedPackages}
          orderId={orderId}
          organisationId={order.sellerOrganisationId ?? order.customerOrganisationId}
          editable={false}
          onChanged={loadData}
        />
      )}

      {/* Order Files */}
      <OrderFilesSection
        orderId={orderId}
        showCustomer={tab === "list" || tab === "sales"}
        showProduction={tab === "production" || tab === "sales"}
        onFilesChanged={refreshOrderFiles}
      />

      {/* Activity Log */}
      <OrderActivityLog orderId={orderId} tab={tab} />
        </TabsContent>

        <TabsContent value="deal" className="mt-4">
          <DealPanel orderId={orderId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
