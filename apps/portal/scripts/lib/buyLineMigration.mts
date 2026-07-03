/**
 * Shared buy-line normalization (Spec-Alignment Wave · Epic A / A2). Moves every
 * conflated `side='buy'` order_line_item onto the deal that should OWN it, stored
 * as side='sell' (spec §2.1 "no buying inside a selling deal"; §2.3 "the connection
 * is the spine"). Used by BOTH the standalone A2 staging migration
 * (scripts/a2-migrate-buy-lines.mts) AND the E8 prod-cutover script
 * (scripts/e8-migrate-legacy-orders.mts) so the two stay IDENTICAL.
 *
 * Resolution per source order carrying buy lines:
 *  - IN-PLACE: the order is itself a `purchase_only` buy leg → its buy lines are
 *    its own, just mislabelled → re-tag 'sell' in place.
 *  - MOVE: otherwise resolve the spine-sibling buy leg via shared spine_id + party
 *    roles (the purchase_only deal on the SAME spine whose buyer == this order's
 *    seller/house). `upstream_deal_id` is only a cross-check.
 *  - REPORT: no resolvable buy leg → left for a human (never guessed).
 *
 * Idempotent: once attached, the source order has no side='buy' lines left.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export interface BuyLineOrderRow {
  id: string;
  spine_id: string | null;
  deal_code: string | null;
  deal_kind: string | null;
  seller_organisation_id: string | null;
  buyer_organisation_id: string | null;
  upstream_deal_id: string | null;
}

interface LineRow {
  id: string;
  order_id: string;
  line_no: number;
}

export interface BuyLineMigrationResult {
  ok: boolean;
  buyLines: number;
  movedOrders: number;
  movedLines: number;
  failed: number;
  /** Orders carrying buy lines with NO resolvable buy leg — for a human to resolve. */
  unresolved: Array<{ id: string; dealCode: string | null; lineCount: number; note: string }>;
  /** Buy lines that remain on orders WITH a buy leg (must be 0 for success). */
  leaked: number;
}

export async function runBuyLineMigration(db: Db, apply: boolean): Promise<BuyLineMigrationResult> {
  console.log(`\n── buy-line normalization ${apply ? "(APPLY)" : "(DRY-RUN)"} ──`);

  const { data: buyLinesData, error: blErr } = await db
    .from("order_line_items")
    .select("id, order_id, line_no")
    .eq("side", "buy");
  if (blErr) throw new Error(`Fetch buy lines failed: ${blErr.message}`);
  const buyLines = (buyLinesData ?? []) as LineRow[];

  const byOrder = new Map<string, LineRow[]>();
  for (const l of buyLines) {
    const arr = byOrder.get(l.order_id) ?? [];
    arr.push(l);
    byOrder.set(l.order_id, arr);
  }
  const sourceIds = [...byOrder.keys()];
  console.log(`buy-side line items:          ${buyLines.length}  (on ${sourceIds.length} order[s])`);
  if (sourceIds.length === 0) {
    console.log(`nothing to normalize — no side='buy' lines. ✓`);
    return { ok: true, buyLines: 0, movedOrders: 0, movedLines: 0, failed: 0, unresolved: [], leaked: 0 };
  }

  const { data: allOrdersData, error: aoErr } = await db
    .from("orders")
    .select("id, spine_id, deal_code, deal_kind, seller_organisation_id, buyer_organisation_id, upstream_deal_id");
  if (aoErr) throw new Error(`Fetch orders failed: ${aoErr.message}`);
  const allOrders = (allOrdersData ?? []) as BuyLineOrderRow[];
  const byId = new Map(allOrders.map((o) => [o.id, o]));

  function resolveBuyLeg(src: BuyLineOrderRow): { leg: BuyLineOrderRow | null; note: string } {
    if (!src.spine_id) return { leg: null, note: "source has no spine_id" };
    if (!src.seller_organisation_id) return { leg: null, note: "source has no seller (house) org" };
    const candidates = allOrders.filter(
      (o) =>
        o.id !== src.id &&
        o.spine_id === src.spine_id &&
        o.deal_kind === "purchase_only" &&
        o.buyer_organisation_id === src.seller_organisation_id,
    );
    if (candidates.length === 0) return { leg: null, note: "no purchase_only buy leg on the spine" };
    if (candidates.length === 1) {
      const leg = candidates[0];
      if (src.upstream_deal_id && src.upstream_deal_id !== leg.id) {
        return { leg, note: `resolved by spine; upstream_deal_id points elsewhere — using spine result` };
      }
      return { leg, note: "resolved by spine + roles" };
    }
    const pointed = src.upstream_deal_id ? candidates.find((c) => c.id === src.upstream_deal_id) : null;
    if (pointed) return { leg: pointed, note: `multiple buy legs; picked upstream_deal_id target` };
    return { leg: null, note: `AMBIGUOUS: ${candidates.length} buy legs on the spine, no upstream pointer` };
  }

  const plan: Array<{ src: BuyLineOrderRow; target: BuyLineOrderRow; kind: "inplace" | "move"; lines: LineRow[]; note: string }> = [];
  const unresolved: BuyLineMigrationResult["unresolved"] = [];
  for (const oid of sourceIds) {
    const src = byId.get(oid);
    const lines = byOrder.get(oid) ?? [];
    if (!src) { unresolved.push({ id: oid, dealCode: null, lineCount: lines.length, note: "source order row not found" }); continue; }
    if (src.deal_kind === "purchase_only") {
      plan.push({ src, target: src, kind: "inplace", lines, note: "re-tag in place (order is a buy leg)" });
      continue;
    }
    const { leg, note } = resolveBuyLeg(src);
    if (leg) plan.push({ src, target: leg, kind: "move", lines, note });
    else unresolved.push({ id: src.id, dealCode: src.deal_code, lineCount: lines.length, note });
  }

  for (const p of plan) {
    const verb = p.kind === "inplace" ? "re-tag in place" : `move → ${p.target.deal_code ?? p.target.id}`;
    console.log(`  • ${p.src.deal_code ?? p.src.id} (${p.lines.length} buy line[s]) ${verb}  [${p.note}]`);
  }
  for (const u of unresolved) {
    console.log(`  ⚠ REPORT ${u.dealCode ?? u.id} — ${u.lineCount} buy line(s) — ${u.note}`);
  }

  if (!apply) {
    console.log(`  dry-run only — re-run with --apply to execute.`);
    return { ok: true, buyLines: buyLines.length, movedOrders: 0, movedLines: 0, failed: 0, unresolved, leaked: 0 };
  }

  let movedOrders = 0, movedLines = 0, failed = 0;
  for (const p of plan) {
    const movingIds = new Set(p.lines.map((l) => l.id));
    const { data: existing } = await db
      .from("order_line_items")
      .select("id, line_no")
      .eq("order_id", p.target.id);
    let nextNo = ((existing ?? []) as { id: string; line_no: number }[])
      .filter((r) => !movingIds.has(r.id))
      .reduce((m, r) => Math.max(m, r.line_no ?? 0), 0) + 1;
    let ok = true;
    const ordered = [...p.lines].sort((a, b) => (a.line_no ?? 0) - (b.line_no ?? 0));
    for (const l of ordered) {
      const { error } = await db
        .from("order_line_items")
        .update({ order_id: p.target.id, side: "sell", line_no: nextNo })
        .eq("id", l.id);
      if (error) { ok = false; failed++; console.error(`  ✗ ${p.kind} line ${l.id}: ${error.message}`); break; }
      nextNo++;
      movedLines++;
    }
    if (ok) movedOrders++;
  }
  console.log(`  applied: orders=${movedOrders} lines=${movedLines} (failed=${failed})`);

  // Reconcile: buy lines may remain ONLY on the reported (unresolved) orders.
  const { data: afterData } = await db.from("order_line_items").select("id, order_id, line_no").eq("side", "buy");
  const after = (afterData ?? []) as LineRow[];
  const unresolvedIds = new Set(unresolved.map((u) => u.id));
  const leaked = after.filter((l) => !unresolvedIds.has(l.order_id)).length;
  console.log(`  buy lines remaining: ${after.length}  (reported=${after.length - leaked}, leaked-with-buy-leg=${leaked} must be 0)`);
  const okResult = leaked === 0 && failed === 0;
  console.log(`  ${okResult ? "✓ buy-line normalization reconciled" : "✗ buy-line normalization FAILED"}`);
  return { ok: okResult, buyLines: buyLines.length, movedOrders, movedLines, failed, unresolved, leaked };
}
