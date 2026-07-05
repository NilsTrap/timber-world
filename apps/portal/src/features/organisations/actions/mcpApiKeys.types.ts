/**
 * Epic T / T1 — plain (NON-"use server") types for the MCP API keys admin UI.
 *
 * Types live here, not in the "use server" action file: exporting a type from a
 * "use server" module breaks all server actions on the route at runtime
 * (Turbopack) and type-check does not catch it.
 */

export interface McpApiKeyRow {
  id: string;
  label: string | null;
  organisationId: string | null;
  organisationName: string | null;
  /** T2/MEDIUM-3 · read-only scope: the key resolves to role=readonly (read tools only). */
  isReadonly: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** Returned ONCE on issue — `plaintext` is never stored and never re-shown. */
export interface IssuedMcpApiKey {
  id: string;
  label: string | null;
  plaintext: string;
}
