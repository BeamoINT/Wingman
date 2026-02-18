BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles + safety preference extensions
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS safety_audio_cloud_grace_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS safety_audio_cloud_downgraded_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.safety_preferences
  ADD COLUMN IF NOT EXISTS cloud_audio_retention_action TEXT NOT NULL DEFAULT 'auto_delete',
  ADD COLUMN IF NOT EXISTS cloud_audio_wifi_only_upload BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.safety_preferences
SET
  cloud_audio_retention_action = COALESCE(NULLIF(TRIM(cloud_audio_retention_action), ''), 'auto_delete'),
  cloud_audio_wifi_only_upload = COALESCE(cloud_audio_wifi_only_upload, FALSE)
WHERE cloud_audio_retention_action IS NULL
   OR NULLIF(TRIM(cloud_audio_retention_action), '') IS NULL
   OR cloud_audio_wifi_only_upload IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'safety_preferences_cloud_audio_retention_action_check'
      AND conrelid = 'public.safety_preferences'::regclass
  ) THEN
    ALTER TABLE public.safety_preferences
      ADD CONSTRAINT safety_preferences_cloud_audio_retention_action_check
      CHECK (cloud_audio_retention_action IN ('auto_delete', 'auto_download'));
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Cloud recording metadata + notices
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.safety_audio_cloud_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  local_recording_id TEXT,
  bucket TEXT NOT NULL DEFAULT 'safety-audio-cloud',
  object_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  duration_ms INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading',
  auto_action TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  pending_auto_download_set_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT safety_audio_cloud_recordings_status_check CHECK (
    status IN ('uploading', 'uploaded', 'upload_failed', 'pending_auto_download', 'deleted', 'grace_deleted', 'auto_downloaded')
  ),
  CONSTRAINT safety_audio_cloud_recordings_auto_action_check CHECK (
    auto_action IS NULL OR auto_action IN ('auto_delete', 'auto_download')
  ),
  CONSTRAINT safety_audio_cloud_recordings_size_check CHECK (size_bytes IS NULL OR size_bytes >= 0),
  CONSTRAINT safety_audio_cloud_recordings_duration_check CHECK (duration_ms IS NULL OR duration_ms >= 0),
  CONSTRAINT safety_audio_cloud_recordings_retry_count_check CHECK (retry_count >= 0)
);

ALTER TABLE IF EXISTS public.safety_audio_cloud_recordings
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS local_recording_id TEXT,
  ADD COLUMN IF NOT EXISTS bucket TEXT NOT NULL DEFAULT 'safety-audio-cloud',
  ADD COLUMN IF NOT EXISTS object_path TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'uploading',
  ADD COLUMN IF NOT EXISTS auto_action TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_code TEXT,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT,
  ADD COLUMN IF NOT EXISTS pending_auto_download_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.safety_audio_cloud_recordings
SET
  bucket = COALESCE(NULLIF(TRIM(bucket), ''), 'safety-audio-cloud'),
  status = COALESCE(NULLIF(TRIM(status), ''), 'uploading'),
  retry_count = GREATEST(COALESCE(retry_count, 0), 0),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW()),
  recorded_at = COALESCE(recorded_at, created_at, NOW()),
  expires_at = COALESCE(expires_at, (COALESCE(recorded_at, created_at, NOW()) + INTERVAL '3 months'))
WHERE
  bucket IS NULL
  OR NULLIF(TRIM(bucket), '') IS NULL
  OR status IS NULL
  OR NULLIF(TRIM(status), '') IS NULL
  OR retry_count IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL
  OR recorded_at IS NULL
  OR expires_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'safety_audio_cloud_recordings'
      AND column_name = 'object_path'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.safety_audio_cloud_recordings
      ALTER COLUMN object_path SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'safety_audio_cloud_recordings'
      AND column_name = 'expires_at'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.safety_audio_cloud_recordings
      ALTER COLUMN expires_at SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'safety_audio_cloud_recordings_expires_check'
      AND conrelid = 'public.safety_audio_cloud_recordings'::regclass
  ) THEN
    ALTER TABLE public.safety_audio_cloud_recordings
      ADD CONSTRAINT safety_audio_cloud_recordings_expires_check
      CHECK (expires_at > recorded_at);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_safety_audio_cloud_recordings_bucket_path
  ON public.safety_audio_cloud_recordings(bucket, object_path);

CREATE INDEX IF NOT EXISTS idx_safety_audio_cloud_recordings_user_status
  ON public.safety_audio_cloud_recordings(user_id, status, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_safety_audio_cloud_recordings_user_expires
  ON public.safety_audio_cloud_recordings(user_id, expires_at ASC)
  WHERE status IN ('uploaded', 'upload_failed', 'pending_auto_download');

CREATE INDEX IF NOT EXISTS idx_safety_audio_cloud_recordings_local_recording_id
  ON public.safety_audio_cloud_recordings(user_id, local_recording_id)
  WHERE local_recording_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.safety_audio_cloud_notice_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES public.safety_audio_cloud_recordings(id) ON DELETE CASCADE,
  notice_type TEXT NOT NULL,
  threshold_days INTEGER,
  channel TEXT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT safety_audio_cloud_notice_log_notice_type_check CHECK (
    notice_type IN ('retention_warning', 'retention_action', 'grace_warning', 'grace_expired')
  ),
  CONSTRAINT safety_audio_cloud_notice_log_channel_check CHECK (
    channel IN ('in_app', 'email')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_safety_audio_cloud_notice_log_dedupe
  ON public.safety_audio_cloud_notice_log(
    user_id,
    COALESCE(recording_id, '00000000-0000-0000-0000-000000000000'::UUID),
    notice_type,
    COALESCE(threshold_days, -1),
    channel
  );

CREATE INDEX IF NOT EXISTS idx_safety_audio_cloud_notice_log_user
  ON public.safety_audio_cloud_notice_log(user_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS public.safety_audio_cloud_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES public.safety_audio_cloud_recordings(id) ON DELETE SET NULL,
  notice_type TEXT NOT NULL,
  threshold_days INTEGER,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT safety_audio_cloud_notices_notice_type_check CHECK (
    notice_type IN ('retention_warning', 'retention_action', 'grace_warning', 'grace_expired')
  )
);

CREATE INDEX IF NOT EXISTS idx_safety_audio_cloud_notices_user
  ON public.safety_audio_cloud_notices(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_safety_audio_cloud_notices_unread
  ON public.safety_audio_cloud_notices(user_id, read_at, created_at DESC)
  WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_safety_audio_cloud_recordings_updated_at'
    ) THEN
      CREATE TRIGGER trg_safety_audio_cloud_recordings_updated_at
        BEFORE UPDATE ON public.safety_audio_cloud_recordings
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_safety_audio_cloud_notices_updated_at'
    ) THEN
      CREATE TRIGGER trg_safety_audio_cloud_notices_updated_at
        BEFORE UPDATE ON public.safety_audio_cloud_notices
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_safety_audio_cloud_write_access(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.subscription_tier = 'pro'
      AND p.pro_status = 'active'
      AND (p.pro_expires_at IS NULL OR p.pro_expires_at > NOW())
  );
$$;

CREATE OR REPLACE FUNCTION public.has_safety_audio_cloud_read_access(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND (
        public.has_safety_audio_cloud_write_access(p_user_id)
        OR (
          p.safety_audio_cloud_grace_until IS NOT NULL
          AND p.safety_audio_cloud_grace_until > NOW()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Downgrade grace lifecycle trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_safety_audio_cloud_grace_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_tier = 'pro' THEN
    NEW.safety_audio_cloud_downgraded_at := NULL;
    NEW.safety_audio_cloud_grace_until := NULL;
    RETURN NEW;
  END IF;

  IF OLD.subscription_tier = 'pro' AND NEW.subscription_tier <> 'pro' THEN
    NEW.safety_audio_cloud_downgraded_at := NOW();
    NEW.safety_audio_cloud_grace_until := NOW() + INTERVAL '30 days';
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_safety_audio_cloud_grace_v1 ON public.profiles;
CREATE TRIGGER trg_sync_safety_audio_cloud_grace_v1
  BEFORE UPDATE OF subscription_tier, pro_status
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_safety_audio_cloud_grace_v1();

-- ---------------------------------------------------------------------------
-- Safety preference v3 API
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_safety_preferences_v3(
  p_checkins_enabled BOOLEAN DEFAULT NULL,
  p_checkin_interval_minutes INTEGER DEFAULT NULL,
  p_checkin_response_window_minutes INTEGER DEFAULT NULL,
  p_sos_enabled BOOLEAN DEFAULT NULL,
  p_auto_share_live_location BOOLEAN DEFAULT NULL,
  p_auto_record_safety_audio_on_visit BOOLEAN DEFAULT NULL,
  p_safety_audio_policy_ack_version TEXT DEFAULT NULL,
  p_acknowledge_safety_audio_policy BOOLEAN DEFAULT FALSE,
  p_cloud_audio_retention_action TEXT DEFAULT NULL,
  p_cloud_audio_wifi_only_upload BOOLEAN DEFAULT NULL
)
RETURNS public.safety_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result_row public.safety_preferences;
  normalized_ack_version TEXT := NULLIF(TRIM(COALESCE(p_safety_audio_policy_ack_version, '')), '');
  normalized_retention_action TEXT := NULLIF(TRIM(COALESCE(p_cloud_audio_retention_action, '')), '');
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF normalized_retention_action IS NOT NULL
     AND normalized_retention_action NOT IN ('auto_delete', 'auto_download') THEN
    RAISE EXCEPTION 'cloud_audio_retention_action must be auto_delete or auto_download';
  END IF;

  PERFORM public.get_or_create_safety_preferences_v1(current_user_id);

  UPDATE public.safety_preferences
  SET
    checkins_enabled = COALESCE(p_checkins_enabled, checkins_enabled),
    checkin_interval_minutes = COALESCE(p_checkin_interval_minutes, checkin_interval_minutes),
    checkin_response_window_minutes = COALESCE(p_checkin_response_window_minutes, checkin_response_window_minutes),
    sos_enabled = COALESCE(p_sos_enabled, sos_enabled),
    auto_share_live_location = COALESCE(p_auto_share_live_location, auto_share_live_location),
    auto_record_safety_audio_on_visit = COALESCE(p_auto_record_safety_audio_on_visit, auto_record_safety_audio_on_visit),
    safety_audio_policy_ack_version = CASE
      WHEN p_acknowledge_safety_audio_policy AND normalized_ack_version IS NOT NULL
      THEN normalized_ack_version
      ELSE safety_audio_policy_ack_version
    END,
    safety_audio_policy_ack_at = CASE
      WHEN p_acknowledge_safety_audio_policy AND normalized_ack_version IS NOT NULL
      THEN NOW()
      ELSE safety_audio_policy_ack_at
    END,
    cloud_audio_retention_action = COALESCE(normalized_retention_action, cloud_audio_retention_action),
    cloud_audio_wifi_only_upload = COALESCE(p_cloud_audio_wifi_only_upload, cloud_audio_wifi_only_upload),
    updated_at = NOW()
  WHERE user_id = current_user_id
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cloud recording RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_my_safety_audio_cloud_recordings_v1(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_status TEXT DEFAULT NULL
)
RETURNS SETOF public.safety_audio_cloud_recordings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  normalized_status TEXT := NULLIF(TRIM(COALESCE(p_status, '')), '');
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_safety_audio_cloud_read_access(current_user_id) THEN
    RETURN;
  END IF;

  IF normalized_status IS NOT NULL
     AND normalized_status NOT IN ('uploading', 'uploaded', 'upload_failed', 'pending_auto_download', 'deleted', 'grace_deleted', 'auto_downloaded') THEN
    RAISE EXCEPTION 'Invalid safety audio cloud status filter';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.safety_audio_cloud_recordings r
  WHERE r.user_id = current_user_id
    AND (
      (normalized_status IS NOT NULL AND r.status = normalized_status)
      OR (
        normalized_status IS NULL
        AND r.status IN ('uploading', 'uploaded', 'upload_failed', 'pending_auto_download')
      )
    )
  ORDER BY r.recorded_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_safety_audio_cloud_upload_complete_v1(
  p_recording_id UUID,
  p_uploaded_size_bytes BIGINT DEFAULT NULL,
  p_uploaded_duration_ms INTEGER DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL
)
RETURNS public.safety_audio_cloud_recordings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result_row public.safety_audio_cloud_recordings;
  prefs_row public.safety_preferences;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_safety_audio_cloud_write_access(current_user_id) THEN
    RAISE EXCEPTION 'PRO_REQUIRED';
  END IF;

  SELECT * INTO prefs_row
  FROM public.get_or_create_safety_preferences_v1(current_user_id);

  UPDATE public.safety_audio_cloud_recordings
  SET
    size_bytes = COALESCE(p_uploaded_size_bytes, size_bytes),
    duration_ms = COALESCE(p_uploaded_duration_ms, duration_ms),
    mime_type = COALESCE(NULLIF(TRIM(COALESCE(p_mime_type, '')), ''), mime_type),
    uploaded_at = NOW(),
    expires_at = COALESCE(expires_at, recorded_at + INTERVAL '3 months'),
    auto_action = COALESCE(auto_action, prefs_row.cloud_audio_retention_action),
    status = 'uploaded',
    last_error_code = NULL,
    last_error_message = NULL,
    updated_at = NOW()
  WHERE id = p_recording_id
    AND user_id = current_user_id
  RETURNING * INTO result_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cloud recording not found';
  END IF;

  RETURN result_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_safety_audio_cloud_upload_failed_v1(
  p_recording_id UUID,
  p_error_code TEXT,
  p_error_message TEXT
)
RETURNS public.safety_audio_cloud_recordings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result_row public.safety_audio_cloud_recordings;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.safety_audio_cloud_recordings
  SET
    status = 'upload_failed',
    retry_count = retry_count + 1,
    last_retry_at = NOW(),
    last_error_code = NULLIF(TRIM(COALESCE(p_error_code, '')), ''),
    last_error_message = NULLIF(TRIM(COALESCE(p_error_message, '')), ''),
    updated_at = NOW()
  WHERE id = p_recording_id
    AND user_id = current_user_id
    AND status IN ('uploading', 'uploaded', 'upload_failed')
  RETURNING * INTO result_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cloud recording not found';
  END IF;

  RETURN result_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_safety_audio_cloud_recording_v1(
  p_recording_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  affected_rows INTEGER := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_safety_audio_cloud_read_access(current_user_id) THEN
    RAISE EXCEPTION 'PRO_REQUIRED';
  END IF;

  UPDATE public.safety_audio_cloud_recordings
  SET
    status = 'deleted',
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_recording_id
    AND user_id = current_user_id
    AND status <> 'deleted'
    AND status <> 'grace_deleted'
    AND status <> 'auto_downloaded';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows = 0 THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.safety_audio_cloud_recordings
      WHERE id = p_recording_id
        AND user_id = current_user_id
    );
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_pending_safety_audio_auto_downloads_v1(
  p_limit INTEGER DEFAULT 20
)
RETURNS SETOF public.safety_audio_cloud_recordings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_safety_audio_cloud_read_access(current_user_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.safety_audio_cloud_recordings r
  WHERE r.user_id = current_user_id
    AND r.status = 'pending_auto_download'
  ORDER BY r.expires_at ASC, r.recorded_at ASC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_safety_audio_auto_download_v1(
  p_recording_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  affected_rows INTEGER := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_safety_audio_cloud_read_access(current_user_id) THEN
    RAISE EXCEPTION 'PRO_REQUIRED';
  END IF;

  UPDATE public.safety_audio_cloud_recordings
  SET
    status = 'auto_downloaded',
    downloaded_at = NOW(),
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_recording_id
    AND user_id = current_user_id
    AND status = 'pending_auto_download';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  RETURN affected_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_safety_audio_cloud_notices_v1(
  p_unread_only BOOLEAN DEFAULT TRUE
)
RETURNS SETOF public.safety_audio_cloud_notices
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.*
  FROM public.safety_audio_cloud_notices n
  WHERE n.user_id = auth.uid()
    AND (NOT COALESCE(p_unread_only, TRUE) OR n.read_at IS NULL)
    AND (n.expires_at IS NULL OR n.expires_at > NOW())
  ORDER BY n.created_at DESC
  LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION public.mark_safety_audio_cloud_notice_read_v1(
  p_notice_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  affected_rows INTEGER := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.safety_audio_cloud_notices
  SET
    read_at = COALESCE(read_at, NOW()),
    updated_at = NOW()
  WHERE id = p_notice_id
    AND user_id = current_user_id;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE public.safety_audio_cloud_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_audio_cloud_notice_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_audio_cloud_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Safety audio cloud recordings select own v1" ON public.safety_audio_cloud_recordings;
CREATE POLICY "Safety audio cloud recordings select own v1"
ON public.safety_audio_cloud_recordings
FOR SELECT
USING (
  auth.uid() = user_id
  AND public.has_safety_audio_cloud_read_access(auth.uid())
);

DROP POLICY IF EXISTS "Safety audio cloud recordings insert own v1" ON public.safety_audio_cloud_recordings;
CREATE POLICY "Safety audio cloud recordings insert own v1"
ON public.safety_audio_cloud_recordings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.has_safety_audio_cloud_write_access(auth.uid())
);

DROP POLICY IF EXISTS "Safety audio cloud recordings update own v1" ON public.safety_audio_cloud_recordings;
CREATE POLICY "Safety audio cloud recordings update own v1"
ON public.safety_audio_cloud_recordings
FOR UPDATE
USING (
  auth.uid() = user_id
  AND public.has_safety_audio_cloud_read_access(auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  AND public.has_safety_audio_cloud_read_access(auth.uid())
);

DROP POLICY IF EXISTS "Safety audio cloud recordings delete own v1" ON public.safety_audio_cloud_recordings;
CREATE POLICY "Safety audio cloud recordings delete own v1"
ON public.safety_audio_cloud_recordings
FOR DELETE
USING (
  auth.uid() = user_id
  AND public.has_safety_audio_cloud_read_access(auth.uid())
);

DROP POLICY IF EXISTS "Safety audio cloud notices select own v1" ON public.safety_audio_cloud_notices;
CREATE POLICY "Safety audio cloud notices select own v1"
ON public.safety_audio_cloud_notices
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Safety audio cloud notices update own v1" ON public.safety_audio_cloud_notices;
CREATE POLICY "Safety audio cloud notices update own v1"
ON public.safety_audio_cloud_notices
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Safety audio cloud notice log deny client v1" ON public.safety_audio_cloud_notice_log;
CREATE POLICY "Safety audio cloud notice log deny client v1"
ON public.safety_audio_cloud_notice_log
FOR ALL
USING (FALSE)
WITH CHECK (FALSE);

-- ---------------------------------------------------------------------------
-- Private storage bucket + object policies
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'safety-audio-cloud',
  'safety-audio-cloud',
  FALSE,
  26214400,
  ARRAY['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/x-m4a', 'application/octet-stream']
)
ON CONFLICT (id)
DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Safety audio cloud object select own v1" ON storage.objects;
CREATE POLICY "Safety audio cloud object select own v1"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'safety-audio-cloud'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.has_safety_audio_cloud_read_access(auth.uid())
);

DROP POLICY IF EXISTS "Safety audio cloud object insert own v1" ON storage.objects;
CREATE POLICY "Safety audio cloud object insert own v1"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'safety-audio-cloud'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.has_safety_audio_cloud_write_access(auth.uid())
);

DROP POLICY IF EXISTS "Safety audio cloud object update own v1" ON storage.objects;
CREATE POLICY "Safety audio cloud object update own v1"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'safety-audio-cloud'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.has_safety_audio_cloud_write_access(auth.uid())
)
WITH CHECK (
  bucket_id = 'safety-audio-cloud'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.has_safety_audio_cloud_write_access(auth.uid())
);

DROP POLICY IF EXISTS "Safety audio cloud object delete own v1" ON storage.objects;
CREATE POLICY "Safety audio cloud object delete own v1"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'safety-audio-cloud'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.has_safety_audio_cloud_read_access(auth.uid())
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_audio_cloud_recordings TO authenticated;
GRANT SELECT, UPDATE ON public.safety_audio_cloud_notices TO authenticated;

GRANT EXECUTE ON FUNCTION public.has_safety_audio_cloud_write_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_safety_audio_cloud_read_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_safety_audio_cloud_write_access(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_safety_audio_cloud_read_access(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_safety_preferences_v3(
  BOOLEAN,
  INTEGER,
  INTEGER,
  BOOLEAN,
  BOOLEAN,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  TEXT,
  BOOLEAN
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_safety_audio_cloud_recordings_v1(INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_safety_audio_cloud_upload_complete_v1(UUID, BIGINT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_safety_audio_cloud_upload_failed_v1(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_safety_audio_cloud_recording_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pending_safety_audio_auto_downloads_v1(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_safety_audio_auto_download_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_safety_audio_cloud_notices_v1(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_safety_audio_cloud_notice_read_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_safety_audio_cloud_recordings_v1(INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_safety_audio_cloud_upload_complete_v1(UUID, BIGINT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_safety_audio_cloud_upload_failed_v1(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_safety_audio_cloud_recording_v1(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_pending_safety_audio_auto_downloads_v1(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_safety_audio_auto_download_v1(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_safety_audio_cloud_notices_v1(BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_safety_audio_cloud_notice_read_v1(UUID) TO service_role;

COMMIT;
