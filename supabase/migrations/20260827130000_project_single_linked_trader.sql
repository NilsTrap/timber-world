CREATE OR REPLACE FUNCTION public.project_single_linked_trader(p_buyer_organisation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trader_id uuid;
BEGIN
  IF NOT (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(p_buyer_organisation_id)
  ) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT CASE WHEN count(DISTINCT o.id) = 1 THEN min(o.id::text)::uuid ELSE NULL END
  INTO v_trader_id
  FROM public.organisation_trading_partners otp
  JOIN public.organisations o ON o.id = otp.partner_organisation_id
  WHERE otp.organisation_id = p_buyer_organisation_id
    AND o.is_active = true
    AND o.is_trader = true;

  RETURN v_trader_id;
END;
$$;

REVOKE ALL ON FUNCTION public.project_single_linked_trader(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_single_linked_trader(uuid) TO authenticated;
