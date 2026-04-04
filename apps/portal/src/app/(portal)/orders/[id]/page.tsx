import type { Metadata } from "next";
import { OrderDetailClient } from "@/features/orders/components/OrderDetailClient";

export const metadata: Metadata = {
  title: "Order Detail",
};

export const dynamic = "force-dynamic";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  return <OrderDetailClient orderId={id} />;
}
