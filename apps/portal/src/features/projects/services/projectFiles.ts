/**
 * Timber Projects — file METADATA reads.
 *
 * Two hard rules, both load-bearing:
 *
 *  1. Every query runs on the caller's AUTHENTICATED client, so `order_files`
 *     RLS (`can_access_order`) is the wall. Files on a leg the viewer cannot
 *     see are invisible to this code — nothing is counted, inferred or rolled
 *     up across a spine.
 *  2. `storage_path` is NEVER selected and no signed URL is ever minted here.
 *     This foundation is read-only metadata; the file workspace (upload,
 *     preview, download, rename) is task #zka6n7.
 *
 * `summariseFileCounts` is pure and additionally discards any row whose deal is
 * not in the visible-id list — belt and braces if RLS is ever loosened.
 */
import type { DbClient } from "../../orders/services/dealModel";
import type { ProjectFileCounts, ProjectFileMeta } from "../types";

/** The only columns the count query reads. */
export interface OrderFileCountRow {
  order_id: string;
  category: string | null;
}

function emptyCounts(): ProjectFileCounts {
  return { total: 0, customer: 0, production: 0, deal: 0 };
}

/** Fold `order_files` rows into per-deal counts, keyed by deal id. Every
 *  visible id gets an entry (zeros when it has no files); rows for any other
 *  deal id are dropped. Pure — unit-tested. */
export function summariseFileCounts(
  rows: readonly OrderFileCountRow[],
  visibleIds: readonly string[],
): Map<string, ProjectFileCounts> {
  const out = new Map<string, ProjectFileCounts>();
  for (const id of visibleIds) out.set(id, emptyCounts());
  for (const row of rows) {
    const counts = out.get(row.order_id);
    if (!counts) continue; // not a deal this viewer can see — never counted
    counts.total += 1;
    if (row.category === "customer") counts.customer += 1;
    else if (row.category === "production") counts.production += 1;
    else if (row.category === "deal") counts.deal += 1;
  }
  return out;
}

/** File counts for the given (already RLS-visible) deal ids. */
export async function countFilesByDeal(
  db: DbClient,
  dealIds: readonly string[],
): Promise<Map<string, ProjectFileCounts>> {
  if (dealIds.length === 0) return new Map();
  const { data, error } = await db
    .from("order_files")
    .select("order_id, category")
    .in("order_id", dealIds as string[]);
  // A failed count must never fail the page — and must never inflate a count.
  if (error) return summariseFileCounts([], dealIds);
  return summariseFileCounts((data ?? []) as OrderFileCountRow[], dealIds);
}

/** File metadata for ONE deal. Returns [] when the deal is not visible. */
export async function listProjectFiles(db: DbClient, dealId: string): Promise<ProjectFileMeta[]> {
  const { data, error } = await db
    .from("order_files")
    .select("id, category, file_name, mime_type, file_size_bytes, created_at")
    .eq("order_id", dealId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    category: (row.category as string) ?? "deal",
    fileName: (row.file_name as string) ?? "",
    mimeType: (row.mime_type as string) ?? null,
    fileSizeBytes: (row.file_size_bytes as number) ?? null,
    createdAt: row.created_at as string,
  }));
}
