CREATE OR REPLACE FUNCTION public.update_project_spine_title(
  p_project_id UUID,
  p_title TEXT,
  p_expected_title TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_spine public.spines%ROWTYPE;
  v_title TEXT := btrim(p_title);
BEGIN
  IF v_title IS NULL OR v_title = '' OR char_length(v_title) > 160 THEN
    RAISE EXCEPTION 'INVALID_TITLE';
  END IF;

  SELECT s.* INTO v_spine
  FROM public.orders o
  JOIN public.spines s ON s.id = o.spine_id
  WHERE o.id = p_project_id
  FOR UPDATE OF s;

  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF NOT public.can_access_order(p_project_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF NOT (
    public.is_current_user_platform_admin()
    OR v_spine.created_by = public.current_portal_user_id()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF v_spine.title IS DISTINCT FROM p_expected_title THEN
    RAISE EXCEPTION 'STALE_TITLE';
  END IF;

  UPDATE public.spines SET title = v_title WHERE id = v_spine.id;
  RETURN v_spine.id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_project_spine_title(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_project_spine_title(UUID, TEXT, TEXT) TO authenticated;
