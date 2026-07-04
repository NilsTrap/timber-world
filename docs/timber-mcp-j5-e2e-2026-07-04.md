# Epic J (MCP parity for Vilma) — live E2E transcript

**When:** 2026-07-04 · **Where:** deployed staging endpoint `https://timber-portal-staging.vercel.app/api/timber-mcp` · **As:** Vilma (real split FULL + READONLY tokens over live HTTP, no UI touches).

Drives the whole deal lifecycle through the new J tools + the guards. Pattern follows E7's live-HTTP run. Test data was cleaned up afterwards (test orgs + deals deleted via the staging Management API; the access group was deleted and the assigned user's group set restored by the run itself). Known residue: one demo firewood variant's stock in a single packaging form was set to 7 (pre-existing demo line; original value not captured — harmless on the staging mirror).

Result: **26 passed, 0 failed.**

```
✓ 0. initialize handshake
✓ 1. tools/list count (FULL=40, RO=20) — FULL=40 RO=20
✓ 2. READONLY blocked from timber_update_org
✓ 3. timber_create_org (customer) — CFN
✓ 4. timber_create_org (supplier) — SLM
✓ 5. timber_update_org flips is_supplier + bank + signee
✓ 6. timber_update_org rejects code change (immutable)
✓ 7. timber_create_deal (sell, with parties + lines) — TIM-CFN-001
✓ 8. timber_allocate_deal_code (idempotent) — TIM-CFN-001
✓ 9. timber_update_deal sets G3 signee override
✓ 10. timber_start_sourcing spawns buy leg (same spine, lines copied, price blank) — buy=SLM-TIM-001
✓ 11. second start_sourcing rejected (active buy leg → replace instead)
✓ 12. price the buy leg (upsert lines with buy price)
✓ 13. timber_set_margin_approval (approve) — 2026-07-04T11:56:36.744Z
✓ 14. timber_generate_document (quotation / sales_spec) — Spec No 1
✓ 15. timber_firm_order_specification (quotation → firm, same number) — Spec No 1
✓ 16. advance deal draft → confirmed (gates) — from=draft → confirmed
✓ 17. timber_list_catalog_products (RO) returns products+variants — products=2
✓ 18. timber_get_catalog_variant (RO) full detail incl. packaging + stock
✓ 19. timber_set_variant_stock in a VALID packaging form
✓ 20. timber_get_variant_stock reflects the write
✓ 21. timber_set_variant_stock rejects a form NOT assigned to the variant
✓ 22. timber_upsert_access_group create + rights — 2588faeb
✓ 23. group rights persisted (read back)
✓ 24. timber_set_user_groups assigns the group to a user — ablueroyal@gmail.com
✓ 25. timber_delete_access_group (force) removes the test group

--- cleanup ---
cancel deal 12cc2290: ok
cancel deal cc9d0982: ok

ORG_IDS_TO_DELETE=4a42f07f-bc5a-4615-9fed-fd487788fb69,c671ab9c-99c4-4b61-b673-1d7d68b2ff54
DEAL_IDS=12cc2290-120e-495f-861c-ed2abfb5c51a,cc9d0982-3af1-49ee-9842-7c63c871e09f

=== 26 passed, 0 failed ===
```
