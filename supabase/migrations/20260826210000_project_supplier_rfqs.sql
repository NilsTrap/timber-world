-- Private, project-scoped supplier sourcing. Candidates are not committed deal parties.

CREATE TABLE public.project_rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','awarded','cancelled')),
  awarded_candidate_id UUID,
  created_by UUID REFERENCES public.portal_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_rfq_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  rfq_id UUID NOT NULL REFERENCES public.project_rfqs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','submitted','awarded','not_awarded')),
  quote_total_cents BIGINT CHECK (quote_total_cents >= 0),
  quote_notes TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, organization_id)
);

ALTER TABLE public.project_rfqs
  ADD CONSTRAINT project_rfqs_awarded_candidate_fk
  FOREIGN KEY (awarded_candidate_id) REFERENCES public.project_rfq_candidates(id) ON DELETE RESTRICT;

CREATE INDEX project_rfqs_order_idx ON public.project_rfqs(order_id, created_at DESC);
CREATE UNIQUE INDEX project_rfqs_one_open_idx ON public.project_rfqs(order_id) WHERE status='open';
CREATE INDEX project_rfq_candidates_org_idx ON public.project_rfq_candidates(organization_id, rfq_id);

CREATE TRIGGER project_rfqs_updated_at BEFORE UPDATE ON public.project_rfqs
FOR EACH ROW EXECUTE FUNCTION public.deals_set_updated_at();
CREATE TRIGGER project_rfq_candidates_updated_at BEFORE UPDATE ON public.project_rfq_candidates
FOR EACH ROW EXECUTE FUNCTION public.deals_set_updated_at();

ALTER TABLE public.project_rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_rfq_candidates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_project_rfq_candidate(p_rfq UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.project_rfq_candidates c WHERE c.rfq_id=p_rfq AND public.current_user_in_org(c.organization_id))
$$;
CREATE OR REPLACE FUNCTION public.can_manage_project_rfq(p_rfq UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_current_user_platform_admin() OR EXISTS(SELECT 1 FROM public.project_rfqs r WHERE r.id=p_rfq AND public.current_user_in_org(r.organization_id))
$$;

CREATE POLICY project_rfqs_select ON public.project_rfqs FOR SELECT TO authenticated USING (
  public.is_current_user_platform_admin()
  OR public.current_user_in_org(organization_id)
  OR public.is_project_rfq_candidate(id)
);
CREATE POLICY project_rfq_candidates_select ON public.project_rfq_candidates FOR SELECT TO authenticated USING (
  public.is_current_user_platform_admin()
  OR public.current_user_in_org(organization_id)
  OR public.can_manage_project_rfq(rfq_id)
);

-- Candidates never receive SELECT on orders/order_line_items: RLS cannot hide
-- commercial columns. Restricted functions below expose only safe snapshots.
CREATE POLICY order_files_rfq_candidate_select ON public.order_files FOR SELECT TO authenticated USING (
  category='project' AND lifecycle_status='ready' AND cleanup_status='approved' AND shared_at IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.rfq_id=r.id
              WHERE r.order_id=order_files.order_id AND r.status='open' AND r.deadline>now()
                AND public.current_user_in_org(c.organization_id))
);
CREATE POLICY order_storage_rfq_candidate_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='orders' AND EXISTS (
    SELECT 1 FROM public.order_files f
    JOIN public.project_rfqs r ON r.order_id=f.order_id
    JOIN public.project_rfq_candidates c ON c.rfq_id=r.id
    WHERE f.storage_path=storage.objects.name AND f.category='project' AND f.lifecycle_status='ready'
      AND f.cleanup_status='approved' AND f.shared_at IS NOT NULL AND r.status='open' AND r.deadline>now()
      AND public.current_user_in_org(c.organization_id)
  )
);

CREATE OR REPLACE FUNCTION public.current_user_can_create_deal_in_org(p_org UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_current_user_platform_admin() OR EXISTS (
    SELECT 1 FROM public.user_access_groups uag
    JOIN public.access_group_rights agr ON agr.group_id=uag.group_id
    WHERE uag.user_id=public.current_portal_user_id() AND uag.organization_id=p_org
      AND agr.right_type='action' AND agr.resource='deal' AND agr.key='create'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_project_rfq_candidate_snapshot(p_order_id UUID)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'id',o.id,'reference',coalesce(o.deal_code,o.code),'name',o.name,
    'stage',o.lifecycle_stage,'deliveryDeadline',o.delivery_deadline,'currency',o.currency,
    'lines',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',l.id,'lineNo',l.line_no,'productName',l.product_name,'woodSpecies',l.wood_species,
      'humidity',l.humidity,'processing',l.processing,'quality',l.quality,
      'thickness',l.thickness,'width',l.width,'length',l.length,'pieces',l.pieces,
      'volumeM3',l.volume_m3,'unit',l.unit,'notes',l.notes
    ) ORDER BY l.line_no) FROM public.order_line_items l WHERE l.order_id=o.id AND l.side='sell'),'[]'::jsonb)
  )
  FROM public.orders o
  WHERE o.id=p_order_id AND EXISTS (
    SELECT 1 FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.rfq_id=r.id
    WHERE r.order_id=o.id AND r.status='open' AND r.deadline>now()
      AND public.current_user_in_org(c.organization_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.list_project_rfq_invitations()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'reference',coalesce(o.deal_code,o.code),'name',o.name,
    'stage',o.lifecycle_stage,'deliveryDeadline',o.delivery_deadline
  ) ORDER BY r.created_at DESC),'[]'::jsonb)
  FROM public.project_rfqs r
  JOIN public.project_rfq_candidates c ON c.rfq_id=r.id
  JOIN public.orders o ON o.id=r.order_id
  WHERE r.status='open' AND r.deadline>now() AND public.current_user_in_org(c.organization_id)
$$;

CREATE OR REPLACE FUNCTION public.create_project_rfq(p_order_id UUID, p_candidate_ids UUID[], p_deadline TIMESTAMPTZ)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID; v_rfq UUID; v_candidate UUID;
BEGIN
  SELECT seller_organisation_id INTO v_owner FROM public.orders
  WHERE id = p_order_id AND lifecycle_stage = 'draft' FOR UPDATE;
  IF v_owner IS NULL OR NOT public.current_user_can_create_deal_in_org(v_owner) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF p_deadline <= now() THEN RAISE EXCEPTION 'deadline must be in the future'; END IF;
  IF coalesce(array_length(p_candidate_ids, 1), 0) < 2 OR array_length(p_candidate_ids, 1) <> (SELECT count(DISTINCT x) FROM unnest(p_candidate_ids) x) THEN RAISE EXCEPTION 'at least two unique candidates required'; END IF;
  IF v_owner = ANY(p_candidate_ids) THEN RAISE EXCEPTION 'self invitation is not allowed'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_candidate_ids) x LEFT JOIN public.organisations o ON o.id=x WHERE o.id IS NULL OR NOT o.is_active OR NOT (o.is_supplier OR o.is_producer OR o.is_trader)) THEN RAISE EXCEPTION 'ineligible candidate'; END IF;
  IF EXISTS (SELECT 1 FROM public.project_rfqs WHERE order_id=p_order_id AND status='open') THEN RAISE EXCEPTION 'open rfq already exists'; END IF;
  INSERT INTO public.project_rfqs(organization_id,order_id,deadline,created_by) VALUES(v_owner,p_order_id,p_deadline,public.current_portal_user_id()) RETURNING id INTO v_rfq;
  FOREACH v_candidate IN ARRAY p_candidate_ids LOOP INSERT INTO public.project_rfq_candidates(organization_id,rfq_id) VALUES(v_candidate,v_rfq); END LOOP;
  RETURN v_rfq;
END $$;

CREATE OR REPLACE FUNCTION public.submit_project_rfq_quote(p_candidate_id UUID, p_total_cents BIGINT, p_notes TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_total_cents < 0 OR p_total_cents > 2147483647 THEN RAISE EXCEPTION 'invalid quote total'; END IF;
  UPDATE public.project_rfq_candidates c SET quote_total_cents=p_total_cents, quote_notes=nullif(trim(p_notes),''), status='submitted', submitted_at=now()
  FROM public.project_rfqs r WHERE c.id=p_candidate_id AND r.id=c.rfq_id AND r.status='open' AND r.deadline>now()
    AND public.current_user_in_org(c.organization_id) AND c.status IN ('invited','submitted');
  IF NOT FOUND THEN RAISE EXCEPTION 'quotation is not open'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.award_project_rfq(p_rfq_id UUID, p_candidate_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.project_rfqs%ROWTYPE; c public.project_rfq_candidates%ROWTYPE; o public.orders%ROWTYPE; v_leg UUID := gen_random_uuid();
BEGIN
  SELECT * INTO r FROM public.project_rfqs WHERE id=p_rfq_id FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'open' OR NOT public.current_user_can_create_deal_in_org(r.organization_id) THEN RAISE EXCEPTION 'rfq cannot be awarded'; END IF;
  SELECT * INTO c FROM public.project_rfq_candidates WHERE id=p_candidate_id AND rfq_id=p_rfq_id AND status='submitted' FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'submitted candidate required'; END IF;
  SELECT * INTO o FROM public.orders WHERE id=r.order_id AND lifecycle_stage='draft' FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'draft project required'; END IF;
  IF o.upstream_deal_id IS NOT NULL THEN RAISE EXCEPTION 'committed seller already exists'; END IF;
  INSERT INTO public.orders(id,code,name,organisation_id,customer_organisation_id,seller_organisation_id,buyer_organisation_id,deal_kind,product_group,currency,value_cents,status,lifecycle_stage,deal_code,spine_id,upstream_deal_id,notes,created_by)
  VALUES(v_leg,'RFQ-'||upper(substr(replace(v_leg::text,'-',''),1,10)),coalesce(o.name,'Project')||' - purchase',r.organization_id,r.organization_id,c.organization_id,r.organization_id,'purchase_only',o.product_group,o.currency,c.quote_total_cents,'draft','draft',NULL,o.spine_id,NULL,'Awarded RFQ total: '||c.quote_total_cents||' cents',public.current_portal_user_id());
  INSERT INTO public.order_line_items(order_id,side,line_no,product_name,wood_species,humidity,processing,quality,product_type,grade_note,product_name_option_id,wood_species_option_id,humidity_option_id,processing_option_id,quality_option_id,product_type_option_id,thickness,width,length,pieces,volume_m3,unit,unit_price_cents,line_total_cents,notes,catalog_product_id,catalog_variant_id,is_standard)
  SELECT v_leg,'sell',line_no,product_name,wood_species,humidity,processing,quality,product_type,grade_note,product_name_option_id,wood_species_option_id,humidity_option_id,processing_option_id,quality_option_id,product_type_option_id,thickness,width,length,pieces,volume_m3,unit,NULL,NULL,notes,catalog_product_id,catalog_variant_id,is_standard FROM public.order_line_items WHERE order_id=o.id AND side='sell';
  UPDATE public.project_rfq_candidates SET status=CASE WHEN id=c.id THEN 'awarded' ELSE 'not_awarded' END WHERE rfq_id=r.id;
  UPDATE public.project_rfqs SET status='awarded',awarded_candidate_id=c.id WHERE id=r.id;
  UPDATE public.orders SET upstream_deal_id=v_leg WHERE id=o.id;
  RETURN v_leg;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_project_rfq(p_rfq_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.project_rfqs%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.project_rfqs WHERE id=p_rfq_id FOR UPDATE;
  IF r.id IS NULL OR r.status<>'open' OR NOT public.current_user_can_create_deal_in_org(r.organization_id) THEN RAISE EXCEPTION 'rfq cannot be cancelled'; END IF;
  UPDATE public.project_rfqs SET status='cancelled' WHERE id=r.id;
  UPDATE public.project_rfq_candidates SET status='not_awarded' WHERE rfq_id=r.id;
END $$;

REVOKE ALL ON FUNCTION public.get_project_rfq_candidate_snapshot(UUID), public.list_project_rfq_invitations(), public.create_project_rfq(UUID,UUID[],TIMESTAMPTZ), public.submit_project_rfq_quote(UUID,BIGINT,TEXT), public.award_project_rfq(UUID,UUID), public.cancel_project_rfq(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_rfq_candidate_snapshot(UUID), public.list_project_rfq_invitations(), public.create_project_rfq(UUID,UUID[],TIMESTAMPTZ), public.submit_project_rfq_quote(UUID,BIGINT,TEXT), public.award_project_rfq(UUID,UUID), public.cancel_project_rfq(UUID) TO authenticated;
