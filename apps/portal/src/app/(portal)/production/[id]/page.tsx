import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProductionEntry,
  getAvailablePackages,
  getProductionInputs,
  getReferenceDropdownsForProducer,
  getProductionOutputs,
} from "@/features/production/actions";
import { ProductionEntryClient } from "@/features/production/components/ProductionEntryClient";
import type { PackageListItem } from "@/features/shipments/types";
import type { ProductionInput, ProductionOutput, ReferenceDropdowns } from "@/features/production/types";

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
 * Uses ProductionEntryClient to coordinate live calculations between
 * inputs, outputs, and summary sections.
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

  const { processName, processCode, productionDate: rawDate, status } = result.data;
  const productionDate = new Date(rawDate + "T00:00:00").toLocaleDateString();
  const isDraft = status === "draft";

  // Fetch inputs + outputs data for draft entries
  let initialPackages: PackageListItem[] = [];
  let initialInputs: ProductionInput[] = [];
  let initialOutputs: ProductionOutput[] = [];
  let dropdowns: ReferenceDropdowns = {
    productNames: [], woodSpecies: [], humidity: [],
    types: [], processing: [], fsc: [], quality: [],
  };

  if (isDraft) {
    const [pkgResult, inputResult, outputResult, dropdownResult] = await Promise.all([
      getAvailablePackages(id),
      getProductionInputs(id),
      getProductionOutputs(id),
      getReferenceDropdownsForProducer(),
    ]);
    if (pkgResult.success) initialPackages = pkgResult.data;
    if (inputResult.success) initialInputs = inputResult.data;
    if (outputResult.success) initialOutputs = outputResult.data;
    if (dropdownResult.success) dropdowns = dropdownResult.data;
  }

  // Compute initial totals server-side for instant display (no layout shift)
  const initialInputTotal = initialInputs.reduce((sum, i) => sum + i.volumeM3, 0);
  const initialOutputTotal = initialOutputs.reduce((sum, o) => sum + (o.volumeM3 || 0), 0);

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

      {isDraft && (
        <ProductionEntryClient
          productionEntryId={id}
          initialPackages={initialPackages}
          initialInputs={initialInputs}
          initialOutputs={initialOutputs}
          dropdowns={dropdowns}
          processCode={processCode}
          initialInputTotal={initialInputTotal}
          initialOutputTotal={initialOutputTotal}
        />
      )}
    </div>
  );
}
