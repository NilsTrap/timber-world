"use client";

import { useState } from "react";
import type { PackageListItem } from "@/features/shipments/types";
import type { ProductionInput, ProductionOutput, ReferenceDropdowns } from "../types";
import { ProductionInputsSection } from "./ProductionInputsSection";
import { ProductionOutputsSection } from "./ProductionOutputsSection";
import { ProductionSummary } from "./ProductionSummary";

interface ProductionEntryClientProps {
  productionEntryId: string;
  initialPackages: PackageListItem[];
  initialInputs: ProductionInput[];
  initialOutputs: ProductionOutput[];
  dropdowns: ReferenceDropdowns;
  processCode: string;
  initialInputTotal: number;
  initialOutputTotal: number;
}

/**
 * Production Entry Client Wrapper
 *
 * Coordinates volume totals between InputsSection, OutputsSection,
 * and ProductionSummary for live calculation updates.
 */
export function ProductionEntryClient({
  productionEntryId,
  initialPackages,
  initialInputs,
  initialOutputs,
  dropdowns,
  processCode,
  initialInputTotal,
  initialOutputTotal,
}: ProductionEntryClientProps) {
  const [inputTotalM3, setInputTotalM3] = useState(initialInputTotal);
  const [outputTotalM3, setOutputTotalM3] = useState(initialOutputTotal);

  return (
    <div className="space-y-6">
      <ProductionSummary
        inputTotalM3={inputTotalM3}
        outputTotalM3={outputTotalM3}
      />

      <ProductionInputsSection
        productionEntryId={productionEntryId}
        initialPackages={initialPackages}
        initialInputs={initialInputs}
        onTotalChange={setInputTotalM3}
      />

      <ProductionOutputsSection
        productionEntryId={productionEntryId}
        initialOutputs={initialOutputs}
        dropdowns={dropdowns}
        inputs={initialInputs}
        processCode={processCode}
        onTotalChange={setOutputTotalM3}
      />
    </div>
  );
}
