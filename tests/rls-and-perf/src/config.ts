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
  /**
   * Modules enabled for this user (intersected with org-enabled at runtime).
   * E4: groups subsume user_modules — the seed converts this list into a
   * deterministic legacy-parity access group (same md5-key formula as
   * migration 20260701000011) unless `groups` is set.
   */
  enabledModules: string[];
  /**
   * E4: system access-group keys to assign instead of a legacy-parity group
   * (e.g. ["salesperson"]). When set, enabledModules is ignored.
   */
  groups?: string[];
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
const PASS_HOUSE_SALES = "IjlTestHouseSales!2rv9mq";
const PASS_HOUSE_PURCHASING = "IjlTestHousePurch!6tn4xb";
const PASS_CLIENT_USER = "IjlTestClient!3wk8fz";
const PASS_SUPPLIER_USER = "IjlTestSupplier!5hd7cy";

// Note: organisations.code is CHAR(3) — codes must be exactly 3 chars.
// Module codes match the `modules.code` values in the DB (see migrations
// from 2026-04-06). Full-access users get all the top-level view codes.
const FULL_MODULES = [
  "dashboard.view",
  "orders.view",
  "inventory.view",
  "production.view",
  "shipments.view",
];

// Note: organisations.code is CHAR(3) — codes must be exactly 3 chars.
// org-a doubles as the E4 "house" (trader in the middle of the chain); its
// ceiling includes the tab + counterparty modules the seeded groups grant.
export const TEST_ORGS: TestOrgDef[] = [
  {
    orgKey: "org-a",
    code: "JLA",
    name: "IJL Test Org A",
    enabledModules: [
      ...FULL_MODULES,
      "orders.tab.list",
      "orders.tab.sales",
      "orders.tab.prices",
      "orders.tab.production",
      "orders.tab.analytics",
      "counterparties.clients",
      "counterparties.suppliers",
    ],
  },
  {
    orgKey: "org-b",
    code: "JLB",
    name: "IJL Test Org B",
    enabledModules: [...FULL_MODULES, "orders.tab.list"],
  },
  {
    orgKey: "org-c-empty",
    code: "JLC",
    name: "IJL Test Org C (Empty)",
    enabledModules: ["dashboard.view", "orders.view", "inventory.view"],
  },
  {
    orgKey: "org-d-supplier",
    code: "JLD",
    name: "IJL Test Supplier D",
    enabledModules: ["orders.view", "orders.tab.list", "orders.tab.production"],
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
    enabledModules: FULL_MODULES,
  },
  {
    userKey: "org-a-limited",
    email: "test-org-a-limited@ijl.test",
    password: PASS_ORG_A_LIMITED,
    name: "IJL Test User — Org A (Orders only)",
    isPlatformAdmin: false,
    orgKeys: ["org-a"],
    enabledModules: ["dashboard.view", "orders.view"],
  },
  {
    userKey: "org-b-full",
    email: "test-org-b-full@ijl.test",
    password: PASS_ORG_B_FULL,
    name: "IJL Test User — Org B (Full)",
    isPlatformAdmin: false,
    orgKeys: ["org-b"],
    enabledModules: FULL_MODULES,
  },
  // E4 group personas — the direction-aware wall inside and around the house.
  {
    userKey: "house-sales",
    email: "test-house-sales@ijl.test",
    password: PASS_HOUSE_SALES,
    name: "IJL Test — House Salesperson",
    isPlatformAdmin: false,
    orgKeys: ["org-a"],
    enabledModules: [],
    groups: ["salesperson"],
  },
  {
    userKey: "house-purchasing",
    email: "test-house-purchasing@ijl.test",
    password: PASS_HOUSE_PURCHASING,
    name: "IJL Test — House Purchasing",
    isPlatformAdmin: false,
    orgKeys: ["org-a"],
    enabledModules: [],
    groups: ["purchasing"],
  },
  {
    userKey: "client-user",
    email: "test-client-user@ijl.test",
    password: PASS_CLIENT_USER,
    name: "IJL Test — Client Login (Org B)",
    isPlatformAdmin: false,
    orgKeys: ["org-b"],
    enabledModules: [],
    groups: ["client"],
  },
  {
    userKey: "supplier-user",
    email: "test-supplier-user@ijl.test",
    password: PASS_SUPPLIER_USER,
    name: "IJL Test — Supplier Login (Org D)",
    isPlatformAdmin: false,
    orgKeys: ["org-d-supplier"],
    enabledModules: [],
    groups: ["producer"],
  },
];

export const ORG_USERS = TEST_USERS.filter((u) => !u.isPlatformAdmin);
