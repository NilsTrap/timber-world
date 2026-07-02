/**
 * E8 · Legacy-order data migration — backfill spines + split 3-party orders into
 * bilateral deals. Idempotent + reconciling. Run on STAGING first (dry-run, then
 * --apply), then on PROD after a snapshot at cutover.
 *
 * WHAT IT DOES (per the spec-design-notes E2/E8 model):
 *  - Every VALID BILATERAL order (seller + buyer both set) that has no spine gets
 *    its own spine (SP-###) + a SELLER-BUYER-NNN deal_code.
 *  - Every such order that still carries a legacy producer (producer_organisation_id
 *    set) and hasn't been split (upstream_deal_id null) SPAWNS its matching BUY leg
 *    on the SAME spine: a purchase_only deal (seller = producer, buyer = the
 *    manufacturer/original seller). The sell leg's upstream_deal_id then points to it.
 *    The producer's access moves from the transitional legacy.producer RLS arm to
 *    being the seller of that buy leg (side.sell) — so the arm can be dropped after.
 *  - Buy legs start with NO line items (the legacy single row only ever recorded the
 *    SELL-side goods/prices; buy-side prices were never captured separately — inventing
 *    them would be wrong). Fill later if needed.
 *  - ORPHANS (missing a seller or a buyer) are SKIPPED + reported — they cannot form a
 *    bilateral deal; left as legacy for a human to clean up.
 *  - ADDRESS BOOKS (spec §9.3): additively flags is_customer for every buyer on a
 *    sell leg and is_supplier for every seller on a buy leg (only ever sets true).
 *
 * IDEMPOTENT: re-running is a no-op — spine backfill skips orders that already have a
 * spine; allocateDealCode returns the existing code; the split skips orders whose
 * upstream_deal_id is already set.
 *
 * Usage (from apps/portal):
 *   # dry-run (read-only plan, no writes):
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… tsx scripts/e8-migrate-legacy-orders.mts
 *   # apply:
 *   … tsx scripts/e8-migrate-legacy-orders.mts --apply
 */
import { createAdminClient } from "@timber/database";
import type { ActorContext } from "@/features/orders/services/dealModel";
import { createSpine, attachDealToSpine } from "@/features/orders/services/spines";
import { allocateDealCode, createDeal } from "@/features/orders/services/orderDeals";

const APPLY = process.argv.includes("--apply");

const ACTOR: ActorContext = {
  portalUserId: null,
  isPlatformAdmin: true,
  isServiceAgent: true,
  label: "e8-migration",
};

interface OrderRow {
  id: string;
  spine_id: string | null;
  deal_code: string | null;
  name: string | null;
  product_group: string | null;
  currency: string | null;
  seller_organisation_id: string | null;
  buyer_organisation_id: string | null;
  producer_organisation_id: string | null;
  upstream_deal_id: string | null;
  deal_kind: string | null;
}

/**
 * Additive address-book mapping: flag as is_customer every org that is a buyer on
 * a sell/bilateral leg, and is_supplier every org that is a seller on a buy leg.
 * Only ever sets a flag true (never clears), so it is idempotent + safe to re-run.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mapAddressBooks(db: any): Promise<{ customers: number; suppliers: number }> {
  // Client book: buyers on non-buy-leg orders that aren't flagged yet.
  const { data: buyers } = await db
    .from("orders")
    .select("buyer_organisation_id")
    .neq("deal_kind", "purchase_only")
    .not("buyer_organisation_id", "is", null);
  const custIds = Array.from(new Set((buyers ?? []).map((r: { buyer_organisation_id: string }) => r.buyer_organisation_id)));
  // Supplier book: sellers on buy legs.
  const { data: sellers } = await db
    .from("orders")
    .select("seller_organisation_id")
    .eq("deal_kind", "purchase_only")
    .not("seller_organisation_id", "is", null);
  const supIds = Array.from(new Set((sellers ?? []).map((r: { seller_organisation_id: string }) => r.seller_organisation_id)));

  let customers = 0, suppliers = 0;
  if (custIds.length) {
    const { data } = await db.from("organisations").update({ is_customer: true }).in("id", custIds).eq("is_customer", false).select("id");
    customers = (data ?? []).length;
  }
  if (supIds.length) {
    const { data } = await db.from("organisations").update({ is_supplier: true }).in("id", supIds).eq("is_supplier", false).select("id");
    suppliers = (data ?? []).length;
  }
  return { customers, suppliers };
}

async function main() {
  const db = createAdminClient();

  // Pull every order that is NOT itself a spawned buy leg (purchase_only w/ a producer
  // parent). We process sell/bilateral rows; buy legs are created BY us.
  const { data, error } = await db
    .from("orders")
    .select(
      "id, spine_id, deal_code, name, product_group, currency, seller_organisation_id, buyer_organisation_id, producer_organisation_id, upstream_deal_id, deal_kind",
    )
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Fetch orders failed: ${error.message}`);
  const orders = (data ?? []) as OrderRow[];

  const isValidBilateral = (o: OrderRow) => !!o.seller_organisation_id && !!o.buyer_organisation_id;
  const needsSplit = (o: OrderRow) => isValidBilateral(o) && !!o.producer_organisation_id && !o.upstream_deal_id;

  const valid = orders.filter(isValidBilateral);
  const orphans = orders.filter((o) => !isValidBilateral(o));
  const toBackfillSpine = valid.filter((o) => !o.spine_id);
  const toAllocCode = valid.filter((o) => !o.deal_code);
  const toSplit = orders.filter(needsSplit);

  console.log(`\n── E8 legacy-order migration ${APPLY ? "(APPLY)" : "(DRY-RUN — no writes)"} ──`);
  console.log(`Total orders:            ${orders.length}`);
  console.log(`Valid bilateral:         ${valid.length}`);
  console.log(`Orphans (skip+report):   ${orphans.length}`);
  console.log(`Plan → backfill spine:   ${toBackfillSpine.length}`);
  console.log(`Plan → allocate code:    ${toAllocCode.length}`);
  console.log(`Plan → split producer:   ${toSplit.length}  (→ that many new buy legs)`);
  if (orphans.length) console.log(`Orphan ids: ${orphans.map((o) => o.id).join(", ")}`);

  if (!APPLY) {
    console.log(`\nDry-run only. Re-run with --apply to execute.`);
    return;
  }

  let spinesMade = 0, codesMade = 0, splitsMade = 0, splitFailed = 0;

  // Orders that are the TARGET of a pre-existing upstream link (a buy leg already
  // linked before E8 — only ever from prior staging auto-spawn/testing; prod has
  // none). Such a buy leg must SHARE its parent sell leg's spine, so we don't mint
  // it a separate one — it's attached to the parent's spine below.
  const upstreamTargets = new Set(orders.map((o) => o.upstream_deal_id).filter(Boolean) as string[]);

  for (const o of valid) {
    // 1) spine backfill (skip pre-existing buy legs — they inherit the parent's spine)
    let spineId = o.spine_id;
    if (!spineId && !upstreamTargets.has(o.id)) {
      const sp = await createSpine(db, ACTOR, {
        title: o.name ?? "Deal",
        productGroup: o.product_group ?? null,
      });
      if (!sp.success) { console.error(`  ✗ spine for ${o.id}: ${sp.error}`); continue; }
      spineId = sp.data.id;
      const at = await attachDealToSpine(db, ACTOR, o.id, spineId);
      if (!at.success) { console.error(`  ✗ attach ${o.id}: ${at.error}`); continue; }
      spinesMade++;
    }
    // A pre-existing linked buy leg lives on the SAME spine as this sell leg
    // (idempotent — re-attaching to the same spine is a no-op).
    if (spineId && o.upstream_deal_id) {
      await attachDealToSpine(db, ACTOR, o.upstream_deal_id, spineId);
    }

    // 2) deal_code allocation (idempotent — returns existing if set)
    if (!o.deal_code) {
      const code = await allocateDealCode(db, ACTOR, o.id, { customerNameFallback: o.name ?? null });
      if (code.success) codesMade++;
      else console.error(`  ⚠ code for ${o.id}: ${code.error}`);
    }

    // 3) split: spawn the buy leg (producer → the house), same spine.
    //    IDEMPOTENT under partial failure: the buy-leg create and the upstream-link
    //    write are two non-atomic steps, so a crash between them would leave a buy
    //    leg with no back-link. Guard with BOTH (a) a spine pre-check that reuses an
    //    already-created matching buy leg, and (b) an idempotency key on createDeal.
    //    Either way a re-run LINKS the existing buy leg instead of spawning a duplicate.
    if (o.producer_organisation_id && !o.upstream_deal_id) {
      let buyLegId: string | null = null;
      const { data: existing } = await db
        .from("orders")
        .select("id")
        .eq("spine_id", spineId)
        .eq("deal_kind", "purchase_only")
        .eq("seller_organisation_id", o.producer_organisation_id)
        .eq("buyer_organisation_id", o.seller_organisation_id)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        buyLegId = existing.id as string;
      } else {
        const buy = await createDeal(db, ACTOR, {
          name: `${o.name ?? "Deal"} — sourcing`,
          dealKind: "purchase_only",
          productGroup: o.product_group ?? null,
          sellerOrganisationId: o.producer_organisation_id, // producer sells to us
          buyerOrganisationId: o.seller_organisation_id, // the manufacturer/house buys
          customerOrganisationId: o.seller_organisation_id, // legacy customer==buyer mirror
          spineId, // SAME spine — no new spine
          currency: o.currency ?? "EUR",
          idempotencyKey: `e8-split:${o.id}`,
        });
        if (!buy.success) { splitFailed++; console.error(`  ✗ split ${o.id}: ${buy.error}`); continue; }
        buyLegId = buy.data.id;
      }
      const upd = await db.from("orders").update({ upstream_deal_id: buyLegId }).eq("id", o.id);
      if (upd.error) { splitFailed++; console.error(`  ✗ link ${o.id}: ${upd.error.message}`); continue; }
      splitsMade++;
    }
  }

  console.log(`\nApplied: spines=${spinesMade} codes=${codesMade} splits=${splitsMade} (failed=${splitFailed})`);

  // ── 4) address-book mapping (spec §9.3 / subtask 2) ──────────────────────────
  // Derive the two walled books from deal roles, ADDITIVELY (only ever set a flag
  // to true; never clear one). A buyer on a sell/bilateral leg IS a client; a
  // seller on a buy leg IS a supplier. is_supplier is the E4 address-book flag;
  // is_customer is the (multi-role) company-role flag the client book reads.
  const bookMapped = await mapAddressBooks(db);
  console.log(`Address books: +${bookMapped.customers} is_customer, +${bookMapped.suppliers} is_supplier (additive)`);

  // ── reconcile ──────────────────────────────────────────────────────────────
  const { data: after } = await db
    .from("orders")
    .select("id, spine_id, deal_code, producer_organisation_id, upstream_deal_id, deal_kind, seller_organisation_id, buyer_organisation_id");
  const A = (after ?? []) as OrderRow[];
  const validAfter = A.filter(isValidBilateral);
  const buyLegs = A.filter((o) => o.deal_kind === "purchase_only");
  const sellLegs = A.filter((o) => o.deal_kind !== "purchase_only");
  const stillUnsplit = A.filter(needsSplit);
  const validNoSpine = validAfter.filter((o) => !o.spine_id);
  const validNoCode = validAfter.filter((o) => !o.deal_code);
  const uniqSpines = new Set(A.map((o) => o.spine_id).filter(Boolean));
  const byId = new Map(A.map((o) => [o.id, o]));

  // Upstream-link integrity: every sell leg that points to a buy leg must point to a
  // purchase_only row on the SAME spine, with the correct direction (buy-leg seller =
  // this sell leg's producer, buy-leg buyer = this sell leg's seller). Catches a
  // transposed split, a wrong-spine buy leg, and a dangling link.
  const linkErrors: string[] = [];
  const upstreamRefCount = new Map<string, number>();
  for (const s of sellLegs) {
    if (!s.upstream_deal_id) continue;
    upstreamRefCount.set(s.upstream_deal_id, (upstreamRefCount.get(s.upstream_deal_id) ?? 0) + 1);
    const t = byId.get(s.upstream_deal_id);
    if (!t) { linkErrors.push(`${s.id}: upstream target missing`); continue; }
    if (t.deal_kind !== "purchase_only") linkErrors.push(`${s.id}: upstream not purchase_only`);
    if (t.spine_id !== s.spine_id) linkErrors.push(`${s.id}: buy leg on a different spine`);
    if (s.producer_organisation_id && t.seller_organisation_id !== s.producer_organisation_id) linkErrors.push(`${s.id}: buy-leg seller != producer`);
    if (t.buyer_organisation_id !== s.seller_organisation_id) linkErrors.push(`${s.id}: buy-leg buyer != manufacturer`);
  }
  const dupLinks = [...upstreamRefCount.entries()].filter(([, n]) => n > 1);
  // Orphan buy legs: a purchase_only row sharing a SELL leg's spine but referenced by
  // no sell leg — the signature of a created-but-unlinked duplicate from a partial run.
  const referenced = new Set(upstreamRefCount.keys());
  const sellSpines = new Set(sellLegs.map((s) => s.spine_id).filter(Boolean));
  const orphanBuyLegs = buyLegs.filter((b) => b.spine_id && sellSpines.has(b.spine_id) && !referenced.has(b.id));

  console.log(`\n── reconciliation ──`);
  console.log(`orders total now:        ${A.length}  (was ${orders.length}; +${A.length - orders.length} buy legs)`);
  console.log(`distinct spines:         ${uniqSpines.size}`);
  console.log(`valid orders w/o spine:  ${validNoSpine.length}  (must be 0)`);
  console.log(`valid orders w/o code:   ${validNoCode.length}  (must be 0)`);
  console.log(`producer rows unsplit:   ${stillUnsplit.length}  (must be 0)`);
  console.log(`purchase_only buy legs:  ${buyLegs.length}`);
  console.log(`upstream link errors:    ${linkErrors.length}  (must be 0)`);
  console.log(`duplicate upstream refs: ${dupLinks.length}  (must be 0)`);
  console.log(`orphan buy legs:         ${orphanBuyLegs.length}  (must be 0)`);
  if (validNoCode.length) console.log(`  no-code ids: ${validNoCode.map((o) => o.id).join(", ")}`);
  if (linkErrors.length) linkErrors.slice(0, 20).forEach((e) => console.log(`  link: ${e}`));
  if (orphanBuyLegs.length) console.log(`  orphan buy-leg ids: ${orphanBuyLegs.map((o) => o.id).join(", ")}`);

  const okReconcile =
    validNoSpine.length === 0 &&
    validNoCode.length === 0 &&
    stillUnsplit.length === 0 &&
    linkErrors.length === 0 &&
    dupLinks.length === 0 &&
    orphanBuyLegs.length === 0;
  console.log(`\n${okReconcile ? "✓ RECONCILED" : "✗ RECONCILE FAILED"}`);
  if (!okReconcile) process.exitCode = 1;
}

main().catch((e) => { console.error("FATAL", e); process.exitCode = 1; });
