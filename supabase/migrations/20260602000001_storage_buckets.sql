-- Storage buckets for CSV uploads and receipt OCR images.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('uploads', 'uploads', false),
  ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'users_can_read_own_uploads'
  ) THEN
    CREATE POLICY "users_can_read_own_uploads"
      ON storage.objects FOR SELECT
      USING (
        bucket_id IN ('uploads', 'receipts')
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'users_can_insert_own_uploads'
  ) THEN
    CREATE POLICY "users_can_insert_own_uploads"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id IN ('uploads', 'receipts')
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
