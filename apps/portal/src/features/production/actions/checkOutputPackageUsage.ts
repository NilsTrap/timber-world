"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

interface PackageUsageInfo {
  packageId: string;
  packageNumber: string;
  usedInProcessName: string;
  usedInProductionDate: string;
  usedInEntryId: string;
}

export interface OutputPackageUsageResult {
  /** Whether any output packages are used elsewhere */
  hasUsedPackages: boolean;
  /** List of packages that are used as inputs in other processes */
  usedPackages: PackageUsageInfo[];
  /** List of packages that can be deleted/edited */
  freePackages: { packageId: string; packageNumber: string }[];
  /** Total output package count */
  totalCount: number;
}

/**
 * Check which output packages from a validated production entry
 * are used as inputs in other production processes.
 *
 * Used to determine:
 * - Whether a validated entry can be deleted (no used packages)
 * - Which packages should be read-only during editing
 */
export async function checkOutputPackageUsage(
  productionEntryId: string
): Promise<ActionResult<OutputPackageUsageResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // Fetch the production entry to get organisation_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, organisation_id, status")
    .eq("id", productionEntryId)
    .single();

  if (entryError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  if (entry.status !== "validated") {
    return { success: false, error: "Only validated entries have output packages", code: "VALIDATION_FAILED" };
  }

  // Get all inventory packages created by this production entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outputPackages, error: packagesError } = await (supabase as any)
    .from("inventory_packages")
    .select("id, package_number")
    .eq("production_entry_id", productionEntryId);

  if (packagesError) {
    return { success: false, error: packagesError.message, code: "QUERY_FAILED" };
  }

  if (!outputPackages || outputPackages.length === 0) {
    return {
      success: true,
      data: {
        hasUsedPackages: false,
        usedPackages: [],
        freePackages: [],
        totalCount: 0,
      },
    };
  }

  const packageIds = outputPackages.map((p: { id: string }) => p.id);
  const packageMap = new Map<string, string>(
    outputPackages.map((p: { id: string; package_number: string }) => [p.id, p.package_number])
  );

  // Find which packages are used as inputs in OTHER production entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usedInputs, error: inputsError } = await (supabase as any)
    .from("portal_production_inputs")
    .select(`
      package_id,
      production_entry_id,
      portal_production_entries!inner(
        id,
        production_date,
        ref_processes(value)
      )
    `)
    .in("package_id", packageIds)
    .neq("production_entry_id", productionEntryId);

  if (inputsError) {
    return { success: false, error: inputsError.message, code: "QUERY_FAILED" };
  }

  const usedPackageIds = new Set<string>();
  const usedPackages: PackageUsageInfo[] = [];

  for (const input of usedInputs || []) {
    const pkgId = input.package_id;
    if (!usedPackageIds.has(pkgId)) {
      usedPackageIds.add(pkgId);
      usedPackages.push({
        packageId: pkgId,
        packageNumber: packageMap.get(pkgId) || "",
        usedInProcessName: input.portal_production_entries?.ref_processes?.value || "Unknown",
        usedInProductionDate: input.portal_production_entries?.production_date || "",
        usedInEntryId: input.production_entry_id,
      });
    }
  }

  const freePackages = outputPackages
    .filter((p: { id: string }) => !usedPackageIds.has(p.id))
    .map((p: { id: string; package_number: string }) => ({
      packageId: p.id,
      packageNumber: p.package_number,
    }));

  return {
    success: true,
    data: {
      hasUsedPackages: usedPackages.length > 0,
      usedPackages,
      freePackages,
      totalCount: outputPackages.length,
    },
  };
}
