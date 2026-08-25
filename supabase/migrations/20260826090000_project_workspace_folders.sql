-- Nilitto Projects: persist empty workspace folders and move folder trees.
-- Additive: order/deal rows and legacy order-file categories are unchanged.

CREATE OR REPLACE FUNCTION public.is_valid_project_workspace_path(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT length(p_path) BETWEEN 1 AND 1024
    AND p_path !~ '^/'
    AND p_path !~ '^[A-Za-z]:/'
    AND p_path !~ '(^|/)\.{1,2}(/|$)'
    AND p_path NOT LIKE '%//%'
    AND position(E'\\' in p_path) = 0
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(string_to_array(p_path, '/')) AS segment
      WHERE btrim(segment) = '' OR length(segment) > 255
    );
$$;

CREATE TABLE IF NOT EXISTS public.project_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  created_by UUID DEFAULT public.current_portal_user_id() REFERENCES public.portal_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_folders_order_path_exact_unique UNIQUE (order_id, relative_path),
  CONSTRAINT project_folders_relative_path_check CHECK (
    public.is_valid_project_workspace_path(relative_path)
  )
);

ALTER TABLE public.project_folders DROP CONSTRAINT IF EXISTS project_folders_relative_path_check;
ALTER TABLE public.project_folders ADD CONSTRAINT project_folders_relative_path_check
  CHECK (public.is_valid_project_workspace_path(relative_path));
ALTER TABLE public.project_folders ALTER COLUMN created_by
  SET DEFAULT public.current_portal_user_id();

CREATE UNIQUE INDEX IF NOT EXISTS project_folders_order_path_unique
  ON public.project_folders(order_id, lower(relative_path));

CREATE INDEX IF NOT EXISTS idx_project_folders_order_tree
  ON public.project_folders(order_id, relative_path);

CREATE TABLE IF NOT EXISTS public.project_storage_cleanup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  not_before TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_storage_cleanup_path_unique UNIQUE (order_id, storage_path)
);
CREATE INDEX IF NOT EXISTS idx_project_storage_cleanup_due
  ON public.project_storage_cleanup(order_id, not_before);
ALTER TABLE public.project_storage_cleanup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_storage_cleanup_select ON public.project_storage_cleanup;
CREATE POLICY project_storage_cleanup_select ON public.project_storage_cleanup
  FOR SELECT TO authenticated USING (public.can_write_project_files(order_id));
DROP POLICY IF EXISTS project_storage_cleanup_delete ON public.project_storage_cleanup;

-- Existing Project workspaces represented folders only through file paths.
-- Materialise every ancestor so those folders can immediately be renamed,
-- moved, deleted, or left empty after this migration.
WITH file_parts AS (
  SELECT order_id, uploaded_by, created_at, string_to_array(relative_path, '/') AS parts
  FROM public.order_files
  WHERE category = 'project' AND file_variant = 'original'
), ancestors AS (
  SELECT DISTINCT ON (order_id, lower(array_to_string(parts[1:depth], '/')))
    order_id,
    array_to_string(parts[1:depth], '/') AS relative_path,
    uploaded_by AS created_by,
    created_at
  FROM file_parts
  CROSS JOIN LATERAL generate_series(1, array_length(parts, 1) - 1) AS depth
  ORDER BY order_id, lower(array_to_string(parts[1:depth], '/')), created_at
)
INSERT INTO public.project_folders(order_id, relative_path, created_by, created_at)
SELECT order_id, relative_path, created_by, created_at FROM ancestors
ON CONFLICT DO NOTHING;

ALTER TABLE public.project_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_folders_select ON public.project_folders;
CREATE POLICY project_folders_select ON public.project_folders
  FOR SELECT TO authenticated
  USING (public.can_access_order(order_id));

DROP POLICY IF EXISTS project_folders_insert ON public.project_folders;
CREATE POLICY project_folders_insert ON public.project_folders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_order(order_id)
    AND public.can_write_project_files(order_id)
    AND created_by = public.current_portal_user_id()
  );

DROP POLICY IF EXISTS project_folders_update ON public.project_folders;
CREATE POLICY project_folders_update ON public.project_folders
  FOR UPDATE TO authenticated
  USING (
    public.can_access_order(order_id)
    AND public.can_write_project_files(order_id)
  )
  WITH CHECK (
    public.can_access_order(order_id)
    AND public.can_write_project_files(order_id)
  );

DROP POLICY IF EXISTS project_folders_delete ON public.project_folders;
CREATE POLICY project_folders_delete ON public.project_folders
  FOR DELETE TO authenticated
  USING (
    public.can_access_order(order_id)
    AND public.can_write_project_files(order_id)
  );

CREATE OR REPLACE FUNCTION public.move_project_workspace_folder(
  p_order_id UUID,
  p_from TEXT,
  p_to TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_folder_count INTEGER;
  v_file_count INTEGER;
  v_source_path TEXT;
  v_target_parent TEXT;
  v_target_name TEXT;
BEGIN
  IF NOT public.can_write_project_files(p_order_id) THEN
    RAISE EXCEPTION 'project unavailable' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_valid_project_workspace_path(p_from)
    OR NOT public.is_valid_project_workspace_path(p_to)
    OR lower(p_to) = lower(p_from)
    OR left(lower(p_to), char_length(p_from) + 1) = lower(p_from) || '/'
  THEN
    RAISE EXCEPTION 'invalid project folder path' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));

  SELECT relative_path INTO v_source_path
  FROM public.project_folders
  WHERE order_id = p_order_id AND lower(relative_path) = lower(p_from);
  IF v_source_path IS NULL THEN
    RAISE EXCEPTION 'folder unavailable' USING ERRCODE = 'P0002';
  END IF;
  p_from := v_source_path;

  v_target_name := regexp_replace(p_to, '^.*/', '');
  v_target_parent := CASE
    WHEN position('/' in p_to) > 0 THEN regexp_replace(p_to, '/[^/]+$', '')
    ELSE ''
  END;
  IF v_target_parent <> '' THEN
    SELECT relative_path INTO v_target_parent
    FROM public.project_folders
    WHERE order_id = p_order_id
      AND lower(relative_path) = lower(v_target_parent);
    IF v_target_parent IS NULL THEN
      RAISE EXCEPTION 'target folder unavailable' USING ERRCODE = 'P0002';
    END IF;
    p_to := v_target_parent || '/' || v_target_name;
  ELSE
    p_to := v_target_name;
  END IF;

  IF lower(p_to) = lower(p_from)
    OR left(lower(p_to), char_length(p_from) + 1) = lower(p_from) || '/'
  THEN
    RAISE EXCEPTION 'invalid project folder path' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.project_folders destination
    WHERE destination.order_id = p_order_id
      AND NOT (
        lower(destination.relative_path) = lower(p_from)
        OR left(lower(destination.relative_path), char_length(p_from) + 1) = lower(p_from) || '/'
      )
      AND EXISTS (
        SELECT 1
        FROM public.project_folders source
        WHERE source.order_id = p_order_id
          AND (
            lower(source.relative_path) = lower(p_from)
            OR left(lower(source.relative_path), char_length(p_from) + 1) = lower(p_from) || '/'
          )
          AND lower(destination.relative_path) = lower(
            p_to || substring(source.relative_path FROM char_length(p_from) + 1)
          )
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.order_files destination
    WHERE destination.order_id = p_order_id
      AND destination.category = 'project'
      AND destination.file_variant = 'original'
      AND EXISTS (
        SELECT 1
        FROM public.order_files source
        WHERE source.order_id = p_order_id
          AND source.category = 'project'
          AND source.file_variant = 'original'
          AND left(lower(source.relative_path), char_length(p_from) + 1) = lower(p_from) || '/'
          AND destination.id <> source.id
          AND lower(destination.relative_path) = lower(
            p_to || substring(source.relative_path FROM char_length(p_from) + 1)
          )
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.project_folders destination
    WHERE destination.order_id = p_order_id
      AND NOT (
        lower(destination.relative_path) = lower(p_from)
        OR left(lower(destination.relative_path), char_length(p_from) + 1) = lower(p_from) || '/'
      )
      AND EXISTS (
        SELECT 1
        FROM public.order_files source
        WHERE source.order_id = p_order_id
          AND source.category = 'project'
          AND source.file_variant = 'original'
          AND left(lower(source.relative_path), char_length(p_from) + 1) = lower(p_from) || '/'
          AND lower(destination.relative_path) = lower(
            p_to || substring(source.relative_path FROM char_length(p_from) + 1)
          )
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.order_files destination
    WHERE destination.order_id = p_order_id
      AND destination.category = 'project'
      AND destination.file_variant = 'original'
      AND NOT (left(lower(destination.relative_path), char_length(p_from) + 1) = lower(p_from) || '/')
      AND EXISTS (
        SELECT 1
        FROM public.project_folders source
        WHERE source.order_id = p_order_id
          AND (
            lower(source.relative_path) = lower(p_from)
            OR left(lower(source.relative_path), char_length(p_from) + 1) = lower(p_from) || '/'
          )
          AND lower(destination.relative_path) = lower(
            p_to || substring(source.relative_path FROM char_length(p_from) + 1)
          )
      )
  ) OR EXISTS (
    SELECT 1 FROM public.order_files
    WHERE order_id = p_order_id
      AND category = 'project'
      AND file_variant = 'original'
      AND lower(relative_path) = lower(p_to)
  ) THEN
    RAISE EXCEPTION 'workspace path already exists' USING ERRCODE = '23505';
  END IF;

  UPDATE public.project_folders
  SET relative_path = p_to || substring(relative_path FROM char_length(p_from) + 1)
  WHERE order_id = p_order_id
    AND (
      lower(relative_path) = lower(p_from)
      OR left(lower(relative_path), char_length(p_from) + 1) = lower(p_from) || '/'
    );
  GET DIAGNOSTICS v_folder_count = ROW_COUNT;

  UPDATE public.order_files
  SET relative_path = p_to || substring(relative_path FROM char_length(p_from) + 1)
  WHERE order_id = p_order_id
    AND category = 'project'
    AND file_variant = 'original'
    AND left(lower(relative_path), char_length(p_from) + 1) = lower(p_from) || '/';
  GET DIAGNOSTICS v_file_count = ROW_COUNT;

  RETURN v_folder_count + v_file_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_project_workspace_folder(UUID, TEXT, TEXT)
  TO authenticated, service_role;

-- The earlier path-derived rename RPC updates files only. Persisted folders
-- supersede it, so keep it unavailable rather than permit a split tree.
REVOKE ALL ON FUNCTION public.rename_project_workspace_folder(UUID, TEXT, TEXT)
  FROM PUBLIC, authenticated, anon;

-- Serialize the shared file/folder logical namespace and reject a file and a
-- folder occupying the same case-insensitive path, including concurrent calls.
CREATE OR REPLACE FUNCTION public.enforce_project_workspace_namespace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'project_folders' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.order_id::text, 0));
    IF EXISTS (
      SELECT 1 FROM public.order_files
      WHERE order_id = NEW.order_id
        AND category = 'project'
        AND file_variant = 'original'
        AND lower(relative_path) = lower(NEW.relative_path)
    ) THEN
      RAISE EXCEPTION 'workspace path already exists' USING ERRCODE = '23505';
    END IF;
ELSIF NEW.category = 'project' AND NEW.file_variant = 'original' THEN
    IF NOT public.is_valid_project_workspace_path(NEW.relative_path) THEN
      RAISE EXCEPTION 'invalid project file path' USING ERRCODE = '22023';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.order_id::text, 0));
    IF EXISTS (
      SELECT 1 FROM public.project_folders
      WHERE order_id = NEW.order_id
        AND lower(relative_path) = lower(NEW.relative_path)
    ) THEN
      RAISE EXCEPTION 'workspace path already exists' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_folders_namespace_guard ON public.project_folders;
CREATE TRIGGER project_folders_namespace_guard
  BEFORE INSERT OR UPDATE OF order_id, relative_path ON public.project_folders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_project_workspace_namespace();

DROP TRIGGER IF EXISTS project_files_namespace_guard ON public.order_files;
CREATE TRIGGER project_files_namespace_guard
  BEFORE INSERT OR UPDATE OF order_id, category, file_variant, relative_path ON public.order_files
  FOR EACH ROW EXECUTE FUNCTION public.enforce_project_workspace_namespace();

CREATE OR REPLACE FUNCTION public.preserve_project_folder_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'folder creator is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_folders_creator_guard ON public.project_folders;
CREATE TRIGGER project_folders_creator_guard
  BEFORE UPDATE OF created_by ON public.project_folders
  FOR EACH ROW EXECUTE FUNCTION public.preserve_project_folder_creator();

DROP FUNCTION IF EXISTS public.delete_project_workspace_folder(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.delete_project_workspace_folder(
  p_order_id UUID,
  p_path TEXT,
  p_expected_file_ids UUID[]
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder_count INTEGER;
  v_file_count INTEGER;
BEGIN
  IF NOT public.can_write_project_files(p_order_id) THEN
    RAISE EXCEPTION 'project unavailable' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_valid_project_workspace_path(p_path) THEN
    RAISE EXCEPTION 'invalid project folder path' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.order_files
    WHERE order_id = p_order_id
      AND category = 'project'
      AND file_variant = 'original'
      AND lifecycle_status = 'uploading'
      AND left(lower(relative_path), char_length(p_path) + 1) = lower(p_path) || '/'
  ) THEN
    RAISE EXCEPTION 'folder contains an active upload' USING ERRCODE = '40001';
  END IF;
  IF (
    SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::UUID[])
    FROM public.order_files
    WHERE order_id = p_order_id
      AND category = 'project'
      AND file_variant = 'original'
      AND left(lower(relative_path), char_length(p_path) + 1) = lower(p_path) || '/'
  ) IS DISTINCT FROM (
    SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::UUID[])
    FROM unnest(COALESCE(p_expected_file_ids, ARRAY[]::UUID[])) AS id
  ) THEN
    RAISE EXCEPTION 'folder contents changed; review and retry' USING ERRCODE = '40001';
  END IF;
  INSERT INTO public.project_storage_cleanup(order_id, storage_path)
  SELECT p_order_id, storage_path
  FROM public.order_files
  WHERE order_id = p_order_id
    AND category = 'project'
    AND file_variant = 'original'
    AND left(lower(relative_path), char_length(p_path) + 1) = lower(p_path) || '/'
  ON CONFLICT (order_id, storage_path) DO UPDATE SET not_before = LEAST(project_storage_cleanup.not_before, now());
  DELETE FROM public.order_files
  WHERE order_id = p_order_id
    AND category = 'project'
    AND file_variant = 'original'
    AND left(lower(relative_path), char_length(p_path) + 1) = lower(p_path) || '/';
  GET DIAGNOSTICS v_file_count = ROW_COUNT;
  DELETE FROM public.project_folders
  WHERE order_id = p_order_id
    AND (
      lower(relative_path) = lower(p_path)
      OR left(lower(relative_path), char_length(p_path) + 1) = lower(p_path) || '/'
    );
  GET DIAGNOSTICS v_folder_count = ROW_COUNT;
  IF v_folder_count = 0 THEN
    RAISE EXCEPTION 'folder unavailable' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_file_count + v_folder_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_project_workspace_folder(UUID, TEXT, UUID[])
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_project_workspace_folder(UUID, TEXT, UUID[])
  FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.delete_project_workspace_files(
  p_order_id UUID,
  p_file_ids UUID[]
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected INTEGER;
  v_deleted INTEGER;
BEGIN
  IF NOT public.can_write_project_files(p_order_id) THEN
    RAISE EXCEPTION 'project unavailable' USING ERRCODE = '42501';
  END IF;
  v_expected := cardinality(COALESCE(p_file_ids, ARRAY[]::UUID[]));
  IF v_expected = 0 OR v_expected > 200 THEN
    RAISE EXCEPTION 'invalid file selection' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  IF (SELECT count(*) FROM public.order_files
      WHERE order_id = p_order_id AND id = ANY(p_file_ids)
        AND category = 'project' AND file_variant = 'original' AND lifecycle_status = 'ready') <> v_expected
  THEN
    RAISE EXCEPTION 'files unavailable' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.project_storage_cleanup(order_id, storage_path)
  SELECT p_order_id, storage_path FROM public.order_files
  WHERE order_id = p_order_id AND id = ANY(p_file_ids)
  ON CONFLICT (order_id, storage_path) DO UPDATE SET not_before = LEAST(project_storage_cleanup.not_before, now());
  DELETE FROM public.order_files
  WHERE order_id = p_order_id AND id = ANY(p_file_ids)
    AND category = 'project' AND file_variant = 'original' AND lifecycle_status = 'ready';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_project_workspace_files(UUID, UUID[])
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_project_workspace_files(UUID, UUID[])
  FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.cancel_project_workspace_upload(
  p_order_id UUID,
  p_file_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_path TEXT;
BEGIN
  IF NOT public.can_write_project_files(p_order_id) THEN
    RAISE EXCEPTION 'project unavailable' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  SELECT storage_path INTO v_path FROM public.order_files
  WHERE id = p_file_id AND order_id = p_order_id
    AND category = 'project' AND file_variant = 'original' AND lifecycle_status = 'uploading';
  IF v_path IS NULL THEN RETURN FALSE; END IF;
  INSERT INTO public.project_storage_cleanup(order_id, storage_path, not_before)
  VALUES (p_order_id, v_path, now() + interval '3 hours')
  ON CONFLICT (order_id, storage_path) DO UPDATE SET not_before = GREATEST(project_storage_cleanup.not_before, EXCLUDED.not_before);
  DELETE FROM public.order_files WHERE id = p_file_id AND order_id = p_order_id AND lifecycle_status = 'uploading';
  RETURN TRUE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_project_workspace_upload(UUID, UUID)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancel_project_workspace_upload(UUID, UUID)
  FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.expire_project_workspace_uploads(p_order_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted INTEGER;
BEGIN
  IF NOT public.can_write_project_files(p_order_id) THEN
    RAISE EXCEPTION 'project unavailable' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  INSERT INTO public.project_storage_cleanup(order_id, storage_path)
  SELECT p_order_id, storage_path FROM public.order_files
  WHERE order_id = p_order_id AND category = 'project' AND file_variant = 'original'
    AND lifecycle_status = 'uploading' AND created_at < now() - interval '3 hours'
  ON CONFLICT (order_id, storage_path) DO UPDATE SET not_before = LEAST(project_storage_cleanup.not_before, now());
  DELETE FROM public.order_files
  WHERE order_id = p_order_id AND category = 'project' AND file_variant = 'original'
    AND lifecycle_status = 'uploading' AND created_at < now() - interval '3 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
GRANT EXECUTE ON FUNCTION public.expire_project_workspace_uploads(UUID)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.expire_project_workspace_uploads(UUID)
  FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.complete_project_storage_cleanup(
  p_order_id UUID,
  p_cleanup_ids UUID[]
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted INTEGER;
BEGIN
  IF NOT public.can_write_project_files(p_order_id) THEN
    RAISE EXCEPTION 'project unavailable' USING ERRCODE = '42501';
  END IF;
  IF cardinality(COALESCE(p_cleanup_ids, ARRAY[]::UUID[])) = 0
    OR cardinality(p_cleanup_ids) > 200
  THEN
    RAISE EXCEPTION 'invalid cleanup selection' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.project_storage_cleanup
  WHERE order_id = p_order_id
    AND id = ANY(p_cleanup_ids)
    AND not_before <= now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_project_storage_cleanup(UUID, UUID[])
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_project_storage_cleanup(UUID, UUID[])
  FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';
