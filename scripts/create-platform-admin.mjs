#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", "apps", "portal", ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^"|"$/g, "")];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const EMAIL = "edgars@ideajetlab.com";
const NAME = "Edgars Rozentāls";

function generatePassword() {
  const charset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  let out = "";
  for (let i = 0; i < 20; i++) out += charset[bytes[i] % charset.length];
  return out;
}

const headers = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  "Content-Type": "application/json",
};

// 1. Check for existing portal_users row
const existsRes = await fetch(
  `${SUPABASE_URL}/rest/v1/portal_users?email=eq.${encodeURIComponent(EMAIL)}&select=id,email,auth_user_id,is_platform_admin`,
  { headers }
);
if (!existsRes.ok) {
  console.error("Failed to check portal_users:", await existsRes.text());
  process.exit(1);
}
const existing = await existsRes.json();
if (existing.length > 0) {
  console.error(`portal_users row already exists for ${EMAIL}:`, existing[0]);
  console.error("Aborting. Delete it first if you want to recreate.");
  process.exit(1);
}

const password = generatePassword();

// 2. Create auth user
const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: { name: NAME, role: "platform_admin" },
  }),
});
if (!authRes.ok) {
  console.error("Failed to create auth user:", authRes.status, await authRes.text());
  process.exit(1);
}
const authUser = await authRes.json();
const authUserId = authUser.id;

// 3. Insert portal_users row
const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/portal_users`, {
  method: "POST",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify({
    auth_user_id: authUserId,
    email: EMAIL,
    name: NAME,
    role: "admin",
    is_platform_admin: true,
    is_active: true,
    status: "active",
    organisation_id: null,
  }),
});
if (!insertRes.ok) {
  console.error("Failed to insert portal_users:", insertRes.status, await insertRes.text());
  console.error("Auth user was created (id:", authUserId, "); manual cleanup may be needed.");
  process.exit(1);
}
const portalUser = (await insertRes.json())[0];

console.log("\n=== Platform Admin created ===");
console.log("Email:    ", EMAIL);
console.log("Password: ", password);
console.log("Portal id:", portalUser.id);
console.log("Auth id:  ", authUserId);
console.log("Platform admin:", portalUser.is_platform_admin);
console.log("==============================\n");
