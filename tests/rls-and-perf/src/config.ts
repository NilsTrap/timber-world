/**
 * Test harness config. Loaded from env (typically a .env.local file or CI secrets).
 *
 * Required env:
 *   TEST_SUPABASE_URL              — staging Supabase project URL
 *   TEST_SUPABASE_ANON_KEY         — anon key (used by user-context clients)
 *   TEST_SUPABASE_SERVICE_ROLE_KEY — service-role key (used only for seeding)
 *
 * Optional:
 *   TEST_SNAPSHOT_DIR — where snapshots live (default: ./snapshots)
 *   TEST_ENV          — label used to namespace snapshots ("staging" by default)
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = join(__dirname, "..", ".env.local");

if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const k = line.slice(0, idx).trim();
    const v = line
      .slice(idx + 1)
      .trim()
      .replace(/^"|"$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(
      `Missing required env var: ${key}. Set it in tests/rls-and-perf/.env.local or as a CI secret.`,
    );
  }
  return v;
}

export const config = {
  supabaseUrl: required("TEST_SUPABASE_URL"),
  supabaseAnonKey: required("TEST_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: required("TEST_SUPABASE_SERVICE_ROLE_KEY"),
  snapshotDir: process.env.TEST_SNAPSHOT_DIR ?? join(__dirname, "..", "snapshots"),
  env: process.env.TEST_ENV ?? "staging",
};

/**
 * Seeded test users. The seed script (src/seed.ts) creates these in the
 * target Supabase. Production tests run against these users only — never
 * against real customer users.
 *
 * "userKey" is the short identifier used in snapshot paths and reporting.
 */
export interface TestUserDef {
  userKey: string;
  email: string;
  password: string;
  name: string;
  isPlatformAdmin: boolean;
  /** Organisations the user belongs to. Empty for platform admin. */
  orgKeys: string[];
  /** Modules enabled for this user (intersected with org-enabled at runtime). */
  enabledModules: string[];
}

export interface TestOrgDef {
  orgKey: string;
  code: string;
  name: string;
  /** Modules enabled at org level. */
  enabledModules: string[];
}

const PASS_ADMIN = "IjlTestAdmin!9417zk";
const PASS_ORG_A_FULL = "IjlTestOrgAFull!4kqp82";
const PASS_ORG_A_LIMITED = "IjlTestOrgALim!7zw3vd";
const PASS_ORG_B_FULL = "IjlTestOrgBFull!8jm5px";

export const TEST_ORGS: TestOrgDef[] = [
  {
    orgKey: "org-a",
    code: "IJLA",
    name: "IJL Test Org A",
    enabledModules: ["orders", "inventory", "production", "shipments"],
  },
  {
    orgKey: "org-b",
    code: "IJLB",
    name: "IJL Test Org B",
    enabledModules: ["orders", "inventory", "production", "shipments"],
  },
  {
    orgKey: "org-c-empty",
    code: "IJLC",
    name: "IJL Test Org C (Empty)",
    enabledModules: ["orders", "inventory"],
  },
];

export const TEST_USERS: TestUserDef[] = [
  {
    userKey: "platform-admin",
    email: "test-admin@ijl.test",
    password: PASS_ADMIN,
    name: "IJL Test Platform Admin",
    isPlatformAdmin: true,
    orgKeys: [],
    enabledModules: [],
  },
  {
    userKey: "org-a-full",
    email: "test-org-a-full@ijl.test",
    password: PASS_ORG_A_FULL,
    name: "IJL Test User — Org A (Full)",
    isPlatformAdmin: false,
    orgKeys: ["org-a"],
    enabledModules: ["orders", "inventory", "production", "shipments"],
  },
  {
    userKey: "org-a-limited",
    email: "test-org-a-limited@ijl.test",
    password: PASS_ORG_A_LIMITED,
    name: "IJL Test User — Org A (Orders only)",
    isPlatformAdmin: false,
    orgKeys: ["org-a"],
    enabledModules: ["orders"],
  },
  {
    userKey: "org-b-full",
    email: "test-org-b-full@ijl.test",
    password: PASS_ORG_B_FULL,
    name: "IJL Test User — Org B (Full)",
    isPlatformAdmin: false,
    orgKeys: ["org-b"],
    enabledModules: ["orders", "inventory", "production", "shipments"],
  },
];

export const ORG_USERS = TEST_USERS.filter((u) => !u.isPlatformAdmin);
