"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
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

const ORDER_LAST_ENTRY_KEY = "order-last-entry";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  pending: "bg-blue-100 text-blue-800",
  confirmed: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-purple-100 text-purple-800",
  shipped: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
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
  const [order, setOrder] = useState<Order | null>(null);
  const [packages, setPackages] = useState<OrderPackage[]>([]);
  const [dropdowns, setDropdowns] = useState<RefDropdowns | null>(null);
  const [staircaseCodes, setStaircaseCodes] = useState<StaircaseCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const search = searchParams.toString();
    sessionStorage.setItem(ORDER_LAST_ENTRY_KEY, search ? `${pathname}?${search}` : pathname);
  }, [pathname, searchParams]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [orderResult, pkgResult, refsResult, codesResult] = await Promise.all([
      getOrder(orderId),
      getOrderPackages(orderId),
      getReferenceDropdowns(),
      getStaircaseCodes(),
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
    setIsLoading(false);
  }, [orderId, router]);

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
      {/* Back link */}
      <Link
        href="/orders"
        onClick={() => sessionStorage.removeItem(ORDER_LAST_ENTRY_KEY)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to orders
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {order.name}
          </h1>
          <p className="text-muted-foreground">
            {order.customerOrganisationName}
            {order.sellerOrganisationName && <> · Seller: {order.sellerOrganisationName}</>}
            {order.producerOrganisationName && <> · Producer: {order.producerOrganisationName}</>}
            {" · Received: "}{order.dateReceived}{order.dateLoaded && <>{" · Loaded: "}{order.dateLoaded}</>}
          </p>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-800"}`}
        >
          {getStatusLabel(order.status)}
        </span>
      </div>

      {/* Ordered Products - DataEntryTable */}
      <OrderProductsSection
        orderId={orderId}
        organisationId={order.customerOrganisationId}
        initialPackages={orderedPackages}
        dropdowns={dropdowns}
        staircaseCodes={staircaseCodes}
        readOnly={!isEditable}
        hiddenColumns={tab === "list" ? LIST_TAB_HIDDEN_COLUMNS : tab === "sales" ? SALES_TAB_HIDDEN_COLUMNS : tab === "production" ? PRODUCTION_TAB_HIDDEN_COLUMNS : undefined}
      />

      {/* Produced Packages (shown only when there are any) */}
      {producedPackages.length > 0 && (
        <OrderPackagesTable
          title="Produced Packages"
          subtitle={`${producedPackages.length} packages · ${totalProducedPieces} pcs · ${totalProducedVolume.toFixed(4)} m³`}
          packages={producedPackages}
          orderId={orderId}
          organisationId={order.customerOrganisationId}
          editable={false}
          onChanged={loadData}
        />
      )}
    </div>
  );
}
