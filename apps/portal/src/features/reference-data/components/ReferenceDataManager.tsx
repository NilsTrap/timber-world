"use client";

import { useState } from "react";
import { ReferenceTableSelector } from "./ReferenceTableSelector";
import { ReferenceOptionsTable } from "./ReferenceOptionsTable";
import type { ReferenceTableName } from "../types";

interface ReferenceDataManagerProps {
  /** If true, shows delete button for each option (Super Admin only) */
  canDelete?: boolean;
  /** If provided, shows per-org enable/disable checkboxes */
  organisationId?: string;
}

/**
 * Reference Data Manager
 *
 * Main component for managing reference data. Combines table selector and options table.
 * When organisationId is provided, adds per-org enable/disable toggles.
 */
export function ReferenceDataManager({ canDelete = false, organisationId }: ReferenceDataManagerProps) {
  const [selectedTable, setSelectedTable] =
    useState<ReferenceTableName>("ref_product_names");

  return (
    <div className="space-y-6">
      <ReferenceTableSelector
        selectedTable={selectedTable}
        onTableChange={setSelectedTable}
      />

      <ReferenceOptionsTable
        tableName={selectedTable}
        canDelete={canDelete}
        organisationId={organisationId}
      />
    </div>
  );
}
