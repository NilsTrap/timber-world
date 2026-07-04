"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, Loader2 } from "lucide-react";
import { Button } from "@timber/ui";
import { DealPanel } from "./DealPanel";
import { StageBadge } from "./StageBadge";
import { getOrder } from "../actions/getOrder";
import type { Order } from "../types";

const ORDER_LAST_ENTRY_KEY = "order-last-entry";

interface OrderDetailClientProps {
  orderId: string;
}

/** Latvian date format — DD.MM.YYYY. Tolerates legacy free-text values. */
function fmtDateLV(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/**
 * Order detail = the DEAL view (the legacy Order tab was retired — everything is
 * a deal now, Nils/Edgars 2026-07-04). The page header states the deal identity
 * (direction · stage · facing party · code) alongside the parties + created date;
 * the pipeline and the rest live in DealPanel.
 */
export function OrderDetailClient({ orderId }: OrderDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const search = searchParams.toString();
    sessionStorage.setItem(ORDER_LAST_ENTRY_KEY, search ? `${pathname}?${search}` : pathname);
  }, [pathname, searchParams]);

  const loadOrder = useCallback(async () => {
    const res = await getOrder(orderId);
    if (!res.success) {
      sessionStorage.removeItem(ORDER_LAST_ENTRY_KEY);
      router.replace("/orders");
      return;
    }
    setOrder(res.data);
    setIsLoading(false);
  }, [orderId, router]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  if (isLoading || !order) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isBuy = order.dealKind === "purchase_only";
  const facing = isBuy
    ? { role: "supplier", name: order.sellerOrganisationName }
    : { role: "customer", name: order.customerOrganisationName };
  const title =
    order.name && order.name.trim() !== "-" ? order.name : (order.dealCode || order.code || "Deal");

  return (
    <div className="space-y-6">
      {/* Header — deal identity + parties + created date (the legacy Order/Deal
          tabs are gone; DealPanel renders the pipeline + everything below). */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/orders" onClick={() => sessionStorage.removeItem(ORDER_LAST_ENTRY_KEY)}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to orders</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight truncate">{title}</h1>
          {order.dealCode && <span className="ml-auto font-mono text-sm text-muted-foreground">{order.dealCode}</span>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{isBuy ? "Buy deal" : "Sell deal"}</span>
          {order.lifecycleStage && <StageBadge stage={order.lifecycleStage} strikeThrough={order.lifecycleStage === "cancelled"} />}
          <span className="text-muted-foreground">facing {facing.role}</span>
          <span className="font-medium">{facing.name || "—"}</span>
        </div>

        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
          {order.customerOrganisationName && (
            <div className="flex gap-2"><dt className="text-muted-foreground">Customer</dt><dd className="font-medium">{order.customerOrganisationName}</dd></div>
          )}
          {order.sellerOrganisationName && (
            <div className="flex gap-2"><dt className="text-muted-foreground">Manufacturer</dt><dd className="font-medium">{order.sellerOrganisationName}</dd></div>
          )}
          {order.producerOrganisationName && (
            <div className="flex gap-2"><dt className="text-muted-foreground">Producer</dt><dd className="font-medium">{order.producerOrganisationName}</dd></div>
          )}
          <div className="flex gap-2"><dt className="text-muted-foreground">Created</dt><dd className="font-medium">{fmtDateLV(order.createdAt)}</dd></div>
          {order.dateLoaded && (
            <div className="flex gap-2"><dt className="text-muted-foreground">Loaded</dt><dd className="font-medium">{fmtDateLV(order.dateLoaded)}</dd></div>
          )}
        </dl>
      </div>

      <DealPanel orderId={orderId} onDealChanged={loadOrder} />
    </div>
  );
}
