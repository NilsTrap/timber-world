/**
 * Test harness orchestrator.
 *
 * Modes:
 *   --mode=snapshot   Run all snapshot suites against the staging DB, write to current/
 *   --mode=baseline   Run all snapshot suites, write to baseline/ (use after verifying)
 *   --mode=diff       Compare current/ against baseline/, exit 1 if any diff
 *   --mode=negative   Run cross-tenant negative probes, exit 1 if any leak
 *   --mode=positive   Run positive write-path checks, exit 1 if any fail
 *   --mode=all        snapshot + diff + negative + positive (the CI default)
 */

import { TEST_USERS } from "./config.js";
import { runOrdersSuite } from "./suites/orders.js";
import { runInventorySuite } from "./suites/inventory.js";
import { runProductionSuite } from "./suites/production.js";
import { runShipmentsSuite } from "./suites/shipments.js";
import { runNegativeSuite, type ProbeResult } from "./suites/cross-tenant-negative.js";
import { runPositiveSuite, type PositiveResult } from "./suites/positive-write.js";
import { diffSnapshot, type SnapshotPath } from "./lib/snapshot.js";

type Mode = "snapshot" | "baseline" | "diff" | "negative" | "positive" | "all";

const SUITES = ["orders", "inventory", "production", "shipments"] as const;
const SUITE_CASES: Record<(typeof SUITES)[number], string[]> = {
  orders: ["list"],
  inventory: ["packages"],
  production: ["entries"],
  shipments: ["list"],
};

function parseMode(): Mode {
  const arg = process.argv.find((a) => a.startsWith("--mode="));
  const m = arg?.split("=")[1] ?? "all";
  if (!["snapshot", "baseline", "diff", "negative", "positive", "all"].includes(m)) {
    throw new Error(`Unknown mode: ${m}`);
  }
  return m as Mode;
}

async function runSnapshots(kind: "baseline" | "current"): Promise<void> {
  console.log(`→ Running snapshot suites (${kind})...`);
  await runOrdersSuite(kind);
  await runInventorySuite(kind);
  await runProductionSuite(kind);
  await runShipmentsSuite(kind);
  console.log(`✓ Snapshots written to ${kind}/`);
}

function runDiff(): { differences: number; details: string[] } {
  console.log("→ Diffing current/ against baseline/...");
  let differences = 0;
  const details: string[] = [];
  for (const user of TEST_USERS) {
    for (const suite of SUITES) {
      for (const c of SUITE_CASES[suite]) {
        const path: SnapshotPath = { userKey: user.userKey, suite, case: c };
        const r = diffSnapshot(path);
        if (r.status === "differ") {
          differences++;
          details.push(`  DIFFER  ${user.userKey}/${suite}/${c}`);
        } else if (r.status === "missing-baseline") {
          details.push(`  NEW     ${user.userKey}/${suite}/${c} (no baseline yet)`);
        } else if (r.status === "missing-current") {
          differences++;
          details.push(`  MISSING ${user.userKey}/${suite}/${c} (baseline exists, current absent)`);
        }
      }
    }
  }
  return { differences, details };
}

async function runNegative(): Promise<ProbeResult[]> {
  console.log("→ Running cross-tenant negative probes...");
  return runNegativeSuite();
}

function summarizeNegative(results: ProbeResult[]): { leaks: number; report: string } {
  const leaks = results.filter((r) => r.outcome === "leaked").length;
  const lines: string[] = [
    `Negative probe results: ${results.length} probes, ${leaks} leaked, ${results.length - leaks} blocked`,
  ];
  for (const r of results) {
    const icon = r.outcome === "leaked" ? "✗ LEAK   " : "✓ blocked";
    lines.push(`  ${icon}  ${r.userKey} / ${r.probeName} (rows=${r.rowsSeen})`);
    if (r.errorMessage) lines.push(`            error: ${r.errorMessage}`);
  }
  return { leaks, report: lines.join("\n") };
}

async function runPositive(): Promise<PositiveResult[]> {
  console.log("→ Running positive write-path checks...");
  return runPositiveSuite();
}

function summarizePositive(results: PositiveResult[]): { failures: number; report: string } {
  const failures = results.filter((r) => r.outcome === "failed").length;
  const lines: string[] = [
    `Positive write results: ${results.length} checks, ${results.length - failures} ok, ${failures} failed`,
  ];
  for (const r of results) {
    const icon = r.outcome === "failed" ? "✗ FAILED " : "✓ ok     ";
    lines.push(`  ${icon}  ${r.userKey} / ${r.caseName} (${r.detail})`);
    if (r.errorMessage) lines.push(`            error: ${r.errorMessage}`);
  }
  return { failures, report: lines.join("\n") };
}

async function main(): Promise<void> {
  const mode = parseMode();

  if (mode === "baseline") {
    await runSnapshots("baseline");
    return;
  }

  if (mode === "snapshot") {
    await runSnapshots("current");
    return;
  }

  if (mode === "diff") {
    const { differences, details } = runDiff();
    console.log(details.join("\n") || "  (no entries)");
    console.log(`Differences: ${differences}`);
    if (differences > 0) process.exit(1);
    return;
  }

  if (mode === "negative") {
    const results = await runNegative();
    const { leaks, report } = summarizeNegative(results);
    console.log(report);
    if (leaks > 0 && process.env.NEGATIVE_TESTS_FAIL_ON_LEAK === "true") {
      process.exit(1);
    }
    return;
  }

  if (mode === "positive") {
    const results = await runPositive();
    const { failures, report } = summarizePositive(results);
    console.log(report);
    if (failures > 0) process.exit(1);
    return;
  }

  // "all" — full CI run
  await runSnapshots("current");
  const { differences, details } = runDiff();
  console.log(details.join("\n") || "  (no entries)");
  console.log(`Differences: ${differences}`);

  const results = await runNegative();
  const { leaks, report } = summarizeNegative(results);
  console.log(report);

  const positiveResults = await runPositive();
  const { failures, report: positiveReport } = summarizePositive(positiveResults);
  console.log(positiveReport);

  const failOnLeak = process.env.NEGATIVE_TESTS_FAIL_ON_LEAK === "true";
  if (differences > 0) process.exit(1);
  if (failures > 0) process.exit(1);
  if (leaks > 0 && failOnLeak) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
