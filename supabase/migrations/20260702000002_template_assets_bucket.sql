-- E6.1 · WYSIWYG editor — PUBLIC template-assets storage bucket (logos/letterheads).
--
-- Public read is DELIBERATE: Gotenberg's headless Chromium fetches the compiled
-- <img src="{publicUrl}"> with NO Authorization header (the bearer only guards the
-- Gotenberg endpoint itself, not its outbound image fetches). A private/signed URL
-- would silently render a broken image in the PDF.
--
-- The real WRITE guard is the platform-admin gate in the uploadTemplateLogo server
-- action; storage RLS mirrors the existing marketing bucket (public read,
-- authenticated write — see 20260301000010/12). Additive + idempotent.

INSERT INTO storage.buckets (id, name, public)
VALUES ('template-assets', 'template-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read access for template-assets bucket" ON storage.objects;
CREATE POLICY "Public read access for template-assets bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'template-assets');

DROP POLICY IF EXISTS "Authenticated upload for template-assets bucket" ON storage.objects;
CREATE POLICY "Authenticated upload for template-assets bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'template-assets');

DROP POLICY IF EXISTS "Authenticated update for template-assets bucket" ON storage.objects;
CREATE POLICY "Authenticated update for template-assets bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'template-assets');

DROP POLICY IF EXISTS "Authenticated delete for template-assets bucket" ON storage.objects;
CREATE POLICY "Authenticated delete for template-assets bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'template-assets');
