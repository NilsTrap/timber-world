import type { DbClient } from "../../../orders/services/dealModel";
import {
  loadPrimarySpineThumbnailUrls,
  loadSpineProjectImages,
  projectOfficialImageCapabilities,
} from "../projectOfficialImages";

let passed = 0;
let failed = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n expected ${JSON.stringify(expected)}\n actual ${JSON.stringify(actual)}`);
  }
}

function ok(label: string, value: boolean) {
  if (value) passed++;
  else {
    failed++;
    console.error(`✗ ${label}`);
  }
}

type SignResult = Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;

function fakeImageClient(input: {
  rows?: unknown[];
  queryError?: boolean;
  sign: (storagePath: string) => SignResult;
}): DbClient {
  const result = {
    data: input.rows ?? null,
    error: input.queryError ? { message: "query failed" } : null,
  };
  const query: Record<string, unknown> & PromiseLike<typeof result> = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return {
    from: () => query,
    storage: { from: () => ({ createSignedUrl: input.sign }) },
  } as unknown as DbClient;
}

function fakeOrganisationClient(row: { is_active: boolean; is_trader: boolean } | null): DbClient {
  const query: Record<string, unknown> = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  };
  return { from: () => query } as unknown as DbClient;
}

function file(
  id: string,
  spineId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    mime_type: "image/png",
    file_size_bytes: 100,
    lifecycle_status: "ready",
    category: "project",
    file_variant: "original",
    created_at: "2026-09-02T10:00:00Z",
    storage_path: `${id}.png`,
    order: { spine_id: spineId },
    ...overrides,
  };
}

function designation(
  spineId: string,
  position: number,
  orderFiles: Record<string, unknown> | Record<string, unknown>[],
) {
  return { spine_id: spineId, position, order_files: orderFiles };
}

async function main() {
  const signedPaths: string[] = [];
  const galleryClient = fakeImageClient({
    rows: [
      designation("spine-a", 3, [{ ...file("third", "spine-a"), order: [{ spine_id: "spine-a" }] }]),
      designation("spine-a", 2, file("second", "spine-a")),
      designation("spine-a", 1, file("first", "spine-a")),
    ],
    sign: async (storagePath) => {
      signedPaths.push(storagePath);
      return storagePath === "second.png"
        ? { data: null, error: { message: "signing failed" } }
        : { data: { signedUrl: `signed:${storagePath}` }, error: null };
    },
  });
  const gallery = await loadSpineProjectImages(galleryClient, "spine-a");
  eq("detail gallery accepts object and array relationships, preserves order, and skips one signing failure",
    gallery.map((image) => [image.id, image.officialImagePosition, image.previewUrl]),
    [["first", 1, "signed:first.png"], ["third", 3, "signed:third.png"]]);
  eq("detail gallery signs only otherwise-valid designations in canonical order",
    signedPaths, ["first.png", "second.png", "third.png"]);

  let invalidSignCalls = 0;
  const invalidGallery = await loadSpineProjectImages(fakeImageClient({
    rows: [
      designation("spine-a", 1, file("not-ready", "spine-a", { lifecycle_status: "uploading" })),
      designation("spine-a", 2, file("wrong-category", "spine-a", { category: "customer" })),
      designation("spine-a", 3, file("wrong-variant", "spine-a", { file_variant: "clean" })),
      designation("spine-a", 1, file("not-image", "spine-a", { mime_type: "application/pdf" })),
      designation("spine-a", 2, file("cross-spine", "spine-b")),
    ],
    sign: async () => {
      invalidSignCalls++;
      return { data: { signedUrl: "unexpected" }, error: null };
    },
  }), "spine-a");
  eq("detail gallery rejects unready, non-project, derivative, non-image, and cross-spine files", invalidGallery, []);
  eq("invalid detail rows are rejected before signing", invalidSignCalls, 0);

  const thrownSigningGallery = await loadSpineProjectImages(fakeImageClient({
    rows: [designation("spine-a", 1, file("throwing", "spine-a"))],
    sign: async () => { throw new Error("signer unavailable"); },
  }), "spine-a");
  eq("detail signing exceptions degrade to an empty optional gallery", thrownSigningGallery, []);
  eq("detail query errors degrade to an empty optional gallery", await loadSpineProjectImages(fakeImageClient({
    queryError: true,
    sign: async () => ({ data: { signedUrl: "unexpected" }, error: null }),
  }), "spine-a"), []);

  let activeSigners = 0;
  let maxActiveSigners = 0;
  const thumbnailRows = Array.from({ length: 12 }, (_, index) => {
    const spineId = `spine-${index}`;
    const owner = index % 2 === 0 ? { spine_id: spineId } : [{ spine_id: spineId }];
    const relation = { ...file(`thumb-${index}`, spineId), order: owner };
    return designation(spineId, 1, index % 2 === 0 ? relation : [relation]);
  });
  thumbnailRows.push(
    designation("spine-12", 1, file("not-image-thumb", "spine-12", { mime_type: "text/plain" })),
    designation("spine-13", 1, file("cross-spine-thumb", "other-spine")),
    designation("spine-14", 2, file("wrong-position-thumb", "spine-14")),
  );
  const requestedSpines = Array.from({ length: 15 }, (_, index) => `spine-${index}`);
  const thumbnails = await loadPrimarySpineThumbnailUrls(fakeImageClient({
    rows: thumbnailRows,
    sign: async (storagePath) => {
      activeSigners++;
      maxActiveSigners = Math.max(maxActiveSigners, activeSigners);
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeSigners--;
      return storagePath === "thumb-5.png"
        ? { data: null, error: { message: "signing failed" } }
        : { data: { signedUrl: `signed:${storagePath}` }, error: null };
    },
  }), requestedSpines);
  eq("primary thumbnails key signed URLs by their designation spine", thumbnails.get("spine-0"), "signed:thumb-0.png");
  eq("primary thumbnails support array-shaped relationships", thumbnails.get("spine-1"), "signed:thumb-1.png");
  ok("one thumbnail signing failure does not remove other spines", !thumbnails.has("spine-5") && thumbnails.size === 11);
  ok("primary thumbnails reject non-images, cross-spine owners, and non-primary positions",
    !thumbnails.has("spine-12") && !thumbnails.has("spine-13") && !thumbnails.has("spine-14"));
  ok("list thumbnail signing is parallel but bounded", maxActiveSigners > 1 && maxActiveSigners <= 8);

  eq("an active seller-trader receives the same management capability as the mutation gate",
    await projectOfficialImageCapabilities(fakeOrganisationClient({ is_active: true, is_trader: true }), {
      spineId: "spine-a", isPlatformAdmin: false, viewerOrganisationId: "trader",
      buyerOrganisationId: "buyer", sellerOrganisationId: "trader", hasDealCreate: true,
    }), { canView: true, canManage: true, canRemove: true });
  eq("a seller-trader without deal:create keeps removal but does not see add/default controls",
    await projectOfficialImageCapabilities(fakeOrganisationClient({ is_active: true, is_trader: true }), {
      spineId: "spine-a", isPlatformAdmin: false, viewerOrganisationId: "trader",
      buyerOrganisationId: "buyer", sellerOrganisationId: "trader", hasDealCreate: false,
    }), { canView: true, canManage: false, canRemove: true });
  eq("an inactive seller-trader sees the gallery without controls that the mutation gate would reject",
    await projectOfficialImageCapabilities(fakeOrganisationClient({ is_active: false, is_trader: true }), {
      spineId: "spine-a", isPlatformAdmin: false, viewerOrganisationId: "trader",
      buyerOrganisationId: "buyer", sellerOrganisationId: "trader", hasDealCreate: true,
    }), { canView: true, canManage: false, canRemove: false });
  eq("a buyer retains the existing removal permission without management controls",
    await projectOfficialImageCapabilities(fakeOrganisationClient(null), {
      spineId: "spine-a", isPlatformAdmin: false, viewerOrganisationId: "buyer",
      buyerOrganisationId: "buyer", sellerOrganisationId: "trader", hasDealCreate: false,
    }), { canView: true, canManage: false, canRemove: true });
  eq("a supplier sees the shared gallery without receiving mutation controls",
    await projectOfficialImageCapabilities(fakeOrganisationClient({ is_active: true, is_trader: false }), {
      spineId: "spine-a", isPlatformAdmin: false, viewerOrganisationId: "supplier",
      buyerOrganisationId: "trader", sellerOrganisationId: "supplier", hasDealCreate: true,
    }), { canView: true, canManage: false, canRemove: false });
  eq("RFQ candidates see the gallery without any mutation controls",
    await projectOfficialImageCapabilities(fakeOrganisationClient(null), {
      spineId: "spine-a", isPlatformAdmin: false, viewerOrganisationId: "candidate",
      buyerOrganisationId: null, sellerOrganisationId: null, hasDealCreate: false, isRfqCandidate: true,
    }), { canView: true, canManage: false, canRemove: false });

  console.log(`\nprojectOfficialImages.test.ts: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
