import { notFound } from "next/navigation";
import { ShipmentDetailView } from "@/features/shipments/components/ShipmentDetailView";
import { getShipmentDetail } from "@/features/shipments/actions";

interface ShipmentDetailPageProps {
  params: Promise<{ shipmentId: string }>;
}

export default async function ShipmentDetailPage({ params }: ShipmentDetailPageProps) {
  const { shipmentId } = await params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(shipmentId)) {
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
