-- Profile photo-ID match attestation + avatar storage hardening

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_photo_id_match_attested BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS profile_photo_id_match_attested_at TIMESTAMPTZ NULL;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Profile avatars are publicly readable" ON storage.objects;
CREATE POLICY "Profile avatars are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS "Users can upload own profile avatars" ON storage.objects;
CREATE POLICY "Users can upload own profile avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own profile avatars" ON storage.objects;
CREATE POLICY "Users can update own profile avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own profile avatars" ON storage.objects;
CREATE POLICY "Users can delete own profile avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
