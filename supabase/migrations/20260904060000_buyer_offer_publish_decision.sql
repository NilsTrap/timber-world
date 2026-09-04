-- Explicit buyer-offer publication and buyer decision workflow.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commercial_published_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commercial_decided_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commercial_decided_by UUID REFERENCES public.portal_users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commercial_buyer_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commercial_offer_notes TEXT;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_commercial_rollup_state_check;
UPDATE public.orders SET commercial_rollup_state='accepted',
  commercial_published_at=coalesce(commercial_published_at,commercial_confirmed_at,updated_at),
  commercial_decided_at=coalesce(commercial_decided_at,commercial_confirmed_at,updated_at)
WHERE commercial_rollup_state='confirmed';
ALTER TABLE public.orders ADD CONSTRAINT orders_commercial_rollup_state_check
  CHECK (commercial_rollup_state IN ('draft','published','accepted','rejected','stale'));
ALTER TABLE public.orders ADD CONSTRAINT orders_commercial_buyer_notes_length
  CHECK (commercial_buyer_notes IS NULL OR char_length(commercial_buyer_notes)<=4000);
ALTER TABLE public.orders ADD CONSTRAINT orders_commercial_offer_notes_length
  CHECK (commercial_offer_notes IS NULL OR char_length(commercial_offer_notes)<=4000);

INSERT INTO public.project_stages(key,label,color,sort_order,is_active,available_to_buyer,available_to_trader,available_to_supplier)
VALUES
 ('preparing_buyer_offer','Preparing buyer offer','#D97706',41,true,false,true,false),
 ('awaiting_buyer_decision','Awaiting buyer decision','#F59E0B',42,true,true,true,false),
 ('offer_accepted','Offer accepted','#2563EB',43,true,true,true,false),
 ('offer_rejected','Offer rejected','#DC2626',44,true,true,true,false)
ON CONFLICT(key) DO UPDATE SET label=excluded.label,color=excluded.color,is_active=true,
 available_to_buyer=excluded.available_to_buyer,available_to_trader=excluded.available_to_trader,available_to_supplier=excluded.available_to_supplier;

-- Existing roll-up RPC writes "confirmed". Convert that internal save into a private draft.
CREATE OR REPLACE FUNCTION public.project_commercial_save_as_draft()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.commercial_rollup_state='confirmed' THEN
   NEW.commercial_rollup_state:='draft';
   NEW.commercial_published_at:=NULL;NEW.commercial_decided_at:=NULL;NEW.commercial_decided_by:=NULL;NEW.commercial_buyer_notes:=NULL;
   NEW.lifecycle_stage:='preparing_buyer_offer';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS project_commercial_save_as_draft ON public.orders;
CREATE TRIGGER project_commercial_save_as_draft BEFORE UPDATE OF commercial_rollup_state ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.project_commercial_save_as_draft();

-- Published offers may only be decided or made stale. Accepted commercial snapshots are immutable.
CREATE OR REPLACE FUNCTION public.project_commercial_lock_finalized_offer()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.commercial_rollup_state='published' AND NEW.commercial_rollup_state NOT IN('published','accepted','rejected','stale') THEN
   RAISE EXCEPTION 'OFFER_LOCKED';
 END IF;
 IF OLD.commercial_rollup_state='accepted' THEN
   IF NEW.commercial_rollup_state='stale' THEN
     NEW.commercial_rollup_state:='accepted';
     NEW.commercial_stale_at:=OLD.commercial_stale_at;
   ELSIF NEW.commercial_rollup_state<>'accepted'
     OR ROW(NEW.commercial_offer_scope,NEW.commercial_purchase_cost_cents,NEW.commercial_adjustment_cents,NEW.commercial_margin_mode,NEW.margin_amount_cents,NEW.margin_percent,NEW.resale_value_cents)
        IS DISTINCT FROM ROW(OLD.commercial_offer_scope,OLD.commercial_purchase_cost_cents,OLD.commercial_adjustment_cents,OLD.commercial_margin_mode,OLD.margin_amount_cents,OLD.margin_percent,OLD.resale_value_cents)
   THEN RAISE EXCEPTION 'OFFER_LOCKED'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS project_commercial_lock_finalized_offer ON public.orders;
CREATE TRIGGER project_commercial_lock_finalized_offer BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.project_commercial_lock_finalized_offer();

CREATE OR REPLACE FUNCTION public.publish_project_commercial_offer(p_order_id UUID,p_offer_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target public.orders%ROWTYPE; current_sources JSONB;
BEGIN
 IF char_length(coalesce(p_offer_notes,''))>4000 THEN RAISE EXCEPTION 'INVALID_NOTES'; END IF;
 SELECT * INTO target FROM public.orders WHERE id=p_order_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT public.project_commercial_owner(target) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF target.commercial_rollup_state<>'draft' OR target.resale_value_cents IS NULL OR target.commercial_stale_at IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM public.project_leg_commercial_sources WHERE target_order_id=target.id)
 THEN RAISE EXCEPTION 'OFFER_NOT_READY'; END IF;
 current_sources:=public.get_project_commercial_sources(target.id);
 IF EXISTS(
   SELECT 1 FROM public.project_leg_commercial_sources saved
   LEFT JOIN LATERAL (
     SELECT source FROM jsonb_array_elements(current_sources) source
     WHERE source->>'sourceOrderId'=saved.source_order_id::TEXT
   ) current ON true
   WHERE saved.target_order_id=target.id AND (
     current.source IS NULL OR (current.source->>'sourceVersion')::BIGINT<>saved.source_version
     OR (current.source->>'sourceUpdatedAt')::TIMESTAMPTZ<>saved.source_updated_at
   )
 ) THEN RAISE EXCEPTION 'OFFER_NOT_READY'; END IF;
 UPDATE public.orders SET commercial_rollup_state='published',commercial_published_at=now(),commercial_decided_at=NULL,
   commercial_decided_by=NULL,commercial_buyer_notes=NULL,commercial_offer_notes=nullif(trim(p_offer_notes),''),
   lifecycle_stage='awaiting_buyer_decision',updated_at=now() WHERE id=target.id;
END $$;
REVOKE ALL ON FUNCTION public.publish_project_commercial_offer(UUID,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_project_commercial_offer(UUID,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_project_commercial_offer(p_order_id UUID,p_decision TEXT,p_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target public.orders%ROWTYPE; actor_id UUID;
BEGIN
 IF p_decision IS NULL OR p_decision NOT IN('accepted','rejected') OR char_length(coalesce(p_notes,''))>4000 THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
 SELECT * INTO target FROM public.orders WHERE id=p_order_id AND deleted_at IS NULL FOR UPDATE;
 actor_id:=public.current_portal_user_id();
 IF NOT FOUND OR actor_id IS NULL OR target.buyer_organisation_id IS NULL OR NOT public.current_user_in_org(target.buyer_organisation_id)
 THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF target.commercial_rollup_state<>'published' THEN RAISE EXCEPTION 'OFFER_NOT_OPEN'; END IF;
 UPDATE public.orders SET commercial_rollup_state=p_decision,commercial_decided_at=now(),commercial_decided_by=actor_id,
   commercial_buyer_notes=nullif(trim(p_notes),''),lifecycle_stage=CASE WHEN p_decision='accepted' THEN 'offer_accepted' ELSE 'offer_rejected' END,updated_at=now()
 WHERE id=target.id;
 IF p_decision='accepted' THEN
   UPDATE public.orders SET lifecycle_stage='confirmed',updated_at=now()
   WHERE lifecycle_stage='awarded'
     AND id IN(SELECT DISTINCT source_order_id FROM public.project_leg_commercial_sources WHERE target_order_id=target.id);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.decide_project_commercial_offer(UUID,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decide_project_commercial_offer(UUID,TEXT,TEXT) TO authenticated;
