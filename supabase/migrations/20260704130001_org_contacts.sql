-- 20260704130001_org_contacts.sql
--
-- K1 (CRM contacts) · Named people attached to a counterparty organisation.
-- A "counterparty"/CRM record IS a row in public.organisations; org_contacts
-- adds the people (name, role, email, phone, notes) working at that org, with
-- an optional single "primary" contact used as the default point of contact
-- and pickable as a document signee (writes organisations.default_signee_*).
--
-- Access model (mirrors E4 counterparties):
--   * SELECT — RLS: platform admin, own-org members, or a user who shares a
--     supply-chain context with the org (same arms as organisations_select).
--   * WRITE  — the CRM action layer (features/counterparties/actions/orgContacts)
--     gates per address book (clients/suppliers/traders) and then writes through
--     the service-role admin client, which bypasses RLS BY DESIGN (identical to
--     how counterparties.ts writes organisations). The admin-only write policy
--     below only governs any direct (non-service-role) authenticated writes.
--
-- Single-primary invariant: enforced by a BEFORE INSERT/UPDATE trigger that
-- runs as table owner (immune to RLS visibility / service-role races) and
-- forces is_primary := false when the org already has a primary (first-wins).
-- The app clears the existing primary before promoting a new one, so an
-- explicit "make primary" still wins; the trigger is the safety net.
-- (Same pattern as 20260703090000_single_primary_catalog_image.sql — a partial
-- unique index is deliberately NOT used, as it hard-errors on the 2nd primary.)
-- Additive & idempotent.

-- ── Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  role_title       TEXT,
  email            TEXT,
  phone            TEXT,
  notes            TEXT,
  is_primary       BOOLEAN NOT NULL DEFAULT false,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_contacts_organisation
  ON public.org_contacts(organisation_id);

-- Partial index over the (at most one) primary per org — supports the
-- primary-first ordering and the "does a primary already exist" trigger probe.
CREATE INDEX IF NOT EXISTS idx_org_contacts_primary
  ON public.org_contacts(organisation_id) WHERE is_primary;

COMMENT ON TABLE public.org_contacts IS
  'K1 · People attached to a counterparty organisation (CRM contacts). At most one is_primary per organisation, enforced by trg_single_primary_org_contact (first-wins). SELECT via RLS (admin / own-org / shared-context); non-admin writes go through the CRM action layer with the service-role client.';

-- ── Single-primary trigger (first-wins, runs as owner) ──────────────────────
CREATE OR REPLACE FUNCTION public.enforce_single_primary_org_contact()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_primary AND EXISTS (
    SELECT 1 FROM public.org_contacts
    WHERE organisation_id = NEW.organisation_id AND is_primary AND id <> NEW.id
  ) THEN
    NEW.is_primary := false;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_single_primary_org_contact ON public.org_contacts;
CREATE TRIGGER trg_single_primary_org_contact
  BEFORE INSERT OR UPDATE OF is_primary ON public.org_contacts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_primary_org_contact();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.org_contacts ENABLE ROW LEVEL SECURITY;

-- SELECT: mirror organisations_select, keyed on organisation_id.
DROP POLICY IF EXISTS org_contacts_select ON public.org_contacts;
CREATE POLICY org_contacts_select ON public.org_contacts
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
    OR public.current_user_shares_context_with_org(organisation_id)
  );

-- WRITE: platform admin only via RLS. Non-admin CRM users write through the
-- service-role client in the action layer (which bypasses RLS after the
-- per-book right check) — the same deliberate pattern as counterparties.ts.
DROP POLICY IF EXISTS org_contacts_admin_write ON public.org_contacts;
CREATE POLICY org_contacts_admin_write ON public.org_contacts
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- New table → tell PostgREST to re-introspect the schema.
NOTIFY pgrst, 'reload schema';
