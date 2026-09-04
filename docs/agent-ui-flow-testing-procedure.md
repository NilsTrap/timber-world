# Nilitto agent UI-flow testing procedure

## Purpose

Before real customer onboarding, give testing agents a repeatable browser-based procedure that proves the important user journeys work. This is an acceptance system, not a low-level implementation test suite.

It covers what each role can see and do, the hand-offs between roles, e-mail notifications, and the privacy boundary between the original buyer and suppliers.

## Safety boundary

- Run only in an isolated staging test environment. Never point these flows at production.
- Use test-owned companies, people, projects, files and e-mail addresses only.
- Reset the complete fixture after every run. A failed cleanup makes the run inconclusive.
- Store no passwords, tokens, activation links, signed URLs or real customer files in reports or screenshots.
- Treat a public disposable inbox as unsafe: an invitation link grants account activation. Use a private Mailpit instance instead.

## Test environment

The test environment needs:

1. A resettable fixture for the companies, people, project and files below.
2. A Mailpit instance as the staging test-mail transport. It captures all test-role mail in one private place; separate real inboxes are not required.
3. An agent-accessible browser session for each role. Sessions must be separate so role switching cannot hide an access-control defect.
4. A run label, for example `UIFLOW-<date>-<sequence>`, included in every test-created company and project name.

The current invitation path sends through Resend. The test environment must add an explicit mail-transport switch that routes test mail to Mailpit while leaving the normal staging sender unchanged.

## Personas and fixture

| Persona | Test organisation | Purpose |
| --- | --- | --- |
| Super admin | Platform administration | Creates and repairs test fixtures; control scenario only. |
| Trader | Broker company | Receives the buyer request, builds the specification, creates RFPs, selects suppliers and prices the buyer offer. |
| Buyer | Buyer company | Creates the project, receives the commercial offer and accepts it. |
| Supplier — metal | Metal manufacturer | Bids for and fulfils the metal line items. |
| Supplier — wood | Wood manufacturer | Bids for and fulfils the wood line items. |

Use a sample project such as `Metal staircase with wooden treads`. It contains at least one metal and one wood specification line. Upload only harmless test drawings and preview files.

## Agent run protocol

Each scenario card has four fields:

- **Starting state:** fixture and login state required before the card starts.
- **User actions:** visible browser actions only.
- **Expected result:** the acceptance decision.
- **Evidence:** a short screenshot or browser-visible confirmation, plus the run label. Never retain secrets or private links.

The agent reports each card as `pass`, `fail`, or `blocked`.

- `pass` means every expected result and required privacy check holds.
- `fail` means observed behaviour contradicts an expected result. File one independently repairable defect with the scenario, role, visible result, expected result and safe evidence.
- `blocked` means missing fixture, environment, permission or unimplemented product capability. It is not a pass.

## Mandatory scenario cards

### 1. Organisation and invitation onboarding

**Starting state:** only the super admin session exists.

1. Create the buyer, trader and two supplier test organisations.
2. Create the named user for each organisation and send its invitation.
3. In Mailpit, verify that the invitation reaches the intended test recipient and identifies the intended organisation and role.
4. Open each activation flow in that role's isolated browser session and complete sign-in.

**Expected result:** every invited user can activate only its own account and enters the expected organisation and role. A user cannot see another organisation's records on first login.

### 2. Buyer creates a project

**Starting state:** buyer session is active.

1. Create the labelled staircase project.
2. Add a clear name and upload the harmless engineering/preview files.
3. Reopen the project and its files.

**Expected result:** the buyer sees the new project and its uploaded files; the trader receives the intended new-work notification. The project is not visible to either supplier.

### 3. Trader prepares the sourcing package

**Starting state:** trader session is active and can access the buyer project.

1. Build the minimum specification: material lines, quantities and required manufacturing processes.
2. Add visual reference images where needed for unambiguous identification.
3. Run the file-cleaning flow, inspect the proposed clean output, and explicitly approve it for sharing.

**Expected result:** the package is sufficiently described for suppliers, while the original buyer identity, contact details and uncleaned files remain unavailable outside the buyer–trader leg.

### 4. Split RFP across suppliers

**Starting state:** the approved clean sourcing package is available.

1. Create an RFP for the metal lines and quantities; invite the metal supplier.
2. Create a separate RFP for the wood lines and quantities; invite the wood supplier.
3. Open each supplier session.

**Expected result:** each supplier sees only its allocated lines, quantities, clean files and permitted specification information. Neither supplier can discover the buyer identity, the other supplier, unallocated lines, an uncleaned file, or any other leg's commercial data.

### 5. Supplier quotations

**Starting state:** both supplier RFPs are open.

1. Metal supplier submits a single-total quotation.
2. Wood supplier submits a detailed quotation, split by material and process.
3. Confirm that the trader receives a notification for each submitted quotation.

**Expected result:** both quotation forms are accepted and remain distinguishable. Where a detailed quotation is used, displayed line totals equal the quotation total.

### 6. Trader selection and buyer offer

**Starting state:** the trader has received both quotations.

1. Select the metal and wood supplier quotations as the sourcing candidates.
2. Build one buyer-facing offer from them.
3. Apply a margin once as a percentage and, on a reset run, once as an absolute amount.
4. Present the buyer offer once as a single total and, on a reset run, as a detailed breakdown.
5. Send the buyer offer.

**Expected result:** the buyer receives the intended current offer, including the chosen presentation. Supplier selection remains internal: no supplier receives an award or production instruction yet.

### 7. Buyer negotiation and acceptance

**Starting state:** the buyer has an open offer.

1. Simulate a price discussion outside the platform.
2. Trader changes the current offer and resends it.
3. Buyer opens and accepts the current offer.

**Expected result:** only the current offer is required in this release. The buyer sees the corrected value. Until buyer acceptance, suppliers receive no award notification. After acceptance, the selected suppliers receive their award/next-action notification.

### 8. Supplier confirmation and fulfilment

**Starting state:** buyer acceptance has released the selected supplier legs.

1. Each selected supplier confirms that it accepts the work.
2. Each supplier marks its part ready for dispatch, then dispatched.
3. Trader and buyer inspect the resulting status.

**Expected result:** status changes follow the configured workflow and remain leg-specific. One supplier's progress must not incorrectly advance the other supplier's leg or the whole project.

### 9. Permission and privacy negative checks

Run these checks throughout cards 2–8, from every restricted role:

- Paste or navigate to a known unrelated organisation, project, supplier leg and file.
- Attempt an action outside the role: project creation, specification editing, RFP creation, supplier selection, pricing, invitation, upload, rename and delete where relevant.
- Inspect the rendered page and browser-visible error only.

**Expected result:** hidden resources appear unavailable without revealing their existence, name, price, margin, buyer identity, supplier identity, storage path or other protected data. The supplier-facing views never expose the original buyer's identity or uncleaned files.

### 10. Super-admin control check

**Starting state:** super admin session is active.

1. Open both legs and the parent project without logging out.
2. Confirm it can perform the intended administrative repairs: organisation/user management, partner correction, offer editing and supplier selection.
3. Do not use super admin to make a restricted-role scenario pass.

**Expected result:** super admin is a control and recovery role. The real release gate remains the buyer, trader and supplier experience.

## Release decision

The test run is ready for real-user onboarding only when:

- Cards 1–9 pass for the defined fixture.
- No privacy or access-control failure is open.
- Mailpit proves all required notifications reached the intended role.
- The run was reset successfully and can be repeated.

Deferred for a later release: cancellation/withdrawal flows, in-platform negotiation, offer-version history, and organisation-user self-service management.

## Implementation backlog for the test system

1. Add a non-production mail transport switch and private Mailpit service.
2. Create a resettable five-person fixture and harmless project-file pack.
3. Provide one agent-readable scenario manifest with the cards above and safe evidence rules.
4. Add browser automation that performs one role card per isolated session.
5. Record a compact pass/fail/blocked run report and create one repair task per independently fixable failure.

This procedure complements the existing `docs/timber-mvp-role-matrix-staging-checklist.md`: that checklist is a focused access gate; this document is the end-to-end commercial user-flow gate.
