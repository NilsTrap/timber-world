import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../config.js";

/**
 * Recursively stable-stringify so snapshots diff cleanly across runs.
 * Sorts object keys, leaves arrays in source order (array order is
 * usually meaningful in query results).
 */
function stable(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stable);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as object).sort()) {
    out[k] = stable((value as Record<string, unknown>)[k]);
  }
  return out;
}

/**
 * Redact fields that change on every read for non-substantive reasons.
 * Add to this list as we hit volatile fields.
 */
const VOLATILE_KEYS = new Set([
  // server-side mirrored timestamps that update on touch but don't reflect
  // a meaningful change for snapshot purposes
  "updated_at",
  "last_login_at",
]);

function redact(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (VOLATILE_KEYS.has(k)) {
      out[k] = "<volatile>";
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

export interface SnapshotPath {
  userKey: string;
  suite: string;
  case: string;
}

function pathFor(kind: "baseline" | "current", p: SnapshotPath): string {
  return join(
    config.snapshotDir,
    config.env,
    kind,
    p.userKey,
    p.suite,
    `${p.case}.json`,
  );
}

export function writeSnapshot(
  kind: "baseline" | "current",
  p: SnapshotPath,
  data: unknown,
): void {
  const filePath = pathFor(kind, p);
  mkdirSync(dirname(filePath), { recursive: true });
  const json = JSON.stringify(stable(redact(data)), null, 2);
  writeFileSync(filePath, json + "\n");
}

export function readSnapshot(
  kind: "baseline" | "current",
  p: SnapshotPath,
): string | null {
  const filePath = pathFor(kind, p);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : null;
}

export interface DiffResult {
  path: SnapshotPath;
  status: "match" | "differ" | "missing-baseline" | "missing-current";
  baselineLen?: number;
  currentLen?: number;
}

export function diffSnapshot(p: SnapshotPath): DiffResult {
  const baseline = readSnapshot("baseline", p);
  const current = readSnapshot("current", p);
  if (!baseline && !current) {
    return { path: p, status: "missing-baseline" };
  }
  if (!baseline) return { path: p, status: "missing-baseline" };
  if (!current) return { path: p, status: "missing-current" };
  if (baseline === current) {
    return {
      path: p,
      status: "match",
      baselineLen: baseline.length,
      currentLen: current.length,
    };
  }
  return {
    path: p,
    status: "differ",
    baselineLen: baseline.length,
    currentLen: current.length,
  };
}
