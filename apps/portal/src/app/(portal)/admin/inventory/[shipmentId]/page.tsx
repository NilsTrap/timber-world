import { notFound } from "next/navigation";

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shipment Details</h1>
      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground">
          Shipment detail view will be implemented in Story 2.4.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Shipment ID: <code className="font-mono">{shipmentId}</code>
        </p>
      </div>
    </div>
  );
}
