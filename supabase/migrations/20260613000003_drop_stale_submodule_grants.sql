-- Drop stale sub-module grants that are NOT in the modules registry.
--
-- The old per-action sub-modules (production.create/edit/validate/delete/
-- corrections, shipments.create/edit/delete/submit/accept/reject, inventory.*)
-- were removed from the registry by 20260404100008_remove_non_view_features.sql
-- ("DELETE FROM features WHERE code NOT LIKE '%.view'"), but the matching rows
-- in organization_modules / user_modules were never cleaned up. They linger as:
--   * invisible — the org/user module dialogs are built from the registry only,
--     so admins can neither see nor toggle them;
--   * unenforced — grep across apps/portal confirms ZERO code references; and
--   * a data-integrity hazard — the dialogs save via DELETE-all-then-INSERT of
--     only the registry codes they know about, so opening + saving any org/user
--     module dialog would silently and permanently wipe these rows, leaving the
--     DB in a non-reproducible state.
--
-- Delete every grant whose code is not a current registry module. Registry-driven
-- so it stays correct as the registry evolves. Safe: the codes are unread.

DELETE FROM public.user_modules
WHERE module_code NOT IN (SELECT code FROM public.modules);

DELETE FROM public.organization_modules
WHERE module_code NOT IN (SELECT code FROM public.modules);
