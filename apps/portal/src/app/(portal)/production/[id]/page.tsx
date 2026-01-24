import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import {
  getProductionEntry,
  getAvailablePackages,
  getProductionInputs,
} from "@/features/production/actions";
import { ProductionInputsSection } from "@/features/production/components/ProductionInputsSection";
import type { PackageListItem } from "@/features/shipments/types";
import type { ProductionInput } from "@/features/production/types";

export const metadata: Metadata = {
  title: "Production Entry",
};

interface ProductionEntryPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Production Entry Detail Page
 *
 * Shows a single production entry with process, date, and status.
 * Placeholder for inputs/outputs sections (Stories 4.2-4.3).
 *
 * TODO [i18n]: Replace hardcoded text with useTranslations()
 */
export default async function ProductionEntryPage({
  params,
}: ProductionEntryPageProps) {
  const { id } = await params;

  const result = await getProductionEntry(id);

  if (!result.success) {
    notFound();
  }

  const { processName, productionDate: rawDate, status } = result.data;
  const productionDate = new Date(rawDate + "T00:00:00").toLocaleDateString();
  const isDraft = status === "draft";

  // Fetch inputs data for draft entries
  let initialPackages: PackageListItem[] = [];
  let initialInputs: ProductionInput[] = [];

  if (isDraft) {
    const [pkgResult, inputResult] = await Promise.all([
      getAvailablePackages(id),
      getProductionInputs(id),
    ]);
    if (pkgResult.success) initialPackages = pkgResult.data;
    if (inputResult.success) initialInputs = inputResult.data;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {processName}
          </h1>
          <p className="text-muted-foreground">
            Production date: {productionDate}
          </p>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            isDraft
              ? "bg-yellow-100 text-yellow-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {isDraft ? "Draft" : "Validated"}
        </span>
      </div>

      {/* Inputs Section */}
      {isDraft && (
        <ProductionInputsSection
          productionEntryId={id}
          initialPackages={initialPackages}
          initialInputs={initialInputs}
        />
      )}

      {/* Outputs Section — Story 4.3 */}
      <div className="rounded-lg border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center justify-center text-center">
          <Package className="h-10 w-10 text-muted-foreground mb-3" />
          <h2 className="text-base font-semibold mb-1">Outputs</h2>
          <p className="text-sm text-muted-foreground">
            Record the output packages from production.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Coming in Story 4.3
          </p>
        </div>
      </div>
    </div>
  );
}
