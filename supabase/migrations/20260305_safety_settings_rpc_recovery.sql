BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Safety settings schema recovery
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.safety_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkins_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  checkin_interval_minutes INTEGER NOT NULL DEFAULT 30,
  checkin_response_window_minutes INTEGER NOT NULL DEFAULT 10,
  sos_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_share_live_location BOOLEAN NOT NULL DEFAULT FALSE,
  auto_record_safety_audio_on_visit BOOLEAN NOT NULL DEFAULT FALSE,
  safety_audio_policy_ack_version TEXT,
  safety_audio_policy_ack_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT safety_preferences_interval_check CHECK (checkin_interval_minutes BETWEEN 5 AND 180),
  CONSTRAINT safety_preferences_response_window_check CHECK (checkin_response_window_minutes BETWEEN 1 AND 60)
);

ALTER TABLE IF EXISTS public.safety_preferences
  ADD COLUMN IF NOT EXISTS auto_record_safety_audio_on_visit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS safety_audio_policy_ack_version TEXT,
  ADD COLUMN IF NOT EXISTS safety_audio_policy_ack_at TIMESTAMPTZ;

UPDATE public.safety_preferences
SET auto_record_safety_audio_on_visit = FALSE
WHERE auto_record_safety_audio_on_visit IS NULL;

CREATE TABLE IF NOT EXISTS public.safety_feature_acknowledgements (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  disclaimer_version TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'safety_center',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT safety_feature_ack_version_check CHECK (NULLIF(TRIM(disclaimer_version), '') IS NOT NULL),
  CONSTRAINT safety_feature_ack_source_check CHECK (NULLIF(TRIM(source), '') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  relationship TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_last_sent_at TIMESTAMPTZ,
  verification_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT emergency_contacts_name_check CHECK (NULLIF(TRIM(name), '') IS NOT NULL),
  CONSTRAINT emergency_contacts_relationship_check CHECK (NULLIF(TRIM(relationship), '') IS NOT NULL),
  CONSTRAINT emergency_contacts_phone_check CHECK (phone_e164 ~ '^\\+[1-9][0-9]{6,14}$')
);

ALTER TABLE IF EXISTS public.emergency_contacts
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS relationship TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_last_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'emergency_contacts'
      AND column_name = 'phone'
  ) THEN
    EXECUTE '
      UPDATE public.emergency_contacts
      SET phone_e164 = COALESCE(phone_e164, NULLIF(TRIM(phone), ''''))
      WHERE phone_e164 IS NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'emergency_contacts'
      AND column_name = 'phone_number'
  ) THEN
    EXECUTE '
      UPDATE public.emergency_contacts
      SET phone_e164 = COALESCE(phone_e164, NULLIF(TRIM(phone_number), ''''))
      WHERE phone_e164 IS NULL
    ';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_contacts_user_phone_unique
  ON public.emergency_contacts(user_id, phone_e164);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user
  ON public.emergency_contacts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.emergency_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  message_text TEXT NOT NULL,
  location_available BOOLEAN NOT NULL DEFAULT FALSE,
  location_latitude DOUBLE PRECISION,
  location_longitude DOUBLE PRECISION,
  location_accuracy_m DOUBLE PRECISION,
  location_captured_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.emergency_alert_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_event_id UUID NOT NULL REFERENCES public.emergency_alert_events(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.emergency_contacts(id) ON DELETE SET NULL,
  phone_e164 TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms',
  status TEXT NOT NULL DEFAULT 'queued',
  provider_ref TEXT,
  provider_error_code TEXT,
  provider_error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.emergency_live_location_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_live_location_shares_booking_user
  ON public.emergency_live_location_shares(booking_id, user_id);

CREATE TABLE IF NOT EXISTS public.emergency_live_location_points (
  share_id UUID PRIMARY KEY REFERENCES public.emergency_live_location_shares(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  heading_deg DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  captured_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.emergency_live_location_view_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES public.emergency_live_location_shares(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.emergency_contacts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  token_prefix TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_live_location_tokens_hash
  ON public.emergency_live_location_view_tokens(token_hash);

ALTER TABLE IF EXISTS public.bookings
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.safety_monitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled',
  checkin_interval_minutes INTEGER NOT NULL DEFAULT 30,
  response_window_minutes INTEGER NOT NULL DEFAULT 10,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  next_checkin_at TIMESTAMPTZ,
  escalation_reason TEXT,
  last_escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT safety_monitor_sessions_status_check CHECK (
    status IN ('scheduled', 'active', 'completed', 'cancelled', 'expired')
  ),
  CONSTRAINT safety_monitor_sessions_interval_check CHECK (
    checkin_interval_minutes BETWEEN 5 AND 180
  ),
  CONSTRAINT safety_monitor_sessions_response_window_check CHECK (
    response_window_minutes BETWEEN 1 AND 60
  ),
  CONSTRAINT safety_monitor_sessions_unique_booking_user UNIQUE (booking_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.safety_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.safety_monitor_sessions(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respond_by TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  response TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  escalation_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT safety_checkins_status_check CHECK (
    status IN ('pending', 'safe', 'unsafe', 'timed_out', 'dismissed')
  ),
  CONSTRAINT safety_checkins_response_check CHECK (
    response IS NULL OR response IN ('safe', 'unsafe')
  )
);

CREATE INDEX IF NOT EXISTS idx_safety_monitor_sessions_user_status
  ON public.safety_monitor_sessions(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_safety_checkins_user_status
  ON public.safety_checkins(user_id, status, respond_by ASC);

-- ---------------------------------------------------------------------------
-- Function recovery: safety preferences + acknowledgement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_or_create_safety_preferences_v1(
  p_user_id UUID
)
RETURNS public.safety_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs_row public.safety_preferences;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  INSERT INTO public.safety_preferences (
    user_id,
    checkins_enabled,
    checkin_interval_minutes,
    checkin_response_window_minutes,
    sos_enabled,
    auto_share_live_location,
    auto_record_safety_audio_on_visit,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    TRUE,
    30,
    10,
    TRUE,
    FALSE,
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO prefs_row
  FROM public.safety_preferences
  WHERE user_id = p_user_id;

  RETURN prefs_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_safety_preferences_v1()
RETURNS public.safety_preferences
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

  RETURN public.get_or_create_safety_preferences_v1(current_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_safety_preferences_v2()
RETURNS public.safety_preferences
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

  RETURN public.get_or_create_safety_preferences_v1(current_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_safety_preferences_v1(
  p_checkins_enabled BOOLEAN DEFAULT NULL,
  p_checkin_interval_minutes INTEGER DEFAULT NULL,
  p_checkin_response_window_minutes INTEGER DEFAULT NULL,
  p_sos_enabled BOOLEAN DEFAULT NULL,
  p_auto_share_live_location BOOLEAN DEFAULT NULL
)
RETURNS public.safety_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result_row public.safety_preferences;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.get_or_create_safety_preferences_v1(current_user_id);

  UPDATE public.safety_preferences
  SET
    checkins_enabled = COALESCE(p_checkins_enabled, checkins_enabled),
    checkin_interval_minutes = COALESCE(p_checkin_interval_minutes, checkin_interval_minutes),
    checkin_response_window_minutes = COALESCE(p_checkin_response_window_minutes, checkin_response_window_minutes),
    sos_enabled = COALESCE(p_sos_enabled, sos_enabled),
    auto_share_live_location = COALESCE(p_auto_share_live_location, auto_share_live_location),
    updated_at = NOW()
  WHERE user_id = current_user_id
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_safety_preferences_v2(
  p_checkins_enabled BOOLEAN DEFAULT NULL,
  p_checkin_interval_minutes INTEGER DEFAULT NULL,
  p_checkin_response_window_minutes INTEGER DEFAULT NULL,
  p_sos_enabled BOOLEAN DEFAULT NULL,
  p_auto_share_live_location BOOLEAN DEFAULT NULL,
  p_auto_record_safety_audio_on_visit BOOLEAN DEFAULT NULL,
  p_safety_audio_policy_ack_version TEXT DEFAULT NULL,
  p_acknowledge_safety_audio_policy BOOLEAN DEFAULT FALSE
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
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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
    updated_at = NOW()
  WHERE user_id = current_user_id
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_safety_acknowledgement_v1()
RETURNS TABLE (
  has_acknowledged BOOLEAN,
  disclaimer_version TEXT,
  acknowledged_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (sfa.user_id IS NOT NULL) AS has_acknowledged,
    sfa.disclaimer_version,
    sfa.acknowledged_at
  FROM (
    SELECT auth.uid() AS caller_user_id
  ) caller
  LEFT JOIN public.safety_feature_acknowledgements sfa
    ON sfa.user_id = caller.caller_user_id;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_safety_disclaimer_v1(
  p_disclaimer_version TEXT,
  p_source TEXT DEFAULT 'safety_center'
)
RETURNS public.safety_feature_acknowledgements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  normalized_version TEXT := NULLIF(TRIM(COALESCE(p_disclaimer_version, '')), '');
  normalized_source TEXT := NULLIF(TRIM(COALESCE(p_source, '')), '');
  result_row public.safety_feature_acknowledgements;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF normalized_version IS NULL THEN
    RAISE EXCEPTION 'Disclaimer version is required';
  END IF;

  INSERT INTO public.safety_feature_acknowledgements (
    user_id,
    disclaimer_version,
    acknowledged_at,
    source,
    created_at,
    updated_at
  ) VALUES (
    current_user_id,
    normalized_version,
    NOW(),
    COALESCE(normalized_source, 'safety_center'),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    disclaimer_version = EXCLUDED.disclaimer_version,
    acknowledged_at = EXCLUDED.acknowledged_at,
    source = EXCLUDED.source,
    updated_at = NOW()
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Function recovery: safety sessions + contacts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_booking_participant(
  p_booking_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.companions c
      ON c.id = b.companion_id
    WHERE b.id = p_booking_id
      AND (
        b.client_id = p_user_id
        OR c.user_id = p_user_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.list_emergency_contacts_v1()
RETURNS SETOF public.emergency_contacts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ec.*
  FROM public.emergency_contacts ec
  WHERE ec.user_id = auth.uid()
  ORDER BY ec.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.upsert_emergency_contact_v1(
  p_contact_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_phone_e164 TEXT DEFAULT NULL,
  p_relationship TEXT DEFAULT NULL
)
RETURNS public.emergency_contacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  normalized_name TEXT := NULLIF(TRIM(COALESCE(p_name, '')), '');
  normalized_phone TEXT := NULLIF(TRIM(COALESCE(p_phone_e164, '')), '');
  normalized_relationship TEXT := NULLIF(TRIM(COALESCE(p_relationship, '')), '');
  existing_contact public.emergency_contacts;
  result_row public.emergency_contacts;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF normalized_name IS NULL THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  IF normalized_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;

  IF normalized_relationship IS NULL THEN
    RAISE EXCEPTION 'Relationship is required';
  END IF;

  IF normalized_phone !~ '^\\+[1-9][0-9]{6,14}$' THEN
    RAISE EXCEPTION 'Phone number must be in E.164 format';
  END IF;

  IF p_contact_id IS NULL THEN
    INSERT INTO public.emergency_contacts (
      user_id,
      name,
      phone_e164,
      relationship,
      is_verified,
      verified_at,
      verification_last_sent_at,
      verification_attempts,
      created_at,
      updated_at
    ) VALUES (
      current_user_id,
      normalized_name,
      normalized_phone,
      normalized_relationship,
      FALSE,
      NULL,
      NULL,
      0,
      NOW(),
      NOW()
    )
    RETURNING * INTO result_row;

    RETURN result_row;
  END IF;

  SELECT *
  INTO existing_contact
  FROM public.emergency_contacts
  WHERE id = p_contact_id
    AND user_id = current_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emergency contact not found';
  END IF;

  UPDATE public.emergency_contacts
  SET
    name = normalized_name,
    phone_e164 = normalized_phone,
    relationship = normalized_relationship,
    is_verified = CASE
      WHEN existing_contact.phone_e164 IS DISTINCT FROM normalized_phone THEN FALSE
      ELSE existing_contact.is_verified
    END,
    verified_at = CASE
      WHEN existing_contact.phone_e164 IS DISTINCT FROM normalized_phone THEN NULL
      ELSE existing_contact.verified_at
    END,
    updated_at = NOW()
  WHERE id = existing_contact.id
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_emergency_contact_v1(
  p_contact_id UUID
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

  DELETE FROM public.emergency_contacts
  WHERE id = p_contact_id
    AND user_id = current_user_id;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  RETURN affected_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_active_safety_sessions_v1()
RETURNS TABLE (
  session_id UUID,
  booking_id UUID,
  status TEXT,
  checkin_interval_minutes INTEGER,
  response_window_minutes INTEGER,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  next_checkin_at TIMESTAMPTZ,
  pending_checkin_id UUID,
  pending_checkin_respond_by TIMESTAMPTZ,
  booking_status TEXT,
  scheduled_start_at TIMESTAMPTZ,
  scheduled_end_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sms.id AS session_id,
    sms.booking_id,
    sms.status,
    sms.checkin_interval_minutes,
    sms.response_window_minutes,
    sms.started_at,
    sms.ended_at,
    sms.next_checkin_at,
    pending_checkin.id AS pending_checkin_id,
    pending_checkin.respond_by AS pending_checkin_respond_by,
    b.status AS booking_status,
    b.scheduled_start_at,
    b.scheduled_end_at
  FROM public.safety_monitor_sessions sms
  JOIN public.bookings b
    ON b.id = sms.booking_id
  LEFT JOIN LATERAL (
    SELECT sc.id, sc.respond_by
    FROM public.safety_checkins sc
    WHERE sc.session_id = sms.id
      AND sc.status = 'pending'
    ORDER BY sc.created_at DESC
    LIMIT 1
  ) AS pending_checkin ON TRUE
  WHERE sms.user_id = auth.uid()
    AND sms.status IN ('scheduled', 'active')
  ORDER BY COALESCE(sms.next_checkin_at, sms.created_at) ASC;
$$;

CREATE OR REPLACE FUNCTION public.respond_safety_checkin_v1(
  p_checkin_id UUID,
  p_response TEXT
)
RETURNS public.safety_checkins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  checkin_row public.safety_checkins;
  session_row public.safety_monitor_sessions;
  normalized_response TEXT := LOWER(NULLIF(TRIM(COALESCE(p_response, '')), ''));
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF normalized_response NOT IN ('safe', 'unsafe') THEN
    RAISE EXCEPTION 'Response must be safe or unsafe';
  END IF;

  SELECT *
  INTO checkin_row
  FROM public.safety_checkins
  WHERE id = p_checkin_id
    AND user_id = current_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Check-in not found';
  END IF;

  IF checkin_row.status <> 'pending' THEN
    RETURN checkin_row;
  END IF;

  UPDATE public.safety_checkins
  SET
    response = normalized_response,
    responded_at = NOW(),
    status = CASE WHEN normalized_response = 'safe' THEN 'safe' ELSE 'unsafe' END,
    updated_at = NOW()
  WHERE id = checkin_row.id
  RETURNING * INTO checkin_row;

  SELECT *
  INTO session_row
  FROM public.safety_monitor_sessions
  WHERE id = checkin_row.session_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.safety_monitor_sessions
    SET
      next_checkin_at = CASE
        WHEN normalized_response = 'safe' THEN NOW() + make_interval(mins => checkin_interval_minutes)
        ELSE next_checkin_at
      END,
      escalation_reason = CASE
        WHEN normalized_response = 'unsafe' THEN 'unsafe_response'
        ELSE escalation_reason
      END,
      last_escalated_at = CASE
        WHEN normalized_response = 'unsafe' THEN NOW()
        ELSE last_escalated_at
      END,
      updated_at = NOW()
    WHERE id = session_row.id;
  END IF;

  RETURN checkin_row;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_feature_acknowledgements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_monitor_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_checkins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_alert_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_alert_dispatches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_live_location_shares TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_live_location_points TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_live_location_view_tokens TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_safety_preferences_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_safety_preferences_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_safety_preferences_v1(BOOLEAN, INTEGER, INTEGER, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_safety_preferences_v2(BOOLEAN, INTEGER, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_safety_acknowledgement_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_safety_disclaimer_v1(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_active_safety_sessions_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_safety_checkin_v1(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_emergency_contacts_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_emergency_contact_v1(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_emergency_contact_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_booking_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_safety_preferences_v1(UUID) TO authenticated;

COMMIT;
