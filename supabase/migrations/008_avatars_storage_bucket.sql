-- ============================================================
-- Storage bucket for avatar profile pictures
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Users can upload avatars into their own folder
CREATE POLICY "avatars_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Anyone can view avatars
CREATE POLICY "avatars_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- Users can delete their own avatars
CREATE POLICY "avatars_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can update (overwrite) their own avatars
CREATE POLICY "avatars_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
