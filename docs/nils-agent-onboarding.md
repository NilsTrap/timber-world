# Agent onboarding — Timber World platform (for Nils's Claude Code agents)

_Last updated 2026-07-05. This is the standing context document for any AI agent working on this repository on Nils's side. Read it fully before your first change. It states the environment rules, the deployment mechanics, the architecture entry points, and the hard boundaries._

---

## 1. The one rule that overrides everything

**PRODUCTION IS FROZEN.** All development happens on the **staging** environment. Nothing is merged, deployed, or migrated to production. The production system (the old Timber portal that real users — the stairs production and shipments teams — use daily) keeps running exactly as it is. Moving the new platform to production ("the E8 cutover") is a deliberate, coordinated event that Nils and Edgars will trigger together explicitly — never something an agent decides or does on its own, and it involves a data migration that must be run as a whole.

Concretely, an agent must NEVER:
- push to or merge into `main` (that is the production codebase),
- deploy to the production Vercel project (`timber-portal`, or whatever project the repo's `.vercel/project.json` happens to be linked to — CHECK before deploying, see §4),
- run SQL against the **production** Supabase project (`psmra…` ref) — staging is `fyzrtqsnmnizoxgcqsjc`,
- touch `timber.agentwave.app` (that is the managed Oscar/Vilma AI instance — it is updated exclusively by its own fleet engine on Edgars's side; never SSH, patch, or deploy to it).

## 2. Git

- **Repo:** `NilsTrap/timber-world` (GitHub). The agent has full git access to this repository and nothing outside it.
- **Working branch: `feature/timber-spec-phase`.** This is the live integration branch of the NEW platform — everything on staging is built from it. Work directly on it (or on short-lived branches merged back into it).
- **Always `git fetch && git pull --rebase origin feature/timber-spec-phase` before starting work AND again before every push or deploy.** Multiple agents have historically worked this branch concurrently; the rebase-first discipline is what prevents lost work and rejected pushes. Never force-push.
- `main` = production code. Leave it alone until the coordinated cutover.
- Commit style: conventional-ish messages (`feat(orders): …`, `fix(catalog): …`); one revertible concern per commit.

## 3. Environments

| | Production (FROZEN) | Staging (work here) |
|---|---|---|
| Portal URL | the live legacy portal | **https://timber-portal-staging.vercel.app** |
| Vercel project | `timber-portal` | **`timber-portal-staging`** |
| Supabase project | `psmra…` (eu / Ireland) — DO NOT TOUCH | **`fyzrtqsnmnizoxgcqsjc`** (eu-central-1) |
| Branch | `main` | `feature/timber-spec-phase` |
| Users | real production users (legacy flows) | Nils testing + demo data |

Staging login: Nils's normal credentials work (staging mirrors prod auth data from the last refresh). Demo/test records are `[DEMO]`-tagged where possible.

## 4. Deploying to staging (the exact runbook)

Deploys go through the Vercel CLI, authenticated as Nils's Vercel account (team `nils-projects-…`).

```bash
# from the REPOSITORY ROOT — NEVER from apps/portal (deploying from there dies at pnpm install
# on Vercel's builder with ERR_INVALID_THIS; do NOT try to "fix" that by bumping pnpm — deploy from root)
vercel --prod --yes --scope nils-projects-ee818bb8   # --prod here means "production OF THE STAGING PROJECT"
# first time on a fresh checkout, link the root once:
#   vercel link --yes --project timber-portal-staging --scope nils-projects-ee818bb8
```

Then poll `vercel inspect <deployment-url>` until `● Ready` (region fra1), check `curl -sL -o /dev/null -w '%{http_code}' https://timber-portal-staging.vercel.app/` → 200, and **verify the actual feature you changed in the browser** before calling it done. If the deploy errors, read the build log (`vercel inspect --logs`), fix, redeploy — never leave staging broken overnight.

**Safety check before every deploy:** `cat .vercel/project.json` — it must name `timber-portal-staging`. If it names anything else (e.g. the production project), STOP and re-link to staging first.

## 5. Database migrations (staging only)

- Migrations live in `supabase/migrations/` (timestamped SQL). Style: **additive and idempotent** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` + recreate). Never destructive drops of data.
- Apply them to the **staging** project only — via the Supabase dashboard SQL editor (project `fyzrtqsnmnizoxgcqsjc`) or the Supabase CLI/API authenticated with Nils's own access. There is **no local Docker database** — never `supabase db reset` or `supabase start`.
- Every migration file committed to the repo must also actually be applied to staging (they don't auto-apply) — apply, then verify with a SELECT.
- RLS is load-bearing (see §7). If you touch any RLS function or policy, run the `tests/rls-and-perf` suite against staging before considering the change done.

## 6. Quality gates (before every commit)

```bash
pnpm type-check        # must be 8/8 tasks successful — the primary gate
```
Plus, when your change touches the relevant area:
- `apps/portal` nav config → run `src/components/layout/navItems.test.ts` (via tsx),
- documents/templates → the document assemble/render tests,
- RLS/permissions → `tests/rls-and-perf` against staging.

Do not use `next dev` for verifying client-heavy UI — it has a known hydration problem on this Next canary; verify via the staging deploy (or `pnpm build && pnpm start` locally).

## 7. Architecture — what you must read before designing anything

**Read in this order:**
1. `CLAUDE.md` (repo root) — monorepo layout, component standards (dense tables, page layout primitives), permissions model, domain conventions. NOTE: some of its sections describe the LEGACY orders system (e.g. "Party Naming: Customer/Manufacturer/Producer" — the new deal model uses Buyer/Seller); where CLAUDE.md and `docs/wave2-spine-lego.md` disagree about deals, the wave2 doc wins.
2. `docs/wave2-spine-lego.md` §1 — **the current deal model** (this supersedes older docs where they conflict): deals are strictly bilateral (one seller, one buyer) Lego blocks attached to a **spine**; chains have no fixed shape; the admin assembles legs manually ("Leg from original order" / "Create next leg"); nothing auto-spawns.
3. `docs/spec-alignment-wave.md` — the wave-1 epic history + the reconciliation of the spec with the build.
4. **Nils's System Specification v1.0 (PDF)** — the authoritative product spec (spine, bilateral deals, lifecycle+gates, documents, roles §9). Keep a copy in `docs/` and treat its §-numbered requirements as the source of truth for product questions.
5. `docs/template-field-mapping.md` — how document placeholders map to data.
6. `docs/timber-mcp-tools.md` (when present) — the MCP tool surface for AI integrations.

**The load-bearing invariants (do not break):**
- **A deal knows only its two parties** (spec §2.1). No "buying inside a selling deal". The chain lives in the spine (`spine_id`), never in deal-held pointers.
- **Access walls are the reason the system exists** (spec §9): deal-level isolation via RLS (`can_access_deal_row`) + field-level visibility via access-group field domains. Salespeople never see suppliers/buy legs; purchasing never sees clients; counterparty logins see only their own deal. Any new query surface must respect both layers — test with the seeded staging logins (salesperson / purchasing / producer / client), not just as admin.
- **UI and MCP are twin thin callers of one shared service layer.** Never put business logic in a component or an MCP handler — it goes in `features/*/services`, and every new user-facing action should get its MCP tool (see the coverage test in `apps/portal/src/app/api/timber-mcp/`).
- **Deletes always confirm.** Destructive bulk actions double-confirm.
- **Gates are dormant by design** — the gate engine exists (Settings → Deal Gates) but ships unconfigured; stages move freely via the Set-stage control. Don't hardcode workflow enforcement (spec §1.3).
- Docs and code comments in **English**.

## 8. Secrets & credentials

- **Never read, print, or commit `.env*` files or any secret value.** Environment variables live in the Vercel project settings (dashboard) — change them there, not in files.
- Never paste MCP tokens, service-role keys, or passwords into chat, commits, or logs. If a credential is missing, ask Nils to set it in the Vercel/Supabase dashboards.
- Password/credential operations for portal users are done through the portal UI only.

## 9. Things that look odd but are deliberate (don't "fix" them)

- `orders.side` on line items and `upstream_deal_id` are **legacy/deprecated** — kept for rollback safety; don't write to them, don't build on them (use `spine_id`).
- The **Legacy** nav group (Inventory, Production, CMS, …) is the old system kept reachable — it stays until the prod cutover; its prod counterparts have real users.
- `advance_pct` has no input in the UI — it derives from the payment-terms option (documents still consume it).
- The catalog is also the inventory (stock per variant per packaging form); the legacy `inventory_packages` runs in parallel until decommission — don't drop or unify without an explicit product decision.
- Two permission layers coexist: **modules** gate navigation; **access groups** gate deal rows/fields. Documented in `docs/identity-consolidation-report.md`.

## 10. Working style expectations

- Verify before reporting done: type-check, deploy, then exercise the actual feature on staging (as the right user role). "It compiles" is not "it works".
- Prefer small, revertible commits; a commit is the rollback unit.
- When a request conflicts with the spec or these rules (especially anything touching production), STOP and surface the conflict to Nils instead of proceeding.
- If something in this document appears outdated relative to the code, trust the code, and update this document in the same commit.
