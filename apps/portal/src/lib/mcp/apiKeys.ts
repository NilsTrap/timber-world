/**
 * Epic T / T1 — MCP API key primitives (plaintext generation + hashing).
 *
 * The plaintext key is shown to the admin ONCE at issue and never stored. Only
 * its sha256 hex digest (`key_hash`) is persisted in `mcp_api_keys`. Both the
 * issuing server action (store) and the MCP route (lookup) hash with THIS
 * function so the digests match byte-for-byte.
 *
 * Plain server module (NOT "use server") — imported by both a server action and
 * the route handler.
 */
import { createHash, randomBytes } from "crypto";

/** Distinguishes a user MCP key from the env FULL/READONLY owner tokens by eye.
 *  Lookup is by hash regardless of prefix. */
export const MCP_KEY_PREFIX = "tmbr_mcp_";

/** Generate a fresh, high-entropy plaintext key (256 bits, base64url). Returned
 *  ONCE to the admin; only its hash is stored. */
export function generateApiKey(): string {
  return MCP_KEY_PREFIX + randomBytes(32).toString("base64url");
}

/** sha256 hex digest of a plaintext key — the value stored in / matched against
 *  `mcp_api_keys.key_hash`. */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}
