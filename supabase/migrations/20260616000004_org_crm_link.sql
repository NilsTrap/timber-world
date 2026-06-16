-- E4.2 — link a Timber organisation to its Oscar CRM record + track sync time.
--
-- Topology (resolved 2026-06-16): Timber owns the operational org row (load-bearing
-- for logins/orders/RLS) plus a `crm_org_id` link and a thin synced cache (name +
-- the company-card columns, which already exist: legal_address, vat_number,
-- registration_number, country, bank_*). The rich CRM (contacts, pipeline,
-- activities, comms) lives only in Oscar, opened on demand. Records stay in sync
-- via the write-through CRM client (config-gated until the Oscar instance is live).
--
-- crm_org_id is TEXT (Oscar's org identifier) — nullable; an org may exist in
-- Timber before it's mirrored to the CRM. crm_synced_at is the last successful sync.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS crm_org_id    TEXT,
  ADD COLUMN IF NOT EXISTS crm_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_organisations_crm_org_id
  ON public.organisations (crm_org_id) WHERE crm_org_id IS NOT NULL;
