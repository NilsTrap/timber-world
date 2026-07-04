# K4 — Membership-model reconciliation report

**Branch:** `wave/streamB-identity` · **Migration:** `supabase/migrations/20260704130004_membership_backfill.sql`
**Scope:** reconcile the two parallel org-membership sources of truth on **staging**. Additive backfill only. **No RLS-function changes, no column drops, no application reader changes.** Prod is FROZEN — the backfill must be re-run on prod during the E8 cutover (SQL below).

---

## 1. Background — two sources of truth

A user's org membership is recorded in two places, both still written and read:

1. **`organization_memberships`** — `(user_id, organization_id, is_active, is_primary, invited_by, …)`. Unique constraint **`org_memberships_unique (user_id, organization_id)`** (from `20260201000001_epic10_core_tables.sql`). The multi-org model (Epic 10+).
2. **Legacy `portal_users.organisation_id`** — the pre-Epic-10 single "home org".

**The legacy column is LOAD-BEARING in RLS and was NOT touched.** `current_user_in_org(org_id)` (`20260522000002_rls_helpers.sql`) grants when **EITHER**:
- an **active membership** exists for the caller+org, **OR**
- `portal_users.organisation_id = org_id` (legacy, no `is_active` check).

`current_user_shares_context_with_org` and the `organisations_select` policy depend on this. Because the two branches are OR'd, an **additive** membership backfill **cannot change RLS visibility** — it only ever makes the membership branch redundant with the already-granting legacy branch. This is why the backfill is safe.

---

## 2. Reader audit (current worktree)

Every genuine reader/writer of **`portal_users.organisation_id`** (excluding the many unrelated `*_organisation_id` columns on other tables). Classification + decision:

| # | File:line | What it does | Prefers memberships? | Decision |
|---|-----------|--------------|----------------------|----------|
| 1 | `lib/auth/getSession.ts:94,151-164` | Session resolver. Reads active memberships, then **adds the legacy home org to the membership list** if absent (marks primary) so current-org resolves. | Memberships-first, legacy as fallback | **LEAVE** — session/RLS-critical. Fallback becomes inert once the user has a membership (post-backfill) but must stay live for un-backfilled prod. |
| 2 | `app/api/auth/switch-organization/route.ts:47-65` | On org switch, treats `organisation_id` as a valid legacy target (`isLegacyOrg`). | Both | **LEAVE** — session/RLS-adjacent; removing it could break switching for legacy-only users on prod. |
| 3 | `features/view-as/actions/viewAs.ts:115-145` | Admin impersonation: reads target user's home org, sets the view-as org cookie. | Legacy | **LEAVE** — session-adjacent (drives impersonated context). Not a wall. |
| 4 | `features/access/actions/groups.ts:264-272` | **The I2 fallback (commit 113032c).** When a user has **0 active memberships**, falls back to home org to resolve which org to assign a group in. | Memberships-first, legacy fallback | **LEAVE + note** — backfill makes it dead for home-org users **on staging**, but prod is not yet backfilled, so it is **not provably dead in prod**. Task rule: remove only if provably dead AND suite green. Dead-code after prod cutover (see §5). |
| 5 | `features/organisations/actions/getOrganisations.ts:66-99` | Org table user **count** = legacy ∪ active membership (deduped). | **Already union** | **LEAVE** — already correct; count is invariant across the backfill. Memberships-only would under-count legacy-only users pre-prod-backfill. |
| 6 | `features/organisations/actions/getOrganisationById.ts:77-97` | Single-org user **count** = legacy ∪ active membership (deduped). | **Already union** | **LEAVE** — same as #5. |
| 7 | `features/organisations/actions/getPeopleDirectory.ts:61,110-124` | People directory: org refs = legacy home first, then memberships (deduped). | **Already union** | **LEAVE** — already correct. |
| 8 | `features/organisations/actions/getPersonMemberships.ts:38-47,118-125` | Lists a person's orgs; legacy home org included + flagged. | **Already union** | **LEAVE** — already correct. |
| 9 | `features/counterparties/actions/counterparties.ts:98-119` | Admin Orgs-table members = legacy ∪ active membership. | **Already union** | **LEAVE** — already correct. |
| 10 | `features/organisations/actions/getAllPeople.ts:38,71-77` | People list: maps `organisation_id` → org name for display. | Legacy display only | **LEAVE** — display convenience, not a gate; membership orgs shown elsewhere. |
| 11 | `features/organisations/actions/getPersonById.ts:51-97` | Person profile: shows the home org. | Legacy | **LEAVE** — profile "home org" field; not a wall. |
| 12 | `features/organisations/actions/getOrganisationUsers.ts:56-162` | Org users list = legacy `organisation_id` users ∪ membership users. | **Already union** | **LEAVE** — already correct. |
| 13 | `features/organisations/actions/addExistingUserToOrganisation.ts:74-205` | Checks whether the user is already in the org via legacy col before adding a membership. | Both | **LEAVE** — legacy check prevents a duplicate/no-op add; safe. |
| 14 | `features/organisations/actions/removeUserFromOrganisation.ts:59-65` | Counts the legacy home org as a "primary" when guarding last-org removal. | Both | **LEAVE** — relaxed by K2/Q4; legacy still a valid primary source. |
| 15 | `features/organisations/actions/createOrganisationUser.ts:107-116` | **WRITES** `organisation_id` on insert. **Does NOT create a membership row.** | Writes legacy only | **LEAVE (this task) + FLAG** — this is the **root cause** of the drift (see §3/§5). Recommend a separate, tested change to also insert an `organization_memberships` row. |
| 16 | `features/auth/actions/completeInvite.ts:52` | Reads `organisation_id` during invite acceptance. | Legacy | **LEAVE** — invite/session flow; out of scope for a risky reconciliation task. |
| — | Credential/status actions: `toggleUserActive.ts:84`, `updateOrganisationUser.ts:152`, `sendUserCredentials.ts:70`, `resendUserCredentials.ts:70`, `resetUserPassword.ts:66`, `deleteOrganisationUser.ts:63-75` | Select `organisation_id` into the returned row; K2/Q4 already relaxed these so they no longer **gate** on it. | n/a | **LEAVE** — no membership logic to change. |

**RLS SQL readers of the legacy column** (NOT modified): `current_user_in_org` (`20260522000002_rls_helpers.sql`), the trading-partners policy (`20260217100004_fix_trading_partners_rls_memberships.sql`). Both OR legacy with memberships — load-bearing, left intact per the ground rules.

### Audit conclusion
There is **no reader** where switching to memberships-first is both **safe** and **adds correctness**:
- Every count/list reader (#5–9, #12) **already unions** legacy ∪ membership, so its output is **invariant** across the backfill — switching adds risk with zero benefit.
- Every remaining reader is **session/RLS-adjacent** (#1–4, #16) or **display-only** (#10–11), where the legacy path must stay live until prod is backfilled.

→ **No application readers were changed.** The deliverable is the additive backfill + this document.

---

## 3. Backfill — design & result

### Root cause of the gap
`createOrganisationUser` (#15) inserts `portal_users.organisation_id` but never creates a membership row. Every user created through that flow is **legacy-only** with no membership — exactly the observed gap. The backfill repairs existing rows; the flow will keep regenerating the gap until #15 is fixed (§5 recommendation).

### Migration `20260704130004_membership_backfill.sql`
Two idempotent, additive statements (conflict target = `org_memberships_unique (user_id, organization_id)`):

- **S1** — insert the missing home-org membership for any user with a home org and no membership for it. `is_active=true`; `is_primary=true` **only if the user has no primary anywhere** (guards against manufacturing a duplicate primary).
- **S2** — promote a user's existing home-org membership to primary **only if the user has no primary anywhere** (covers pre-existing non-primary rows). Never flips an existing primary, never moves a primary off another org.
- **Deliberate omission** — does **not** force-reactivate an existing *inactive* home-org membership (would be a semantic mutation of admin intent; RLS access is granted via the legacy branch regardless; 0 such rows on staging).

### Staging result (project `fyzrtqsnmnizoxgcqsjc`, applied via Management API)

| Metric | Before | After |
|---|---|---|
| Users with a non-null home org | 23 | 23 |
| Home-org users **missing** a membership row | **6** | **0** |
| Home-org users with **no primary membership anywhere** *(acceptance metric)* | **6** | **0** ✅ |
| Users with **>1 primary** membership *(duplicate-primary check)* | 0 | **0** ✅ |
| Inactive home-org memberships | 0 | 0 |
| Total `organization_memberships` rows | 30 | **36** (6 inserted) |

- **Idempotency verified:** re-applying the migration inserted/updated **0** rows (total stayed 36).
- **0-orphans verified:** `SELECT count(*) FROM portal_users pu WHERE pu.organisation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_memberships m WHERE m.user_id=pu.id AND COALESCE(m.is_primary,false)=true)` → **0**.
- The 6 backfilled users are **real** users (e.g. `edgars.rozentals@…`, `ablueroyal@…`, the `timberuat.local` UAT users). **No `@ijl.test` harness user was touched** (each already had its seeded home-org membership → skipped by the NOT-EXISTS guard).

---

## 4. rls-and-perf suite — the wall gate

**Command (from `tests/rls-and-perf/`, staging creds in a gitignored `.env.local` built from `~/.supabase-ijl/`):**
```
node_modules/.bin/tsx src/run.ts --mode=all
```
(One-time enabler: the 8 `@ijl.test` harness users' passwords on staging were stale vs `src/config.ts`, so sign-in failed. Reset **only those 8 auth passwords** to the config values via the service-role admin API — no portal data touched — then ran the suite.)

### Result
- **Cross-tenant negative probes (the security walls): 16 probes, 0 leaked, 16 blocked/informational.** ✅ Every org-A↔org-B read/insert probe and every E4 direction-aware house-wall probe (sales↔buy-leg, purchasing↔sell-leg, client, supplier) returned `blocked` / rows=0. **The walls are intact after the backfill.**
- **Positive snapshot diff: 2 diffs — both pre-existing baseline staleness, provably NOT from K4:**
  - `platform-admin/orders/list`: order **count 85 → 166**. Platform admin sees all orders (admin bypass); staging gained ~81 orders since the committed baseline was captured (e.g. `ORD-199`/`ORD-198`/`ORD-193` created **today** by Nils/Edgars & other stream activity). `test-admin` has **no home org** → not backfilled.
  - `supplier-user/orders/list`: count **1 → 2** — a new order involving the supplier org appeared. `test-supplier-user` **already had** its home-org membership → skipped by the backfill's NOT-EXISTS guard.
  - Both diffs are pure **data append** on shared staging, independent of the 6 membership rows this task added (which inserted 0 orders). **Not re-baselined** — the baseline is shared staging data owned by other tasks; re-baselining could mask real regressions for other agents.

Because **no application readers were changed**, there was nothing to revert; the additive backfill is the only change and the walls remain green.

---

## 5. PROD cutover note (E8) — MANDATORY

Prod is FROZEN and **not yet backfilled**. Every legacy fallback above (esp. `getSession` #1, `switch-organization` #2, the I2 `groups.ts` fallback #4) stays live on prod until this backfill runs. During the E8 cutover:

1. **Snapshot the prod DB** (cheap insurance) before running.
2. **Run the exact idempotent SQL below** (identical to `20260704130004_membership_backfill.sql`). Safe to run repeatedly.
3. **Verify 0 orphans** with the check query (also below); expect a small non-zero insert count.

```sql
-- S1: insert missing home-org membership (primary iff user has no primary yet)
INSERT INTO public.organization_memberships (user_id, organization_id, is_active, is_primary)
SELECT pu.id, pu.organisation_id, true,
       NOT EXISTS (SELECT 1 FROM public.organization_memberships mp
                   WHERE mp.user_id = pu.id AND COALESCE(mp.is_primary, false) = true)
FROM public.portal_users pu
WHERE pu.organisation_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.organization_memberships m
                  WHERE m.user_id = pu.id AND m.organization_id = pu.organisation_id);

-- S2: promote home-org membership to primary for users who still have none
UPDATE public.organization_memberships m
SET is_primary = true
FROM public.portal_users pu
WHERE m.user_id = pu.id
  AND m.organization_id = pu.organisation_id
  AND pu.organisation_id IS NOT NULL
  AND COALESCE(m.is_primary, false) = false
  AND NOT EXISTS (SELECT 1 FROM public.organization_memberships mp
                  WHERE mp.user_id = pu.id AND COALESCE(mp.is_primary, false) = true);

-- Verify: MUST return 0
SELECT count(*) AS orphans
FROM public.portal_users pu
WHERE pu.organisation_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.organization_memberships m
                  WHERE m.user_id = pu.id AND COALESCE(m.is_primary, false) = true);
```

### Follow-up recommendations (separate, tested changes — NOT in this task)
- **Fix the root cause (#15):** make `createOrganisationUser` (and any other legacy-org writer) also insert an `organization_memberships` row, so the drift stops regenerating.
- **Post-cutover simplification (gated):** once prod is backfilled AND a `0 legacy-only users` check passes, the I2 `groups.ts` legacy fallback (#4) becomes dead code and the count/list unions (#5–9, #12) can drop their legacy branch. Do this only after re-running the rls-and-perf suite green.

### Column-drop stance
**The legacy `portal_users.organisation_id` column STAYS.** It is load-bearing in `current_user_in_org` (and the trading-partners RLS policy). **No column drops** were made or are recommended until the RLS helpers are first refactored off the legacy branch — a larger, separately-gated change out of scope for K4.
