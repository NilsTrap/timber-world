# Identity & CRM consolidation — audit report (Epic I, 2026-07-04)

Companion to `docs/spec-alignment-wave.md` Epic I. Records the verified data model,
the duplicate edit surfaces, the two permission layers, and recommendations, plus a
summary of what I1–I3 shipped.

## 1. One source of truth — the data model

There is **one organisations table**. Everything identity-related is a view of it:

| Surface | What it shows | Filter |
|---|---|---|
| **Orgs & People** (`/admin/organisations`) | every organisation | none (the full list) |
| **CRM → Clients** (`/counterparties/clients`) | client records | `is_customer = true` |
| **CRM → Suppliers** (`/counterparties/suppliers`) | supplier records | `is_supplier = true OR is_producer = true` |

A "counterparty record **is** an `organisations` row" — `CounterpartyRow.id === organisations.id`
(`features/counterparties/actions/counterparties.ts` queries `.from("organisations")`). There is
**no separate `counterparties` table**. The CRM books are filtered lenses, nothing more.

Consequence: an organisation with **no role flags** (e.g. an internal/house org, or Edgars's "OOO")
appears in **no CRM book** — correct by the filters, but previously invisible with no explanation.

**I1 fix:** the org detail + org list now show an **"Appears in"** indicator (Clients book / Suppliers
book / "Internal — no CRM book"), and the org-detail **Roles** toggle gained the missing **Supplier**
button (writes `is_supplier`, the column the Suppliers book already reads). Toggling Supplier on an org
makes it appear in the Suppliers book instantly. Cross-links now bridge the two views (admin only):
the CRM card links to the org record (`/admin/organisations/{id}`), and the org record's "Appears in"
line links to the CRM books.

## 2. Duplicate edit surfaces (same row, two forms)

The company-identity fields — `legal_address`, `vat_number`, `registration_number`, `country`, `phone`,
`email`, `website`, `bank_name`, `bank_account_number`, `bank_swift_code` — are editable in **both**:

- the **CRM counterparty card** (`CounterpartyManager` dialog), and
- the **Orgs & People org detail** (`OrganisationForm` / `OrganisationDetailTabs`).

Because both write the **same `organisations` row**, this is **not data duplication and there is no sync
issue** — they are two views of one record. The signee fields (`default_signee_name` / `default_signee_role`)
are captured on the **CRM card only**, not on the Orgs & People form.

**Recommendation (not built — product call):** keep both edit surfaces (each is convenient in its context)
but treat the **CRM card as the canonical edit home for a trading partner's commercial identity**, and the
**org record as canonical for admin/internal orgs**. The new I1 cross-links let a user hop between them, so
neither needs to duplicate the other's affordances. If a single home is desired later, add signee inputs to
the org form and point CRM edits there — a small change, since it is one row.

## 3. Two permission layers (they are NOT redundant)

| Layer | Where | Controls |
|---|---|---|
| **Org modules** (`OrganisationModulesTab`) | org detail → Modules | the **ceiling** of what an org *can* use; drives **nav/page gating** (which sections appear). |
| **Access groups** (`Settings → Access Groups`) | group rights + per-user assignment | the per-user **grant within that ceiling**; the sole home of the **walled-book action gates** (`counterparty:clients` / `:suppliers`) and **deal field-level rights** (E4). |

Both are needed: modules decide *what's available to the org*; groups decide *what this user may do with it*.
A right must be enabled at **both** layers to take effect (org module on ∩ user's group grants it).

**I2 fix (discoverability — Edgars "couldn't find it"):** the People tab now shows each user's **access
groups as chips** and a labelled **"Groups"** action (was an unlabelled icon); and each group in Settings →
Access Groups gained a **Members** dialog (list / add via user search / remove). Both surfaces write the same
`user_access_groups` rows, so they always agree, and member counts stay correct.

## 4. Org switcher retirement (I3)

Two org dropdowns lived above the nav: the **OrganizationSwitcher** (multi-org member switch) and the
**OrganizationSelector** ("All Orgs" super-admin URL filter). Both are now **hidden for admins** — admins
operate across all orgs, so a "current org" control is meaningless for them. Genuine multi-org **non-admin**
users (3 on staging) keep their switcher. The session org-resolution mechanism (`getSession` → cookie →
membership) is **untouched** — only the UI control is hidden, so there are no permission regressions. (If you
prefer to keep the super-admin "All Orgs" filter, it's a one-line revert; I hid it because you flagged the
dropdown as having "lost its meaning".)

## 5. Naming

The nav is already labelled **"CRM"** (renamed from "Counterparties" on 2026-07-04; routes `/counterparties`
and module codes `counterparties.clients` / `.suppliers` intentionally unchanged — they gate access). The one
stale user-facing string (`SourcingCard`: "add one in Counterparties → Suppliers") is now "CRM → Suppliers".

## 6. Recommendation — separate internal orgs from trading partners

The Orgs & People list is long and mixes internal/house orgs with trading partners. The new **"Appears in"**
column (Clients / Suppliers / Internal) is a first step. A future enhancement (report-only): a role/active
filter + search on the list, and optionally a visual grouping of "Internal" orgs, so the house entities don't
get lost among counterparties.
