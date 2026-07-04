-- N2 (Wave 2, docs stream): deal-level free-form file uploads + signed versions
-- of generated documents. Additive & idempotent — safe to re-run.

-- (a) Free-form deal files reuse the existing order_files table + 'orders' bucket
--     with a new 'deal' category (distinct from the legacy customer/production
--     order-tab files). Widen the category CHECK constraint.
ALTER TABLE public.order_files DROP CONSTRAINT IF EXISTS order_files_category_check;
ALTER TABLE public.order_files
  ADD CONSTRAINT order_files_category_check CHECK (category IN ('customer', 'production', 'deal'));

-- (b) Signed versions of generated documents. A generated order_documents row can
--     carry an uploaded, counterparty-signed PDF alongside the system-generated one.
--     Stored in the same private 'deal-documents' bucket under a signed/ prefix.
ALTER TABLE public.order_documents ADD COLUMN IF NOT EXISTS signed_storage_path TEXT;
ALTER TABLE public.order_documents ADD COLUMN IF NOT EXISTS signed_file_name    TEXT;
ALTER TABLE public.order_documents ADD COLUMN IF NOT EXISTS signed_uploaded_at  TIMESTAMPTZ;
ALTER TABLE public.order_documents ADD COLUMN IF NOT EXISTS signed_uploaded_by  UUID REFERENCES public.portal_users(id);
