const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Full public URL for a catalog storage path. */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${BASE}/storage/v1/object/public/catalog/${path}`;
}

/**
 * Small transformed version for thumbnails (Supabase image render endpoint).
 * Keeps list payloads light. Falls back to the original if transforms are off
 * (the render endpoint serves the source image in that case).
 */
export function thumbUrl(path: string | null | undefined, size = 200): string | null {
  if (!path) return null;
  return `${BASE}/storage/v1/render/image/public/catalog/${path}?width=${size}&height=${size}&resize=cover&quality=70`;
}
