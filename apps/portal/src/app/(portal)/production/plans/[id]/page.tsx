import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductionPlan } from "@/features/production/actions";
import { ProductionPlanDetailClient } from "@/features/production/components/ProductionPlanDetailClient";

export const metadata: Metadata = {
  title: "Production Plan",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductionPlanPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getProductionPlan(id);
  if (!result.success) {
    notFound();
  }
  return <ProductionPlanDetailClient plan={result.data} />;
}
