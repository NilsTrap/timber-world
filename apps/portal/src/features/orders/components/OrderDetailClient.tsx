"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getOrder } from "../actions/getOrder";
import { getOrderPackages } from "../actions/getOrderPackages";
import type { Order } from "../types";
import type { OrderPackage } from "../actions/getOrderPackages";
import { getStatusLabel } from "../types";
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

interface OrderDetailClientProps {
  orderId: string;
}

export function OrderDetailClient({ orderId }: OrderDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [order, setOrder] = useState<Order | null>(null);
  const [packages, setPackages] = useState<OrderPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    sessionStorage.setItem(ORDER_LAST_ENTRY_KEY, pathname);
  }, [pathname]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [orderResult, pkgResult] = await Promise.all([
      getOrder(orderId),
      getOrderPackages(orderId),
    ]);

    if (!orderResult.success) {
      sessionStorage.removeItem(ORDER_LAST_ENTRY_KEY);
      router.replace("/orders");
      return;
    }

    setOrder(orderResult.data);
    if (pkgResult.success) setPackages(pkgResult.data);
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

  if (!order) return null;

  const isDraft = order.status === "draft";

  // Split packages by status
  const orderedPackages = packages.filter((p) => p.status === "ordered");
  const producedPackages = packages.filter((p) => p.status !== "ordered");

  const totalOrderedPieces = orderedPackages.reduce(
    (sum, p) => sum + (p.pieces ? parseInt(p.pieces, 10) || 0 : 0), 0
  );
  const totalOrderedVolume = orderedPackages.reduce(
    (sum, p) => sum + (p.volumeM3 || 0), 0
  );
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
            {order.code} — {order.name}
          </h1>
          <p className="text-muted-foreground">
            {order.organisationName} · {order.orderDate}
          </p>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-800"}`}
        >
          {getStatusLabel(order.status)}
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ordered Packages</p>
          <p className="text-2xl font-semibold">{orderedPackages.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ordered Volume</p>
          <p className="text-2xl font-semibold">
            {totalOrderedVolume.toFixed(4)} m³
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Produced Packages</p>
          <p className="text-2xl font-semibold">{producedPackages.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Produced Volume</p>
          <p className="text-2xl font-semibold">
            {totalProducedVolume.toFixed(4)} m³
          </p>
        </div>
      </div>

      {/* Ordered Packages */}
      <OrderPackagesTable
        title="Ordered Packages"
        subtitle={`${orderedPackages.length} packages · ${totalOrderedPieces} pcs · ${totalOrderedVolume.toFixed(4)} m³`}
        packages={orderedPackages}
        orderId={orderId}
        organisationId={order.organisationId}
        editable={isDraft}
        onChanged={loadData}
      />

      {/* Produced Packages (shown only when there are any) */}
      {producedPackages.length > 0 && (
        <OrderPackagesTable
          title="Produced Packages"
          subtitle={`${producedPackages.length} packages · ${totalProducedPieces} pcs · ${totalProducedVolume.toFixed(4)} m³`}
          packages={producedPackages}
          orderId={orderId}
          organisationId={order.organisationId}
          editable={false}
          onChanged={loadData}
        />
      )}
    </div>
  );
}
