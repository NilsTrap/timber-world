# Timber MVP role-matrix gate

## Local release gate

This gate is deterministic, credential-free, and makes no network or database calls.

```sh
pnpm --dir apps/portal test:timber-mvp-gate
```

Run it twice before review. Both runs must exit `0` and report `Timber role matrix: 11 actors` with the same assertion count. The command runs the matrix plus the focused Companies, Projects gate, projection/field-wall, and workspace suites.

The staging RLS companion is intentionally separate because it requires the approved staging test harness and creates short-lived, test-owned metadata canaries:

```sh
NEGATIVE_TESTS_FAIL_ON_LEAK=true pnpm --dir tests/rls-and-perf negative
```

It must fail when a required seed is missing, when a matching happy-path row/file is not visible, or when any denial leaks a row/write. Do not point it at production.

## Staging-only human checklist

Use existing human-controlled test accounts. Never place passwords, cookies, tokens, signed URLs, or account recovery data in this document, screenshots, logs, task comments, or snapshots. Do not create accounts for this check.

Before starting:

- [ ] Confirm the browser hostname is the approved `timber-portal-staging` host and visibly identifies staging.
- [ ] Stop immediately if the hostname is production or ambiguous; no production writes or deletes are permitted.
- [ ] Use only staging records owned by the test fixture/canary set; record human-readable labels, never IDs or URLs containing tokens.
- [ ] Repeat navigation/list/detail denial checks at desktop and mobile widths.

Expected role matrix:

| Account | Companies | Projects and creation | Workspace on a visible project | Direct-ID denial |
| --- | --- | --- | --- | --- |
| Platform admin | Clients, Suppliers, and Traders; view/edit fixture companies | Nav/list/detail available; create as Trader | Upload, reopen, preview, download, rename, and confirmed delete succeed | Not applicable to authorised records; malformed ID is unavailable |
| Buyer / Customer | Own client company only, read-only | Own projects visible; create offers Buyer only | Read succeeds; writes follow the account's `deal:create` action | Unrelated company/project/file is unavailable |
| Trader — clients only | Linked Clients view/edit; Suppliers and Traders absent | Visible projects; create offers Trader only | Read/write visible project files | Supplier-book and unrelated IDs are unavailable |
| Trader — suppliers only | Linked Suppliers view/edit; Clients and Traders absent | Visible projects; create offers Trader only | Read/write visible project files | Client-book and unrelated IDs are unavailable |
| Trader — both books | Linked Clients and Suppliers view/edit; Traders absent | Visible projects; create offers Trader only | Read/write visible project files | Unlinked company/project/file is unavailable |
| Manufacturer / Supplier | Own supplier company only, read-only | Own projects visible; project creation unavailable | Read succeeds; writes only with explicit `deal:create` | Downstream/wrong-leg project/file is unavailable |
| Buyer + Trader | Own client company; no Traders book | Visible projects; create chooser offers Buyer and Trader only | Read/write visible project files | Unrelated project/file is unavailable |
| Inactive user | No protected Company surface | No Projects navigation or usable direct route | No file operation succeeds | Known and unknown IDs have the same unavailable result |
| Inactive membership | No organisation-scoped Company surface | Projects unavailable for the inactive organisation | No file operation succeeds | Pasted IDs reveal no record facts |
| No module / no action | Only any separately allowed self Company view | Projects navigation/direct route unavailable; creation unavailable | No file operation succeeds | Pasted IDs reveal no record facts |
| Unrelated organisation | Own Company view only; target Company unavailable | Projects area may open for own work; target project absent; own-role creation only | Target project/file operations unavailable | Known hidden and unknown IDs are indistinguishable |

For every applicable happy-path row:

- [ ] Open Companies list, detail, and edit → only the books/records/actions in the table appear.
- [ ] Open Projects navigation, list, and detail → only projects for the current organisation appear.
- [ ] Create a staging canary as Buyer/Trader/multi-role → only the expected role choices appear and one project is created.
- [ ] Upload a small PDF into a nested folder, reopen the project, preview and download it → tree/path/name persist and no URL is recorded.
- [ ] Rename the file and folder, then use the confirmation UI to delete the canary → only the test-owned canary is removed.

For every applicable denial row:

- [ ] Paste malformed, unrelated-company, unrelated-project, wrong-leg, and hidden-file routes → each returns the same unavailable/not-found presentation without names, codes, counts, or existence clues.
- [ ] Inspect browser-visible response payloads only → forbidden customer/supplier identities, prices/terms, margin/chain fields, storage paths, and signed URLs are absent rather than CSS-hidden.
- [ ] Attempt create/upload/rename/delete without the required module/action → the operation is unavailable and no staging row/object is created.

Finish by deleting only canaries created during this staging run, signing out each account, and confirming saved artifacts contain no credentials, IDs, signed URLs, or production data.
