import { assertKnownStagingTarget, KNOWN_STAGING_SUPABASE_URL } from "./targetSafety.js";

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean): void {
  if (condition) passed++;
  else {
    failed++;
    console.error(`✗ ${label}`);
  }
}

function isAccepted(target: string): boolean {
  try {
    assertKnownStagingTarget(target);
    return true;
  } catch {
    return false;
  }
}

ok("accepts the exact known staging target", isAccepted(KNOWN_STAGING_SUPABASE_URL));
ok("accepts a normalized staging trailing slash", isAccepted(`${KNOWN_STAGING_SUPABASE_URL}/`));

for (const target of [
  "https://psmramegggsciirwldjz.supabase.co",
  "https://another-project.supabase.co",
  "https://fyzrtqsnmnizoxgcqsjc.supabase.co.attacker.example",
  "http://fyzrtqsnmnizoxgcqsjc.supabase.co",
  "https://user:password@fyzrtqsnmnizoxgcqsjc.supabase.co",
  "https://fyzrtqsnmnizoxgcqsjc.supabase.co/rest/v1",
  "https://fyzrtqsnmnizoxgcqsjc.supabase.co?target=production",
  "not-a-url",
]) {
  ok(`rejects unsafe target ${JSON.stringify(target)}`, !isAccepted(target));
}

console.log(`targetSafety.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
