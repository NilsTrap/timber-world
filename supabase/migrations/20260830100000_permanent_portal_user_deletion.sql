-- Preserve commercial history while allowing permanent portal-user deletion.
-- Access-only rows already cascade; historical actor attribution becomes nullable.

DO $$
DECLARE
  relation_name TEXT;
  field_name TEXT;
  fk_name TEXT;
BEGIN
  FOR relation_name, field_name IN
    SELECT * FROM (VALUES
      ('portal_users', 'invited_by'),
      ('organization_memberships', 'invited_by'),
      ('audit_log', 'actual_user_id'),
      ('audit_log', 'target_user_id'),
      ('orders', 'created_by'),
      ('orders', 'margin_approved_by'),
      ('order_activity_log', 'user_id'),
      ('order_files', 'uploaded_by'),
      ('order_files', 'approved_by'),
      ('order_files', 'shared_by'),
      ('project_folders', 'created_by'),
      ('deals', 'created_by'),
      ('deal_documents', 'generated_by'),
      ('deal_gates', 'confirmed_by_user'),
      ('shipments', 'reviewed_by'),
      ('order_documents', 'generated_by'),
      ('order_documents', 'signed_uploaded_by'),
      ('order_documents', 'firmed_by'),
      ('spines', 'created_by'),
      ('project_supplier_rfqs', 'created_by'),
      ('document_templates', 'created_by'),
      ('production_tracking_sets', 'created_by'),
      ('project_rfq_candidates', 'quote_entered_by'),
      ('project_commercial_rollup_lines', 'created_by'),
      ('spine_project_images', 'created_by')
    ) AS preserved_references(table_name, column_name)
  LOOP
    IF to_regclass('public.' || relation_name) IS NULL OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = relation_name AND c.column_name = field_name
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', relation_name, field_name);
    FOR fk_name IN
      SELECT constraint_definition.conname
      FROM pg_constraint constraint_definition
      JOIN pg_class relation_definition ON relation_definition.oid = constraint_definition.conrelid
      JOIN pg_namespace schema_definition ON schema_definition.oid = relation_definition.relnamespace
      WHERE schema_definition.nspname = 'public'
        AND relation_definition.relname = relation_name
        AND constraint_definition.contype = 'f'
        AND constraint_definition.confrelid = 'public.portal_users'::regclass
        AND array_length(constraint_definition.conkey, 1) = 1
        AND array_length(constraint_definition.confkey, 1) = 1
        AND field_name = ANY (
          SELECT attribute_definition.attname
          FROM unnest(constraint_definition.conkey) AS key_number(attnum)
          JOIN pg_attribute attribute_definition
            ON attribute_definition.attrelid = relation_definition.oid
           AND attribute_definition.attnum = key_number.attnum
        )
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', relation_name, fk_name);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.portal_users(id) ON DELETE SET NULL',
      relation_name, relation_name || '_' || field_name || '_fkey', field_name
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
