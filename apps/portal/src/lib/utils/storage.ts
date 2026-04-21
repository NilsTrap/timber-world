/**
 * Replace characters outside Supabase Storage's safe key set with `_`.
 *
 * Supabase Storage rejects object keys containing characters outside this set:
 *   A-Z a-z 0-9 _ / ! - . * ' ( ) space & $ @ = ; : + , ?
 * Notably excluded (and commonly seen in CAD/Office filenames): ^ # %  ` ~ [ ] { } < >
 */
export function sanitizeStorageFileName(name: string): string {
  return name
    .replace(/[^\w!\-.*'() &$@=;:+,?]/g, "_")
    .replace(/_+/g, "_");
}

/**
 * Browser-provided MIME type with a safe fallback for formats the browser
 * doesn't recognise (e.g. `.dxf`, `.step` — often reported as empty string).
 */
export function resolveContentType(type: string | undefined | null): string {
  return type && type.length > 0 ? type : "application/octet-stream";
}
