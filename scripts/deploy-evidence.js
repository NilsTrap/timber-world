#!/usr/bin/env node

const { execFileSync } = require("node:child_process");

const LIVE_URL = "https://timber-portal-staging.vercel.app";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const commit = argument("--commit");
if (!commit || !/^[0-9a-f]{40}$/i.test(commit)) {
  console.error("Usage: node scripts/deploy-evidence.js --commit <40-character-sha>");
  process.exit(2);
}
execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`]);

async function response(url) {
  return fetch(url, { redirect: "follow", cache: "no-store" });
}

async function main() {
  const manifestUrl = `${LIVE_URL}/release-manifest.json`;
  const manifestResponse = await response(manifestUrl);
  if (!manifestResponse.ok) throw new Error(`Live release manifest returned HTTP ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  if (manifest.commit !== commit) {
    throw new Error(`Live release commit ${manifest.commit ?? "missing"} does not match ${commit}`);
  }

  const healthResponse = await response(LIVE_URL);
  if (!healthResponse.ok) throw new Error(`Live portal returned HTTP ${healthResponse.status}`);
  const html = await healthResponse.text();
  const assetPath = html.match(/(?:src|href)="([^"?]*\/_next\/static\/[^"?]+\.(?:js|css))/)?.[1];
  if (!assetPath) throw new Error("No live Next.js asset was present in the served page");
  const assetUrl = new URL(assetPath, LIVE_URL).toString();
  const assetResponse = await response(assetUrl);
  if (!assetResponse.ok) throw new Error(`Live asset returned HTTP ${assetResponse.status}`);

  console.log(`Release version: ${manifest.version}`);
  console.log(`Deployed URL: ${LIVE_URL}`);
  console.log(`Live manifest: ${manifestUrl} -> HTTP ${manifestResponse.status}, commit ${manifest.commit}`);
  console.log(`Live health: ${LIVE_URL} -> HTTP ${healthResponse.status}`);
  console.log(`Live asset: ${assetUrl} -> HTTP ${assetResponse.status}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
