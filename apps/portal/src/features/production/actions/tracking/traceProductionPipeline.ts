"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_DEPTH = 10;

export interface PipelinePackage {
  id: string;
  packageNumber: string;
  volumeM3: number | null;
  pieces: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  isTracked: boolean;
  status?: string;
  productName: string | null;
  woodSpecies: string | null;
  quality: string | null;
  typeName: string | null;
  processing: string | null;
}

export interface PipelineStage {
  entryId: string;
  entryStatus: string;
  processName: string;
  processCode: string;
  productionDate: string;
  depth: number;
  inputs: PipelinePackage[];
  outputs: PipelinePackage[];
  totalInputM3: number;
  totalOutputM3: number;
  outcomePercentage: number;
  hasOutsidePackages: boolean;
  outsidePackageCount: number;
}

export interface PipelineResult {
  stages: PipelineStage[];
  seedPackages: PipelinePackage[];
  remainingPackages: PipelinePackage[];
  finalPackages: PipelinePackage[];
  shippedPackages: PipelinePackage[];
}

/**
 * Trace the full production pipeline from seed packages in a tracking set.
 *
 * Algorithm:
 * 1. Get seed package IDs from production_tracking_packages
 * 2. Find portal_production_inputs where package_id IN seeds -> get production entries
 * 3. For each entry, get ALL inputs (to detect outside packages) and outputs
 * 4. Find inventory_packages created by those entries (production_entry_id = entry.id)
 * 5. Those output packages become the next seed set
 * 6. Repeat until no more entries found (max depth 10)
 * 7. Group into pipeline stages with process name, volumes, percentages
 * 8. Also identify "remaining" packages (seeds not consumed by any production)
 */
export async function traceProductionPipeline(
  trackingSetId: string
): Promise<ActionResult<PipelineResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!trackingSetId || !UUID_REGEX.test(trackingSetId)) {
    return { success: false, error: "Invalid tracking set ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Verify ownership of tracking set
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: set, error: setError } = await (supabase as any)
    .from("production_tracking_sets")
    .select("id, organisation_id")
    .eq("id", trackingSetId)
    .single();

  if (setError || !set) {
    return { success: false, error: "Tracking set not found", code: "NOT_FOUND" };
  }

  if (isOrganisationUser(session) && !isSuperAdmin(session) && set.organisation_id !== session.organisationId) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Step 1: Get seed package IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trackingRows, error: trackingError } = await (supabase as any)
    .from("production_tracking_packages")
    .select("package_id")
    .eq("tracking_set_id", trackingSetId);

  if (trackingError) {
    return { success: false, error: trackingError.message, code: "QUERY_FAILED" };
  }

  const seedPackageIds = new Set<string>(
    ((trackingRows ?? []) as any[]).map((r: any) => r.package_id)
  );

  if (seedPackageIds.size === 0) {
    return {
      success: true,
      data: {
        stages: [],
        seedPackages: [],
        remainingPackages: [],
        finalPackages: [],
        shippedPackages: [],
      },
    };
  }

  // Fetch all seed packages' details
  const seedPackages = await fetchPackageDetails(supabase, [...seedPackageIds], seedPackageIds);

  // Track all packages we've seen (to avoid infinite loops)
  const allTrackedPackageIds = new Set<string>(seedPackageIds);
  // Track which entries we've already processed
  const processedEntryIds = new Set<string>();

  const stages: PipelineStage[] = [];
  let currentPackageIds = new Set<string>(seedPackageIds);
  let depth = 0;

  while (currentPackageIds.size > 0 && depth < MAX_DEPTH) {
    depth++;

    // Step 2: Find production inputs that consume any of the current packages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inputRows, error: inputError } = await (supabase as any)
      .from("portal_production_inputs")
      .select("id, production_entry_id, package_id, pieces_used, volume_m3")
      .in("package_id", [...currentPackageIds]);

    if (inputError) {
      return { success: false, error: inputError.message, code: "QUERY_FAILED" };
    }

    if (!inputRows || inputRows.length === 0) {
      break; // No more production entries consume these packages
    }

    // Get unique entry IDs (skip already-processed ones)
    const entryIds = [
      ...new Set(
        (inputRows as any[])
          .map((r: any) => r.production_entry_id as string)
          .filter((id) => !processedEntryIds.has(id))
      ),
    ];

    if (entryIds.length === 0) {
      break; // All entries already processed
    }

    // Step 3: Fetch production entries with process info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entries, error: entriesError } = await (supabase as any)
      .from("portal_production_entries")
      .select("id, status, production_date, total_input_m3, total_output_m3, outcome_percentage, ref_processes(value, code)")
      .in("id", entryIds);

    if (entriesError) {
      return { success: false, error: entriesError.message, code: "QUERY_FAILED" };
    }

    const entriesMap = new Map<string, any>();
    for (const entry of (entries ?? []) as any[]) {
      entriesMap.set(entry.id, entry);
    }

    // For each entry, get ALL inputs and find output packages
    const nextPackageIds = new Set<string>();

    for (const entryId of entryIds) {
      processedEntryIds.add(entryId);
      const entry = entriesMap.get(entryId);
      if (!entry) continue;

      // Get ALL inputs for this entry (not just tracked ones)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allInputs } = await (supabase as any)
        .from("portal_production_inputs")
        .select("id, package_id, pieces_used, volume_m3")
        .eq("production_entry_id", entryId);

      // Build map of original pieces/volume from production inputs
      const inputOriginals = new Map<string, { pieces: number; volumeM3: number }>();
      for (const input of (allInputs ?? []) as any[]) {
        const existing = inputOriginals.get(input.package_id);
        inputOriginals.set(input.package_id, {
          pieces: (existing?.pieces ?? 0) + (input.pieces_used ?? 0),
          volumeM3: (existing?.volumeM3 ?? 0) + (Number(input.volume_m3) ?? 0),
        });
      }

      const allInputPackageIds = ((allInputs ?? []) as any[]).map((i: any) => i.package_id as string);
      const outsidePackageIds = allInputPackageIds.filter((id) => !allTrackedPackageIds.has(id));

      // Fetch input package details, then override with original values from production inputs
      let inputPackages: PipelinePackage[] = [];
      if (allInputPackageIds.length > 0) {
        inputPackages = await fetchPackageDetails(supabase, allInputPackageIds, allTrackedPackageIds);
        // Restore original pieces/volume for consumed input packages
        for (const pkg of inputPackages) {
          const orig = inputOriginals.get(pkg.id);
          if (orig) {
            pkg.pieces = String(orig.pieces);
            pkg.volumeM3 = orig.volumeM3;
          }
        }
      }

      // Step 4: Find output packages for this entry
      let outputPackages: PipelinePackage[];

      if (entry.status === "draft") {
        // Draft entries: read planned outputs from portal_production_outputs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: draftOutputs } = await (supabase as any)
          .from("portal_production_outputs")
          .select("id, package_number, thickness, width, length, pieces, volume_m3, ref_product_names(value), ref_wood_species(value), ref_quality(value), ref_types(value), ref_processing(value)")
          .eq("production_entry_id", entryId)
          .order("sort_order", { ascending: true });

        outputPackages = ((draftOutputs ?? []) as any[]).map((pkg: any) => ({
          id: pkg.id,
          packageNumber: pkg.package_number ?? "",
          volumeM3: pkg.volume_m3 != null ? Number(pkg.volume_m3) : null,
          pieces: pkg.pieces,
          thickness: pkg.thickness,
          width: pkg.width,
          length: pkg.length,
          isTracked: true,
          status: "planned",
          productName: pkg.ref_product_names?.value ?? null,
          woodSpecies: pkg.ref_wood_species?.value ?? null,
          quality: pkg.ref_quality?.value ?? null,
          typeName: pkg.ref_types?.value ?? null,
          processing: pkg.ref_processing?.value ?? null,
        }));
        // Draft outputs do NOT flow into the next pipeline iteration
      } else {
        // Validated entries: read actual outputs from inventory_packages
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: outputInventory } = await (supabase as any)
          .from("inventory_packages")
          .select("id, package_number, status, thickness, width, length, pieces, volume_m3, ref_product_names!inventory_packages_product_name_id_fkey(value), ref_wood_species!inventory_packages_wood_species_id_fkey(value), ref_quality!inventory_packages_quality_id_fkey(value), ref_types(value), ref_processing(value)")
          .eq("production_entry_id", entryId);

        outputPackages = ((outputInventory ?? []) as any[]).map((pkg: any) => {
          const pkgId = pkg.id as string;
          // Mark output as tracked (it flows from tracked input)
          allTrackedPackageIds.add(pkgId);
          nextPackageIds.add(pkgId);
          return {
            id: pkgId,
            packageNumber: pkg.package_number,
            volumeM3: pkg.volume_m3 != null ? Number(pkg.volume_m3) : null,
            pieces: pkg.pieces,
            thickness: pkg.thickness,
            width: pkg.width,
            length: pkg.length,
            isTracked: true,
            status: pkg.status,
            productName: pkg.ref_product_names?.value ?? null,
            woodSpecies: pkg.ref_wood_species?.value ?? null,
            quality: pkg.ref_quality?.value ?? null,
            typeName: pkg.ref_types?.value ?? null,
            processing: pkg.ref_processing?.value ?? null,
          };
        });

        // Restore original pieces/volume for output packages that were later consumed
        const consumedOutputIds = outputPackages.filter((p) => p.status === "consumed").map((p) => p.id);
        if (consumedOutputIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: consumedInputs } = await (supabase as any)
            .from("portal_production_inputs")
            .select("package_id, pieces_used, volume_m3")
            .in("package_id", consumedOutputIds);

          const outputOriginals = new Map<string, { pieces: number; volumeM3: number }>();
          for (const ci of (consumedInputs ?? []) as any[]) {
            const existing = outputOriginals.get(ci.package_id);
            outputOriginals.set(ci.package_id, {
              pieces: (existing?.pieces ?? 0) + (ci.pieces_used ?? 0),
              volumeM3: (existing?.volumeM3 ?? 0) + (Number(ci.volume_m3) ?? 0),
            });
          }
          for (const pkg of outputPackages) {
            const orig = outputOriginals.get(pkg.id);
            if (orig) {
              pkg.pieces = String(orig.pieces);
              pkg.volumeM3 = orig.volumeM3;
            }
          }
        }
      }

      // Calculate totals
      const totalInputM3 = inputPackages.reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0);
      const totalOutputM3 = outputPackages.reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0);
      const outcomePercentage = totalInputM3 > 0
        ? Math.round((totalOutputM3 / totalInputM3) * 10000) / 100
        : 0;

      stages.push({
        entryId,
        entryStatus: entry.status ?? "draft",
        processName: entry.ref_processes?.value ?? "Unknown",
        processCode: entry.ref_processes?.code ?? "",
        productionDate: entry.production_date ?? "",
        depth,
        inputs: inputPackages,
        outputs: outputPackages,
        totalInputM3,
        totalOutputM3,
        outcomePercentage,
        hasOutsidePackages: outsidePackageIds.length > 0,
        outsidePackageCount: outsidePackageIds.length,
      });
    }

    // Next iteration: use output packages as the new seed set
    currentPackageIds = nextPackageIds;
  }

  // Identify remaining packages (seeds not consumed by any validated production)
  const consumedPackageIds = new Set<string>();
  for (const stage of stages) {
    // Only count inputs to validated stages as truly consumed
    if (stage.entryStatus !== "draft") {
      for (const input of stage.inputs) {
        if (input.isTracked) {
          consumedPackageIds.add(input.id);
        }
      }
    }
  }

  // Remaining = seed packages that were never consumed by a validated stage
  const remainingPackages = seedPackages.filter((p) => !consumedPackageIds.has(p.id));

  // Final packages = output packages not consumed by a validated subsequent stage
  const allOutputIds = new Set<string>();
  for (const stage of stages) {
    // Only count outputs from validated stages (draft outputs are "planned", not real)
    if (stage.entryStatus !== "draft") {
      for (const output of stage.outputs) {
        allOutputIds.add(output.id);
      }
    }
  }

  const consumedByValidated = new Set<string>();
  for (const stage of stages) {
    // Only inputs to validated stages count as truly consumed
    if (stage.entryStatus !== "draft") {
      for (const input of stage.inputs) {
        consumedByValidated.add(input.id);
      }
    }
  }

  // Final = validated outputs that were never consumed as inputs in a subsequent validated stage
  const finalPackageIds = [...allOutputIds].filter((id) => !consumedByValidated.has(id));
  const finalPackages = finalPackageIds.length > 0
    ? await fetchPackageDetails(supabase, finalPackageIds, allTrackedPackageIds)
    : [];

  // Shipped packages = final packages with status containing "shipped" or that have an outgoing shipment
  const shippedPackages = finalPackages.filter((p) => p.status === "shipped");
  const nonShippedFinal = finalPackages.filter((p) => p.status !== "shipped");

  return {
    success: true,
    data: {
      stages,
      seedPackages,
      remainingPackages,
      finalPackages: nonShippedFinal,
      shippedPackages,
    },
  };
}

/**
 * Helper: fetch package details for a list of IDs
 */
async function fetchPackageDetails(
  supabase: any,
  packageIds: string[],
  trackedIds: Set<string>
): Promise<PipelinePackage[]> {
  if (packageIds.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("inventory_packages")
    .select("id, package_number, status, thickness, width, length, pieces, volume_m3, ref_product_names!inventory_packages_product_name_id_fkey(value), ref_wood_species!inventory_packages_wood_species_id_fkey(value), ref_quality!inventory_packages_quality_id_fkey(value), ref_types(value), ref_processing(value)")
    .in("id", packageIds);

  const packages = ((data ?? []) as any[]).map((pkg: any) => ({
    id: pkg.id,
    packageNumber: pkg.package_number,
    volumeM3: pkg.volume_m3 != null ? Number(pkg.volume_m3) : null,
    pieces: pkg.pieces,
    thickness: pkg.thickness,
    width: pkg.width,
    length: pkg.length,
    isTracked: trackedIds.has(pkg.id),
    status: pkg.status,
    productName: pkg.ref_product_names?.value ?? null,
    woodSpecies: pkg.ref_wood_species?.value ?? null,
    quality: pkg.ref_quality?.value ?? null,
    typeName: pkg.ref_types?.value ?? null,
    processing: pkg.ref_processing?.value ?? null,
  }));

  // Restore original pieces/volume for consumed packages
  const consumedIds = packages.filter((p) => p.status === "consumed").map((p) => p.id);
  if (consumedIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inputsData } = await (supabase as any)
      .from("portal_production_inputs")
      .select("package_id, pieces_used, volume_m3")
      .in("package_id", consumedIds);

    const origMap = new Map<string, { pieces: number; volumeM3: number }>();
    for (const input of (inputsData ?? []) as any[]) {
      const existing = origMap.get(input.package_id);
      origMap.set(input.package_id, {
        pieces: (existing?.pieces ?? 0) + (input.pieces_used ?? 0),
        volumeM3: (existing?.volumeM3 ?? 0) + (Number(input.volume_m3) ?? 0),
      });
    }
    for (const pkg of packages) {
      const orig = origMap.get(pkg.id);
      if (orig) {
        pkg.pieces = String(orig.pieces);
        pkg.volumeM3 = orig.volumeM3;
      }
    }
  }

  return packages;
}
