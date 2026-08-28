-- Configurable, platform-wide Project lifecycle stages.

CREATE TABLE IF NOT EXISTS public.project_stages (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  label TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  color TEXT NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  available_to_buyer BOOLEAN NOT NULL DEFAULT false,
  available_to_trader BOOLEAN NOT NULL DEFAULT false,
  available_to_supplier BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.project_stages
  (key, label, color, sort_order, is_active, available_to_buyer, available_to_trader, available_to_supplier)
VALUES
  ('draft',                  'Draft',                  '#64748B',  10, true,  true,  true,  false),
  ('specification',          'Specification',          '#0EA5E9',  20, true,  true,  true,  false),
  ('request_for_quotation',  'Request for quotation',  '#D97706',  30, true,  false, true,  true),
  ('quotation_review',       'Quotation review',       '#F59E0B',  40, true,  false, true,  true),
  ('awarded',                'Awarded',                '#7C3AED',  50, true,  false, true,  true),
  ('confirmed',              'Confirmed',              '#2563EB',  60, true,  true,  true,  true),
  ('in_production',          'In production',          '#0891B2',  70, true,  false, true,  true),
  ('produced',               'Produced',               '#0D9488',  75, false, false, true,  true),
  ('ready_for_dispatch',     'Ready for dispatch',     '#4F46E5',  80, true,  false, true,  true),
  ('loaded',                 'Loaded',                 '#4338CA',  85, false, true,  true,  true),
  ('in_transit',             'In transit',             '#4338CA',  90, true,  true,  true,  true),
  ('delivered',              'Delivered',              '#16A34A', 100, true,  true,  true,  true),
  ('cancelled',              'Cancelled',              '#991B1B', 110, true,  true,  true,  true)
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS project_stages_sort_order_idx
  ON public.project_stages(sort_order, key);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.project_stages'::regclass AND conname='project_stages_sort_order_key') THEN
    ALTER TABLE public.project_stages ADD CONSTRAINT project_stages_sort_order_key UNIQUE(sort_order) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

DROP TRIGGER IF EXISTS project_stages_updated_at ON public.project_stages;
CREATE TRIGGER project_stages_updated_at
  BEFORE UPDATE ON public.project_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.guard_project_stage_key()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.key IS DISTINCT FROM OLD.key THEN
    RAISE EXCEPTION 'PROJECT_STAGE_KEY_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_project_stage_key ON public.project_stages;
CREATE TRIGGER guard_project_stage_key
  BEFORE UPDATE OF key ON public.project_stages
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_stage_key();

ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_stages_read_authenticated ON public.project_stages;
CREATE POLICY project_stages_read_authenticated ON public.project_stages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS project_stages_admin_insert ON public.project_stages;
CREATE POLICY project_stages_admin_insert ON public.project_stages
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_platform_admin());

DROP POLICY IF EXISTS project_stages_admin_update ON public.project_stages;
CREATE POLICY project_stages_admin_update ON public.project_stages
  FOR UPDATE TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

DROP POLICY IF EXISTS project_stages_admin_delete ON public.project_stages;
CREATE POLICY project_stages_admin_delete ON public.project_stages
  FOR DELETE TO authenticated USING (public.is_current_user_platform_admin());

-- Replace the fixed six-value check with the registry FK. Scope constraint lookup
-- to orders so an identically named constraint elsewhere cannot be dropped.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_lifecycle_stage_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_lifecycle_stage_check;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_lifecycle_stage_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_lifecycle_stage_fkey
      FOREIGN KEY (lifecycle_stage) REFERENCES public.project_stages(key)
      ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_project_stage_selection()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stage public.project_stages%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.lifecycle_stage IS NOT DISTINCT FROM OLD.lifecycle_stage THEN RETURN NEW; END IF;
  SELECT * INTO v_stage FROM public.project_stages WHERE key = NEW.lifecycle_stage;
  IF NOT FOUND OR NOT v_stage.is_active THEN RAISE EXCEPTION 'PROJECT_STAGE_UNAVAILABLE'; END IF;
  IF auth.role() = 'service_role' OR public.is_current_user_platform_admin() THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organisations org
    WHERE public.current_user_in_org(org.id)
      AND org.id IN (NEW.buyer_organisation_id, NEW.seller_organisation_id, NEW.producer_organisation_id)
      AND (
        (v_stage.available_to_buyer AND org.is_customer)
        OR (v_stage.available_to_trader AND org.is_trader)
        OR (v_stage.available_to_supplier AND (org.is_supplier OR org.is_manufacturer OR org.is_producer))
      )
  ) THEN
    RAISE EXCEPTION 'PROJECT_STAGE_FORBIDDEN';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_project_stage_selection ON public.orders;
CREATE TRIGGER guard_project_stage_selection
  BEFORE INSERT OR UPDATE OF lifecycle_stage ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_stage_selection();

REVOKE ALL ON FUNCTION public.guard_project_stage_selection() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_project_stage_key() FROM PUBLIC;

GRANT SELECT ON public.project_stages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.project_stages TO authenticated;

CREATE OR REPLACE FUNCTION public.reorder_project_stages(p_items JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item JSONB;
  v_count INTEGER;
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  LOCK TABLE public.project_stages IN SHARE ROW EXCLUSIVE MODE;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_STAGE_ORDER';
  END IF;
  SELECT count(DISTINCT item->>'key') INTO v_count FROM jsonb_array_elements(p_items) item;
  IF v_count <> jsonb_array_length(p_items) THEN RAISE EXCEPTION 'DUPLICATE_STAGE_KEY'; END IF;
  IF v_count <> (SELECT count(*) FROM public.project_stages) THEN RAISE EXCEPTION 'INCOMPLETE_STAGE_ORDER'; END IF;
  SELECT count(DISTINCT item->>'sortOrder') INTO v_count FROM jsonb_array_elements(p_items) item;
  IF v_count <> jsonb_array_length(p_items) THEN RAISE EXCEPTION 'DUPLICATE_STAGE_ORDER'; END IF;
  PERFORM 1 FROM public.project_stages ORDER BY key FOR UPDATE;
  FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) item LOOP
    IF (v_item->>'sortOrder') !~ '^\d+$' THEN RAISE EXCEPTION 'INVALID_STAGE_ORDER'; END IF;
    UPDATE public.project_stages SET sort_order = (v_item->>'sortOrder')::INTEGER
    WHERE key = v_item->>'key';
    IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_STAGE_NOT_FOUND'; END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.reorder_project_stages(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_project_stages(JSONB) TO authenticated;

-- The spine cache must follow configurable ordering rather than the retired
-- hard-coded five-stage CASE expression. Cancelled remains the off-ladder state.
CREATE OR REPLACE FUNCTION public.recompute_spine_rollup(p_spine_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_stage TEXT;
BEGIN
  IF p_spine_id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(
    (SELECT o.lifecycle_stage
       FROM public.orders o
       LEFT JOIN public.project_stages ps ON ps.key = o.lifecycle_stage
      WHERE o.spine_id = p_spine_id AND o.lifecycle_stage <> 'cancelled'
      ORDER BY COALESCE(ps.sort_order, 2147483647), o.created_at, o.id
      LIMIT 1),
    (CASE WHEN EXISTS (SELECT 1 FROM public.orders WHERE spine_id = p_spine_id)
          THEN 'cancelled' ELSE 'draft' END)
  ) INTO v_stage;
  UPDATE public.spines SET status = v_stage WHERE id = p_spine_id;
END;
$$;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM public.spines LOOP
    PERFORM public.recompute_spine_rollup(r.id);
  END LOOP;
END $$;
