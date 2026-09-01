-- Reversible project/leg removal. No related business row or Storage object is deleted.
ALTER TABLE public.spines ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.portal_users(id), ADD COLUMN IF NOT EXISTS deletion_batch_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.portal_users(id), ADD COLUMN IF NOT EXISTS deletion_batch_id UUID;
CREATE INDEX IF NOT EXISTS idx_spines_active ON public.spines(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spines_deleted ON public.spines(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_active_spine ON public.orders(spine_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_deletion_batch ON public.orders(deletion_batch_id) WHERE deletion_batch_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_project_tombstone() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.spine_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.spines WHERE id=NEW.spine_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'PROJECT_SOFT_DELETED'; END IF;
   RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN
   IF TG_TABLE_NAME='spines' OR OLD.spine_id IS NOT NULL OR OLD.deleted_at IS NOT NULL THEN
     RAISE EXCEPTION 'PHYSICAL_PROJECT_DELETE_FORBIDDEN';
   END IF;
   RETURN OLD;
 END IF;
 IF (NEW.deleted_at,NEW.deleted_by,NEW.deletion_batch_id) IS DISTINCT FROM (OLD.deleted_at,OLD.deleted_by,OLD.deletion_batch_id)
    AND NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF OLD.deleted_at IS NOT NULL THEN
   IF NEW.deleted_at IS NULL AND public.is_current_user_platform_admin()
      AND (to_jsonb(NEW)-ARRAY['deleted_at','deleted_by','deletion_batch_id','updated_at'])=(to_jsonb(OLD)-ARRAY['deleted_at','deleted_by','deletion_batch_id','updated_at'])
   THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'PROJECT_SOFT_DELETED';
 END IF;
 IF TG_TABLE_NAME='orders' THEN
   IF NEW.spine_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.spines WHERE id=NEW.spine_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'PROJECT_SOFT_DELETED'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_soft_deleted_order_mutation ON public.orders;
CREATE TRIGGER trg_guard_soft_deleted_order_mutation BEFORE INSERT OR UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_project_tombstone();
DROP TRIGGER IF EXISTS trg_guard_soft_deleted_spine_mutation ON public.spines;
CREATE TRIGGER trg_guard_soft_deleted_spine_mutation BEFORE UPDATE OR DELETE ON public.spines FOR EACH ROW EXECUTE FUNCTION public.guard_project_tombstone();

CREATE OR REPLACE FUNCTION public.guard_project_rfq_active_order() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_order_id UUID;
BEGIN
 IF TG_TABLE_NAME='project_rfqs' THEN v_order_id:=NEW.order_id;
 ELSE SELECT order_id INTO v_order_id FROM public.project_rfqs WHERE id=NEW.rfq_id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id=v_order_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'PROJECT_SOFT_DELETED'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_project_rfqs_active_order ON public.project_rfqs;
CREATE TRIGGER trg_project_rfqs_active_order BEFORE INSERT OR UPDATE ON public.project_rfqs FOR EACH ROW EXECUTE FUNCTION public.guard_project_rfq_active_order();
DROP TRIGGER IF EXISTS trg_project_rfq_candidates_active_order ON public.project_rfq_candidates;
CREATE TRIGGER trg_project_rfq_candidates_active_order BEFORE INSERT OR UPDATE ON public.project_rfq_candidates FOR EACH ROW EXECUTE FUNCTION public.guard_project_rfq_active_order();

-- Keep supplier invitation/search surfaces from serializing tombstoned projects.
CREATE OR REPLACE FUNCTION public.list_project_rfq_invitations() RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'reference',coalesce(o.deal_code,o.code),'name',o.name,'stage',o.lifecycle_stage,'deliveryDeadline',o.delivery_deadline) ORDER BY r.created_at DESC),'[]'::jsonb)
 FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.rfq_id=r.id JOIN public.orders o ON o.id=r.order_id
 WHERE o.deleted_at IS NULL AND r.status='open' AND r.deadline>now() AND public.current_user_in_org(c.organization_id)
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_project(p_spine_id UUID) RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_batch UUID:=gen_random_uuid(); v_actor UUID:=public.current_portal_user_id();
BEGIN
 IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_spine_id::TEXT,0));
 PERFORM 1 FROM public.spines WHERE id=p_spine_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND_OR_DELETED'; END IF;
 UPDATE public.orders SET deleted_at=now(),deleted_by=v_actor,deletion_batch_id=v_batch WHERE spine_id=p_spine_id AND deleted_at IS NULL;
 UPDATE public.spines SET deleted_at=now(),deleted_by=v_actor,deletion_batch_id=v_batch WHERE id=p_spine_id;
 RETURN v_batch;
END $$;

CREATE OR REPLACE FUNCTION public.soft_delete_project_leg(p_order_id UUID) RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_order public.orders%ROWTYPE; v_origin UUID; v_batch UUID:=gen_random_uuid(); v_actor UUID:=public.current_portal_user_id();
BEGIN
 IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND deleted_at IS NULL;
 IF NOT FOUND OR v_order.spine_id IS NULL THEN RAISE EXCEPTION 'LEG_NOT_FOUND_OR_DELETED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_order.spine_id::TEXT,0));
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LEG_NOT_FOUND_OR_DELETED'; END IF;
 SELECT origin_order_id INTO v_origin FROM public.spines WHERE id=v_order.spine_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND_OR_DELETED'; END IF;
 IF v_origin IS NULL OR v_origin=p_order_id THEN RAISE EXCEPTION 'ORIGIN_LEG_REQUIRES_PROJECT_DELETE'; END IF;
 UPDATE public.orders SET deleted_at=now(),deleted_by=v_actor,deletion_batch_id=v_batch WHERE id=p_order_id;
 RETURN v_batch;
END $$;

CREATE OR REPLACE FUNCTION public.restore_soft_deleted_project_leg(p_order_id UUID) RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_order public.orders%ROWTYPE; v_batch UUID;
BEGIN
 IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND deleted_at IS NOT NULL;
 IF NOT FOUND OR v_order.spine_id IS NULL THEN RAISE EXCEPTION 'LEG_NOT_FOUND_OR_ACTIVE'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_order.spine_id::TEXT,0));
 SELECT deletion_batch_id INTO v_batch FROM public.orders WHERE id=p_order_id AND deleted_at IS NOT NULL FOR UPDATE;
 IF NOT FOUND OR v_batch IS NULL THEN RAISE EXCEPTION 'LEG_NOT_FOUND_OR_ACTIVE'; END IF;
 IF EXISTS(SELECT 1 FROM public.spines WHERE id=v_order.spine_id AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'RESTORE_PROJECT_FIRST'; END IF;
 UPDATE public.orders SET deleted_at=NULL,deleted_by=NULL,deletion_batch_id=NULL WHERE id=p_order_id AND deletion_batch_id=v_batch;
 RETURN v_batch;
END $$;

CREATE OR REPLACE FUNCTION public.restore_soft_deleted_project(p_spine_id UUID) RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_batch UUID;
BEGIN
 IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_spine_id::TEXT,0));
 SELECT deletion_batch_id INTO v_batch FROM public.spines WHERE id=p_spine_id AND deleted_at IS NOT NULL FOR UPDATE;
 IF NOT FOUND OR v_batch IS NULL THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND_OR_ACTIVE'; END IF;
 IF EXISTS(SELECT 1 FROM public.orders WHERE spine_id=p_spine_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'RESTORE_CONFLICT'; END IF;
 UPDATE public.spines SET deleted_at=NULL,deleted_by=NULL,deletion_batch_id=NULL WHERE id=p_spine_id;
 UPDATE public.orders SET deleted_at=NULL,deleted_by=NULL,deletion_batch_id=NULL WHERE spine_id=p_spine_id AND deletion_batch_id=v_batch;
 RETURN v_batch;
END $$;

REVOKE ALL ON FUNCTION public.soft_delete_project(UUID), public.soft_delete_project_leg(UUID), public.restore_soft_deleted_project(UUID), public.restore_soft_deleted_project_leg(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_project(UUID), public.soft_delete_project_leg(UUID), public.restore_soft_deleted_project(UUID), public.restore_soft_deleted_project_leg(UUID) TO authenticated;
