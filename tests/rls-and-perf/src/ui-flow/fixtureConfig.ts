import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const UI_FLOW_CONFIRMATION = "UIFLOW-LOCAL-ONLY";

export const UI_FLOW_IDS = {
  organisations: {
    trader: "10000000-0000-4000-8000-000000000001",
    buyer: "10000000-0000-4000-8000-000000000002",
    metalSupplier: "10000000-0000-4000-8000-000000000003",
    woodSupplier: "10000000-0000-4000-8000-000000000004",
    metalBackup: "10000000-0000-4000-8000-000000000005",
    woodBackup: "10000000-0000-4000-8000-000000000006",
  },
  users: {
    superAdmin: "20000000-0000-4000-8000-000000000001",
    trader: "20000000-0000-4000-8000-000000000002",
    buyer: "20000000-0000-4000-8000-000000000003",
    metalSupplier: "20000000-0000-4000-8000-000000000004",
    woodSupplier: "20000000-0000-4000-8000-000000000005",
  },
  spine: "30000000-0000-4000-8000-000000000001",
  orders: {
    origin: "40000000-0000-4000-8000-000000000001",
    metalLeg: "40000000-0000-4000-8000-000000000002",
    woodLeg: "40000000-0000-4000-8000-000000000003",
  },
  lines: {
    metalOrigin: "50000000-0000-4000-8000-000000000001",
    woodOrigin: "50000000-0000-4000-8000-000000000002",
    metalLeg: "50000000-0000-4000-8000-000000000003",
    woodLeg: "50000000-0000-4000-8000-000000000004",
  },
} as const;

export const UI_FLOW_PERSONAS = {
  superAdmin: { email: "ui-flow.super-admin@nilitto.test", group: null, organisation: null },
  trader: { email: "ui-flow.trader@nilitto.test", group: "trader", organisation: "trader" },
  buyer: { email: "ui-flow.buyer@nilitto.test", group: "buyer", organisation: "buyer" },
  metalSupplier: { email: "ui-flow.metal@nilitto.test", group: "manufacturer", organisation: "metalSupplier" },
  woodSupplier: { email: "ui-flow.wood@nilitto.test", group: "manufacturer", organisation: "woodSupplier" },
} as const;

export const UI_FLOW_RFP_CANDIDATES = {
  metal: {
    orderId: UI_FLOW_IDS.orders.metalLeg,
    organisationIds: [UI_FLOW_IDS.organisations.metalSupplier, UI_FLOW_IDS.organisations.metalBackup],
  },
  wood: {
    orderId: UI_FLOW_IDS.orders.woodLeg,
    organisationIds: [UI_FLOW_IDS.organisations.woodSupplier, UI_FLOW_IDS.organisations.woodBackup],
  },
} as const;

export type UiFlowPersonaKey = keyof typeof UI_FLOW_PERSONAS;
export type UiFlowOrganisationKey = keyof typeof UI_FLOW_IDS.organisations;

export type UiFlowFixtureConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  password: string;
  runLabel: string;
};

export function loadUiFlowEnvFile(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const envFile = fileURLToPath(new URL("../../.env.local", import.meta.url));
  if (!existsSync(envFile)) return env;
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    if (!key.startsWith("NILITTO_UI_FLOW_") || env[key]) continue;
    env[key] = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

export function assertLocalUiFlowTarget(target: string): string {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new Error("NILITTO_UI_FLOW_SUPABASE_URL must be a loopback Supabase URL");
  }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  const safe = url.protocol === "http:" && loopback && url.port !== ""
    && (url.pathname === "" || url.pathname === "/") && url.username === "" && url.password === ""
    && url.search === "" && url.hash === "";
  if (!safe) throw new Error("Refusing UI-flow fixture mutation: target must be loopback HTTP with an explicit port");
  return url.origin;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function resolveUiFlowFixtureConfig(env: NodeJS.ProcessEnv): UiFlowFixtureConfig {
  const supabaseUrl = required(env, "NILITTO_UI_FLOW_SUPABASE_URL");
  const localSupabaseUrl = assertLocalUiFlowTarget(supabaseUrl);
  if (required(env, "NILITTO_UI_FLOW_CONFIRMATION") !== UI_FLOW_CONFIRMATION) {
    throw new Error(`NILITTO_UI_FLOW_CONFIRMATION must equal ${UI_FLOW_CONFIRMATION}`);
  }

  const runLabel = required(env, "NILITTO_UI_FLOW_RUN_LABEL");
  if (!/^UIFLOW-\d{8}-\d{2,4}$/.test(runLabel)) {
    throw new Error("NILITTO_UI_FLOW_RUN_LABEL must match UIFLOW-YYYYMMDD-NN");
  }

  const password = required(env, "NILITTO_UI_FLOW_TEST_PASSWORD");
  if (password.length < 12) throw new Error("NILITTO_UI_FLOW_TEST_PASSWORD must contain at least 12 characters");

  return {
    supabaseUrl: localSupabaseUrl,
    serviceRoleKey: required(env, "NILITTO_UI_FLOW_SERVICE_ROLE_KEY"),
    password,
    runLabel,
  };
}
