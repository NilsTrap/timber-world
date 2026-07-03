/**
 * Spec-Alignment Wave · Epic A / A2 — normalize conflated buy-side line items onto
 * the deal that owns them (the spine-sibling BUY leg, or in place on a buy leg),
 * stored side='sell' (spec §2.1 / §2.3). Idempotent + reconciling. Run on STAGING
 * (dry-run, then --apply). PROD IS FROZEN — this does NOT touch prod; the identical
 * step also runs at the E8 prod cutover (see scripts/e8-migrate-legacy-orders.mts).
 *
 * The logic is shared with E8 via scripts/lib/buyLineMigration.mts so they cannot
 * drift. Orders with buy lines but NO resolvable buy leg are REPORTED, not guessed.
 *
 * Usage (from apps/portal):
 *   # dry-run (read-only plan, no writes):
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… tsx scripts/a2-migrate-buy-lines.mts
 *   # apply:
 *   … tsx scripts/a2-migrate-buy-lines.mts --apply
 */
import { createAdminClient } from "@timber/database";
import { runBuyLineMigration } from "./lib/buyLineMigration.mts";

const APPLY = process.argv.includes("--apply");

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  console.log(`\n── A2 buy-line migration ${APPLY ? "(APPLY)" : "(DRY-RUN — no writes)"} ──`);
  const res = await runBuyLineMigration(db, APPLY);
  if (res.unresolved.length) {
    console.log(`\nLeft for Edgars (buy lines, no buy leg):`);
    for (const u of res.unresolved) console.log(`  ⚠ ${u.dealCode ?? u.id} — ${u.lineCount} buy line(s) — ${u.note}`);
  }
  if (!res.ok) process.exitCode = 1;
}

main().catch((e) => { console.error("FATAL", e); process.exitCode = 1; });
