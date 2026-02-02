import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { getSession, isSuperAdmin } from "@/lib/auth";
import {
  getProductionEntry,
  getAvailablePackages,
  getProductionInputs,
  getReferenceDropdownsForProducer,
  getProductionOutputs,
} from "@/features/production/actions";
import { ProductionEntryClient } from "@/features/production/components/ProductionEntryClient";
import { CreateCorrectionButton } from "@/features/production/components/CreateCorrectionButton";
import { DeleteDraftButton } from "@/features/production/components/DeleteDraftButton";
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
  const session = await getSession();
  const isUserSuperAdmin = isSuperAdmin(session);

  const result = await getProductionEntry(id);

  if (!result.success) {
    notFound();
  }

  const { processName, processCode, productionDate: rawDate, status, entryType, correctsEntryId } = result.data;
  const productionDate = formatDate(rawDate);
  const isDraft = status === "draft";
  const isCorrection = entryType === "correction";

  // Fetch inputs + outputs data for all entries
  let initialPackages: PackageListItem[] = [];
  let initialInputs: ProductionInput[] = [];
  let initialOutputs: ProductionOutput[] = [];
  let dropdowns: ReferenceDropdowns = {
    productNames: [], woodSpecies: [], humidity: [],
    types: [], processing: [], fsc: [], quality: [],
  };

  // Always fetch inputs, outputs, and dropdowns (dropdowns needed to display values in read-only too)
  const [inputResult, outputResult, dropdownResult] = await Promise.all([
    getProductionInputs(id),
    getProductionOutputs(id),
    getReferenceDropdownsForProducer(),
  ]);
  if (inputResult.success) initialInputs = inputResult.data;
  if (outputResult.success) initialOutputs = outputResult.data;
  if (dropdownResult.success) dropdowns = dropdownResult.data;

  // Fetch packages for draft entries OR for admin editing validated entries
  if (isDraft || isUserSuperAdmin) {
    const pkgResult = await getAvailablePackages(id);
    if (pkgResult.success) initialPackages = pkgResult.data;
  }

  // Fetch original entry info if this is a correction (for reference link)
  let originalEntryInfo: { processName: string; productionDate: string } | null = null;
  if (isCorrection && correctsEntryId) {
    const originalResult = await getProductionEntry(correctsEntryId);
    if (originalResult.success) {
      originalEntryInfo = {
        processName: originalResult.data.processName,
        productionDate: formatDate(originalResult.data.productionDate),
      };
    }
  }

  // Compute initial totals server-side for instant display (no layout shift)
  const initialInputTotal = initialInputs.reduce((sum, i) => sum + i.volumeM3, 0);
  const initialOutputTotal = initialOutputs.reduce((sum, o) => sum + (o.volumeM3 || 0), 0);

  return (
    <div className="space-y-6">
      <Link
        href={isDraft ? "/production" : "/production?tab=history"}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {processName}
          </h1>
          <p className="text-muted-foreground">
            Production date: {productionDate}
          </p>
          {isCorrection && correctsEntryId && originalEntryInfo && (
            <p className="text-sm text-muted-foreground mt-1">
              Corrects:{" "}
              <Link
                href={`/production/${correctsEntryId}`}
                className="text-primary hover:underline"
              >
                {originalEntryInfo.processName} - {originalEntryInfo.productionDate}
              </Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isDraft && (
            <DeleteDraftButton entryId={id} />
          )}
          {!isDraft && isUserSuperAdmin && (
            <DeleteDraftButton entryId={id} isValidated />
          )}
          {!isDraft && !isCorrection && (
            <CreateCorrectionButton originalEntryId={id} />
          )}
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isDraft
                ? isCorrection
                  ? "bg-amber-100 text-amber-800"
                  : "bg-yellow-100 text-yellow-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {isDraft ? (isCorrection ? "Correction (Draft)" : "Draft") : isCorrection ? "Correction" : "Validated"}
          </span>
        </div>
      </div>

      <ProductionEntryClient
        productionEntryId={id}
        initialPackages={initialPackages}
        initialInputs={initialInputs}
        initialOutputs={initialOutputs}
        dropdowns={dropdowns}
        processCode={isCorrection ? "CR" : processCode}
        initialInputTotal={initialInputTotal}
        initialOutputTotal={initialOutputTotal}
        readOnly={!isDraft && !isUserSuperAdmin}
        isAdminEdit={!isDraft && isUserSuperAdmin}
        hideMetrics={isCorrection}
        processName={processName}
        productionDate={productionDate}
      />
    </div>
  );
}
