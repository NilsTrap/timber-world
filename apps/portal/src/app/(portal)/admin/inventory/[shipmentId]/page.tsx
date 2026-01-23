import { notFound } from "next/navigation";
import { ShipmentDetailView } from "@/features/shipments/components/ShipmentDetailView";
import { getShipmentDetail } from "@/features/shipments/actions";
import { isValidUUID } from "@/features/shipments/types";

interface ShipmentDetailPageProps {
  params: Promise<{ shipmentId: string }>;
}

export default async function ShipmentDetailPage({ params }: ShipmentDetailPageProps) {
  const { shipmentId } = await params;

  if (!isValidUUID(shipmentId)) {
    notFound();
  }

  const result = await getShipmentDetail(shipmentId);

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      notFound();
    }
    throw new Error(result.error);
  }

  return <ShipmentDetailView shipment={result.data} />;
}
