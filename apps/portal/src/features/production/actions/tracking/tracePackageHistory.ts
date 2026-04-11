"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../../types";
import type { PipelinePackage, PipelineStage, PipelineResult } from "./traceProductionPipeline";

const MAX_DEPTH = 10;

/**
 * Trace the full production history of a package backwards.
 *
 * Algorithm:
 * 1. Start with a single package ID
 * 2. Find the production entry that created it (inventory_packages.production_entry_id)
 * 3. Get all inputs and outputs of that entry
 * 4. For each input package, recursively find the production entry that created it
 * 5. Repeat until we reach packages with no production_entry_id (from shipments/direct)
 * 6. Return stages ordered oldest → newest (reverse of discovery order)
 */
export async function tracePackageHistory(
  packageId: string
): Promise<ActionResult<PipelineResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // Fetch the starting package details
  const startPackage = await fetchSinglePackage(supabase, packageId);
  if (!startPackage) {
    return { success: false, error: "Package not found", code: "NOT_FOUND" };
  }

  const stages: PipelineStage[] = [];
  const processedEntryIds = new Set<string>();
  const allTrackedPackageIds = new Set<string>([packageId]);

  // BFS backwards: start from target package, find producing entries
  let currentPackageIds = new Set<string>([packageId]);
  let depth = 0;

  while (currentPackageIds.size > 0 && depth < MAX_DEPTH) {
    depth++;

    // Find which production entries created these packages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: createdPackages } = await (supabase as any)
      .from("inventory_packages")
      .select("id, production_entry_id")
      .in("id", [...currentPackageIds])
      .not("production_entry_id", "is", null);

    if (!createdPackages || createdPackages.length === 0) break;

    // Get unique entry IDs that created these packages
    const entryIds = [
      ...new Set(
        (createdPackages as any[])
          .map((p: any) => p.production_entry_id as string)
          .filter((id) => !processedEntryIds.has(id))
      ),
    ];

    if (entryIds.length === 0) break;

    // Fetch production entries with process info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entries } = await (supabase as any)
      .from("portal_production_entries")
      .select("id, status, production_date, ref_processes(value, code)")
      .in("id", entryIds);

    const entriesMap = new Map<string, any>();
    for (const entry of (entries ?? []) as any[]) {
      entriesMap.set(entry.id, entry);
    }

    const nextPackageIds = new Set<string>();

    for (const entryId of entryIds) {
      processedEntryIds.add(entryId);
      const entry = entriesMap.get(entryId);
      if (!entry) continue;

      // Get all inputs for this entry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allInputs } = await (supabase as any)
        .from("portal_production_inputs")
        .select("id, package_id, pieces_used, volume_m3")
        .eq("production_entry_id", entryId);

      const inputOriginals = new Map<string, { pieces: number; volumeM3: number }>();
      for (const input of (allInputs ?? []) as any[]) {
        const existing = inputOriginals.get(input.package_id);
        inputOriginals.set(input.package_id, {
          pieces: (existing?.pieces ?? 0) + (input.pieces_used ?? 0),
          volumeM3: (existing?.volumeM3 ?? 0) + (Number(input.volume_m3) ?? 0),
        });
      }

      const allInputPackageIds = ((allInputs ?? []) as any[]).map((i: any) => i.package_id as string);

      // Fetch input package details
      let inputPackages: PipelinePackage[] = [];
      if (allInputPackageIds.length > 0) {
        inputPackages = await fetchPackageDetails(supabase, allInputPackageIds, allTrackedPackageIds);
        // Restore original pieces/volume
        for (const pkg of inputPackages) {
          const orig = inputOriginals.get(pkg.id);
          if (orig) {
            pkg.pieces = String(orig.pieces);
            pkg.volumeM3 = orig.volumeM3;
          }
        }
        // Mark input packages as tracked and queue for next iteration
        for (const id of allInputPackageIds) {
          allTrackedPackageIds.add(id);
          nextPackageIds.add(id);
        }
      }

      // Get outputs for this entry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: outputInventory } = await (supabase as any)
        .from("inventory_packages")
        .select("id, package_number, status, shipment_id, thickness, width, length, pieces, volume_m3, ref_product_names!inventory_packages_product_name_id_fkey(value), ref_wood_species!inventory_packages_wood_species_id_fkey(value), ref_quality!inventory_packages_quality_id_fkey(value), ref_types(value), ref_processing(value), shipments!inventory_packages_shipment_id_fkey(shipment_code, status)")
        .eq("production_entry_id", entryId);

      const outputPackages: PipelinePackage[] = ((outputInventory ?? []) as any[]).map((pkg: any) => {
        allTrackedPackageIds.add(pkg.id);
        return {
          id: pkg.id,
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
          isOnTheWay: pkg.shipments?.status === "pending",
          isShipped: pkg.shipments?.status === "completed" || pkg.status === "shipped",
          shipmentCode: pkg.shipments?.shipment_code ?? null,
        };
      });

      // Restore original pieces/volume for output packages that were later consumed
      // (their inventory_packages values may have been reduced/zeroed when used as input elsewhere)
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
        hasOutsidePackages: false,
        outsidePackageCount: 0,
      });
    }

    currentPackageIds = nextPackageIds;
  }

  // Reverse stages so they go oldest → newest (natural reading order)
  stages.reverse();
  // Re-assign depths so oldest = 1
  stages.forEach((s, i) => { s.depth = i + 1; });

  // Seed packages = the inputs of the oldest stage that have no production_entry_id (from shipments)
  const originPackageIds = new Set<string>();
  const firstStage = stages[0];
  if (firstStage) {
    for (const input of firstStage.inputs) {
      // Check if this package was NOT created by any production entry we found
      const createdByTracked = stages.some((s) => s.outputs.some((o) => o.id === input.id));
      if (!createdByTracked) {
        originPackageIds.add(input.id);
      }
    }
  }
  const seedPackages = originPackageIds.size > 0
    ? await fetchPackageDetails(supabase, [...originPackageIds], allTrackedPackageIds)
    : [];

  // Collect all final output packages (outputs of the last stage that aren't inputs to another stage)
  const lastStage = stages[stages.length - 1];
  const allFinalPackages = lastStage
    ? lastStage.outputs
    : [startPackage];

  const shippedPackages = allFinalPackages.filter((p) => p.isShipped);
  const onTheWayPackages = allFinalPackages.filter((p) => !p.isShipped && p.isOnTheWay);
  const availablePackages = allFinalPackages.filter((p) => !p.isShipped && !p.isOnTheWay);

  return {
    success: true,
    data: {
      stages,
      seedPackages,
      remainingPackages: [],
      finalPackages: availablePackages,
      onTheWayPackages,
      shippedPackages,
    },
  };
}

async function fetchSinglePackage(
  supabase: any,
  packageId: string
): Promise<PipelinePackage | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("inventory_packages")
    .select("id, package_number, status, shipment_id, thickness, width, length, pieces, volume_m3, ref_product_names!inventory_packages_product_name_id_fkey(value), ref_wood_species!inventory_packages_wood_species_id_fkey(value), ref_quality!inventory_packages_quality_id_fkey(value), ref_types(value), ref_processing(value), shipments!inventory_packages_shipment_id_fkey(shipment_code, status)")
    .eq("id", packageId)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    packageNumber: data.package_number,
    volumeM3: data.volume_m3 != null ? Number(data.volume_m3) : null,
    pieces: data.pieces,
    thickness: data.thickness,
    width: data.width,
    length: data.length,
    isTracked: true,
    status: data.status,
    productName: data.ref_product_names?.value ?? null,
    woodSpecies: data.ref_wood_species?.value ?? null,
    quality: data.ref_quality?.value ?? null,
    typeName: data.ref_types?.value ?? null,
    processing: data.ref_processing?.value ?? null,
    isOnTheWay: data.shipments?.status === "pending",
    isShipped: data.shipments?.status === "completed" || data.status === "shipped",
    shipmentCode: data.shipments?.shipment_code ?? null,
  };
}

async function fetchPackageDetails(
  supabase: any,
  packageIds: string[],
  trackedIds: Set<string>
): Promise<PipelinePackage[]> {
  if (packageIds.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("inventory_packages")
    .select("id, package_number, status, shipment_id, thickness, width, length, pieces, volume_m3, ref_product_names!inventory_packages_product_name_id_fkey(value), ref_wood_species!inventory_packages_wood_species_id_fkey(value), ref_quality!inventory_packages_quality_id_fkey(value), ref_types(value), ref_processing(value), shipments!inventory_packages_shipment_id_fkey(shipment_code, status)")
    .in("id", packageIds);

  return ((data ?? []) as any[]).map((pkg: any) => ({
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
    isOnTheWay: pkg.shipments?.status === "pending",
    isShipped: pkg.shipments?.status === "completed" || pkg.status === "shipped",
    shipmentCode: pkg.shipments?.shipment_code ?? null,
  }));
}
