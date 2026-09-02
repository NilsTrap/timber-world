import type { DbClient } from "../../orders/services/dealModel";
import type { ProjectFileMeta } from "../types";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_SIGNING_CONCURRENCY = 8;

type OfficialImageOwnerRow = {
  spine_id: string | null;
};

type OfficialImageFileRow = {
  id: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  lifecycle_status: string;
  category: string;
  file_variant: string;
  created_at: string;
  storage_path: string;
  order: OfficialImageOwnerRow | OfficialImageOwnerRow[] | null;
};

type OfficialImageDesignationRow = {
  spine_id: string;
  position: number;
  order_files: OfficialImageFileRow | OfficialImageFileRow[] | null;
};

export type ProjectOfficialImageCapabilities = {
  canView: boolean;
  canManage: boolean;
  canRemove: boolean;
};

function firstRelation<T>(relation: T | T[] | null): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation;
}

function validDesignatedFile(
  designation: OfficialImageDesignationRow,
  expectedSpineId: string,
): OfficialImageFileRow | null {
  const file = firstRelation(designation.order_files);
  const owner = file ? firstRelation(file.order) : null;
  if (
    !file
    || !owner
    || designation.spine_id !== expectedSpineId
    || owner.spine_id !== expectedSpineId
    || file.lifecycle_status !== "ready"
    || file.category !== "project"
    || file.file_variant !== "original"
    || !file.mime_type?.startsWith("image/")
    || !file.storage_path
  ) {
    return null;
  }
  return file;
}

async function signStoragePath(admin: DbClient, storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await admin.storage
      .from("orders")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    return error ? null : data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

async function mapInBatches<T, R>(
  items: readonly T[],
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let offset = 0; offset < items.length; offset += MAX_SIGNING_CONCURRENCY) {
    results.push(...await Promise.all(
      items.slice(offset, offset + MAX_SIGNING_CONCURRENCY).map(worker),
    ));
  }
  return results;
}

export async function mayManageProjectOfficialImages(
  db: DbClient,
  input: {
    isPlatformAdmin: boolean;
    actorOrganisationId: string | null;
    sellerOrganisationId: string | null;
  },
): Promise<boolean> {
  if (input.isPlatformAdmin) return true;
  if (!input.actorOrganisationId || input.sellerOrganisationId !== input.actorOrganisationId) return false;
  const { data } = await db
    .from("organisations")
    .select("is_active,is_trader")
    .eq("id", input.actorOrganisationId)
    .maybeSingle();
  return data?.is_active === true && data.is_trader === true;
}

export async function projectOfficialImageCapabilities(
  db: DbClient,
  input: {
    spineId: string | null;
    isPlatformAdmin: boolean;
    viewerOrganisationId: string | null;
    buyerOrganisationId: string | null;
    sellerOrganisationId: string | null;
    hasDealCreate: boolean;
    isRfqCandidate?: boolean;
  },
): Promise<ProjectOfficialImageCapabilities> {
  const canView = Boolean(input.spineId);
  if (!canView || input.isRfqCandidate) {
    return { canView, canManage: false, canRemove: false };
  }

  const sellerMayMutate = await mayManageProjectOfficialImages(db, {
    isPlatformAdmin: input.isPlatformAdmin,
    actorOrganisationId: input.viewerOrganisationId,
    sellerOrganisationId: input.sellerOrganisationId,
  });
  // Add/default actions use requireVisibleProject(..., true), while removal
  // deliberately uses the read gate and keeps its existing buyer/trader rule.
  const canManage = sellerMayMutate && (input.isPlatformAdmin || input.hasDealCreate);
  const canRemove = input.isPlatformAdmin
    || Boolean(input.viewerOrganisationId && input.buyerOrganisationId === input.viewerOrganisationId)
    || sellerMayMutate;
  return { canView, canManage, canRemove };
}

export function resolveProjectThumbnailUrl(
  spineId: string | null,
  orderId: string,
  primaryThumbnailBySpine: ReadonlyMap<string, string>,
  primaryThumbnailByOrder: ReadonlyMap<string, string>,
): string | null {
  return spineId
    ? primaryThumbnailBySpine.get(spineId) ?? null
    : primaryThumbnailByOrder.get(orderId) ?? null;
}

export function sortOfficialImageDesignations<T extends { position: number }>(
  designations: readonly T[],
): T[] {
  return [...designations].sort((left, right) => left.position - right.position);
}

export async function loadSpineProjectImages(
  admin: DbClient,
  spineId: string,
): Promise<ProjectFileMeta[]> {
  let rows: OfficialImageDesignationRow[];
  try {
    const { data, error } = await admin
      .from("spine_project_images")
      .select("spine_id,position,order_file_id,order_files!inner(id,mime_type,file_size_bytes,lifecycle_status,category,file_variant,created_at,storage_path,order:orders!order_files_order_id_fkey(spine_id))")
      .eq("spine_id", spineId)
      .order("position", { ascending: true });
    if (error) return [];
    rows = sortOfficialImageDesignations((data ?? []) as OfficialImageDesignationRow[]);
  } catch {
    return [];
  }

  const images = await mapInBatches(rows, async (designation): Promise<ProjectFileMeta | null> => {
    const file = validDesignatedFile(designation, spineId);
    if (!file) return null;
    const previewUrl = await signStoragePath(admin, file.storage_path);
    if (!previewUrl) return null;
    return {
      id: file.id,
      fileName: "",
      relativePath: "",
      mimeType: file.mime_type,
      fileSizeBytes: file.file_size_bytes,
      lifecycleStatus: "ready",
      createdAt: file.created_at,
      cleanupStatus: "not_started",
      cleanFileId: null,
      wasCleaned: false,
      cleanupFindingsCount: 0,
      shared: false,
      sharedInbound: false,
      officialImagePosition: designation.position,
      previewUrl,
    };
  });
  return images.filter((image): image is ProjectFileMeta => image !== null);
}

export async function loadPrimarySpineThumbnailUrls(
  admin: DbClient,
  spineIds: readonly string[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (spineIds.length === 0) return urls;

  let rows: OfficialImageDesignationRow[];
  try {
    const { data, error } = await admin
      .from("spine_project_images")
      .select("spine_id,position,order_files!inner(id,mime_type,file_size_bytes,lifecycle_status,category,file_variant,created_at,storage_path,order:orders!order_files_order_id_fkey(spine_id))")
      .in("spine_id", spineIds)
      .eq("position", 1);
    if (error) return urls;
    rows = (data ?? []) as OfficialImageDesignationRow[];
  } catch {
    return urls;
  }

  const requestedSpines = new Set(spineIds);
  const signed = await mapInBatches(rows, async (designation) => {
    if (!requestedSpines.has(designation.spine_id)) return null;
    const file = validDesignatedFile(designation, designation.spine_id);
    if (!file || designation.position !== 1) return null;
    const url = await signStoragePath(admin, file.storage_path);
    return url ? { spineId: designation.spine_id, url } : null;
  });
  for (const entry of signed) {
    if (entry && !urls.has(entry.spineId)) urls.set(entry.spineId, entry.url);
  }
  return urls;
}
