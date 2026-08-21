#!/usr/bin/env node

const { execFileSync, spawnSync } = require("node:child_process");
const { existsSync, readFileSync, unlinkSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const STAGING_PROJECT = "timber-portal-staging";
const STAGING_SCOPE = "nils-projects-ee818bb8";
const MANIFEST_PATH = resolve("apps/portal/public/release-manifest.json");

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const busRun = argument("--bus-run");
if (!busRun || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(busRun)) {
  console.error("Usage: node scripts/release.js --bus-run <active-run-uuid>");
  process.exit(2);
}

if (git("branch", "--show-current") !== "feature/timber-spec-phase") {
  console.error("Refusing release outside feature/timber-spec-phase.");
  process.exit(2);
}
if (git("status", "--short")) {
  console.error("Refusing release from a dirty working tree. Commit first.");
  process.exit(2);
}

const projectConfigPath = resolve(".vercel/project.json");
if (!existsSync(projectConfigPath)) {
  const linked = spawnSync(
    "npx",
    ["--yes", "vercel", "link", "--yes", "--project", STAGING_PROJECT, "--scope", STAGING_SCOPE],
    { cwd: resolve("."), encoding: "utf8", env: process.env },
  );
  if (linked.stdout) process.stdout.write(linked.stdout);
  if (linked.stderr) process.stderr.write(linked.stderr);
  if (linked.status !== 0 || !existsSync(projectConfigPath)) process.exit(linked.status ?? 1);
}
const projectConfig = JSON.parse(readFileSync(projectConfigPath, "utf8"));
if (projectConfig.projectName !== STAGING_PROJECT) {
  console.error(`Refusing release: Vercel target is not ${STAGING_PROJECT}.`);
  process.exit(2);
}

const commit = git("rev-parse", "HEAD");
const version = `projects-${commit.slice(0, 8)}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
const previousManifest = existsSync(MANIFEST_PATH) ? readFileSync(MANIFEST_PATH) : null;
writeFileSync(MANIFEST_PATH, `${JSON.stringify({ version, commit, releasedAt: new Date().toISOString() }, null, 2)}\n`);

let result;
try {
  result = spawnSync("npx", ["--yes", "vercel", "--prod", "--yes", "--scope", STAGING_SCOPE], {
    cwd: resolve("."),
    encoding: "utf8",
    env: process.env,
  });
} finally {
  if (previousManifest) writeFileSync(MANIFEST_PATH, previousManifest);
  else unlinkSync(MANIFEST_PATH);
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Release version: ${version}`);
console.log(`Released commit: ${commit}`);
