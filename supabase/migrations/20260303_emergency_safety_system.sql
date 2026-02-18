BEGIN;

-- ---------------------------------------------------------------------------
-- Booking schedule columns for safety timing
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.bookings
  ADD COLUMN IF NOT EXISTS booking_timezone TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ;

UPDATE public.bookings
SET booking_timezone = COALESCE(NULLIF(TRIM(booking_timezone), ''), 'UTC')
WHERE booking_timezone IS NULL
   OR NULLIF(TRIM(booking_timezone), '') IS NULL;

ALTER TABLE IF EXISTS public.bookings
  ALTER COLUMN booking_timezone SET DEFAULT 'UTC';

CREATE OR REPLACE FUNCTION public.compute_booking_schedule_v1(
  p_date DATE,
  p_start_time TIME,
  p_duration_hours INTEGER,
  p_timezone TEXT
)
RETURNS TABLE (
  scheduled_start_at TIMESTAMPTZ,
  scheduled_end_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tz TEXT := COALESCE(NULLIF(TRIM(p_timezone), ''), 'UTC');
  local_start TIMESTAMP;
  safe_duration_hours INTEGER := GREATEST(COALESCE(p_duration_hours, 1), 1);
BEGIN
  IF p_date IS NULL OR p_start_time IS NULL THEN
    RETURN QUERY
    SELECT NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  BEGIN
    PERFORM NOW() AT TIME ZONE tz;
  EXCEPTION
    WHEN OTHERS THEN
      tz := 'UTC';
  END;

  local_start := (p_date::TEXT || ' ' || p_start_time::TEXT)::TIMESTAMP;

  RETURN QUERY
  SELECT
    (local_start AT TIME ZONE tz),
    ((local_start + make_interval(hours => safe_duration_hours)) AT TIME ZONE tz);
END;
$$;

CREATE OR REPLACE FUNCTION public.enrich_booking_schedule_columns_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  computed RECORD;
BEGIN
  NEW.booking_timezone := COALESCE(NULLIF(TRIM(NEW.booking_timezone), ''), 'UTC');

  SELECT *
  INTO computed
  FROM public.compute_booking_schedule_v1(
    NEW.date,
    NEW.start_time,
    NEW.duration_hours,
    NEW.booking_timezone
  );

  NEW.scheduled_start_at := computed.scheduled_start_at;
  NEW.scheduled_end_at := computed.scheduled_end_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrich_booking_schedule_columns_v1 ON public.bookings;
CREATE TRIGGER trg_enrich_booking_schedule_columns_v1
  BEFORE INSERT OR UPDATE OF date, start_time, duration_hours, booking_timezone
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enrich_booking_schedule_columns_v1();

UPDATE public.bookings b
SET
  booking_timezone = COALESCE(NULLIF(TRIM(b.booking_timezone), ''), 'UTC'),
  scheduled_start_at = schedule_values.scheduled_start_at,
  scheduled_end_at = schedule_values.scheduled_end_at
FROM public.compute_booking_schedule_v1(
  b.date,
  b.start_time,
  b.duration_hours,
  COALESCE(NULLIF(TRIM(b.booking_timezone), ''), 'UTC')
) AS schedule_values
WHERE b.date IS NOT NULL
  AND b.start_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_start_at
  ON public.bookings(scheduled_start_at);

CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_end_at
  ON public.bookings(scheduled_end_at);

-- ---------------------------------------------------------------------------
-- Emergency contacts + safety settings
-- ---------------------------------------------------------------------------

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_contacts_user_phone_unique
  ON public.emergency_contacts(user_id, phone_e164);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user
  ON public.emergency_contacts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.safety_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkins_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  checkin_interval_minutes INTEGER NOT NULL DEFAULT 30,
  checkin_response_window_minutes INTEGER NOT NULL DEFAULT 10,
  sos_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_share_live_location BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT safety_preferences_interval_check CHECK (checkin_interval_minutes BETWEEN 5 AND 180),
  CONSTRAINT safety_preferences_response_window_check CHECK (checkin_response_window_minutes BETWEEN 1 AND 60)
);

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

CREATE TABLE IF NOT EXISTS public.booking_safety_settings (
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkins_enabled_override BOOLEAN,
  checkin_interval_minutes_override INTEGER,
  checkin_response_window_minutes_override INTEGER,
  live_share_enabled_override BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_safety_settings_pkey PRIMARY KEY (booking_id, user_id),
  CONSTRAINT booking_safety_interval_override_check CHECK (
    checkin_interval_minutes_override IS NULL
    OR checkin_interval_minutes_override BETWEEN 5 AND 180
  ),
  CONSTRAINT booking_safety_response_override_check CHECK (
    checkin_response_window_minutes_override IS NULL
    OR checkin_response_window_minutes_override BETWEEN 1 AND 60
  )
);

CREATE INDEX IF NOT EXISTS idx_booking_safety_settings_user
  ON public.booking_safety_settings(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Safety sessions + check-ins
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.safety_monitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled',
  checkin_interval_minutes INTEGER NOT NULL,
  response_window_minutes INTEGER NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_safety_monitor_sessions_user_status
  ON public.safety_monitor_sessions(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_safety_monitor_sessions_next_checkin
  ON public.safety_monitor_sessions(next_checkin_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.safety_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.safety_monitor_sessions(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  respond_by TIMESTAMPTZ NOT NULL,
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
  ),
  CONSTRAINT safety_checkins_deadline_check CHECK (respond_by >= scheduled_for)
);

CREATE INDEX IF NOT EXISTS idx_safety_checkins_user_status
  ON public.safety_checkins(user_id, status, respond_by ASC);

CREATE INDEX IF NOT EXISTS idx_safety_checkins_pending_deadline
  ON public.safety_checkins(respond_by)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Emergency alert event logging
-- ---------------------------------------------------------------------------

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT emergency_alert_events_source_check CHECK (
    source IN ('sos_button', 'checkin_unsafe', 'checkin_timeout', 'live_location_started', 'manual')
  ),
  CONSTRAINT emergency_alert_events_lat_check CHECK (
    location_latitude IS NULL OR (location_latitude >= -90 AND location_latitude <= 90)
  ),
  CONSTRAINT emergency_alert_events_lng_check CHECK (
    location_longitude IS NULL OR (location_longitude >= -180 AND location_longitude <= 180)
  ),
  CONSTRAINT emergency_alert_events_accuracy_check CHECK (
    location_accuracy_m IS NULL OR location_accuracy_m >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_emergency_alert_events_user
  ON public.emergency_alert_events(user_id, created_at DESC);

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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT emergency_alert_dispatches_channel_check CHECK (channel IN ('sms')),
  CONSTRAINT emergency_alert_dispatches_status_check CHECK (status IN ('queued', 'sent', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_alert_dispatches_dedupe
  ON public.emergency_alert_dispatches(alert_event_id, phone_e164, channel);

CREATE INDEX IF NOT EXISTS idx_emergency_alert_dispatches_contact
  ON public.emergency_alert_dispatches(contact_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Emergency live location sharing for external emergency contacts
-- ---------------------------------------------------------------------------

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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT emergency_live_location_shares_status_check CHECK (status IN ('active', 'stopped', 'expired')),
  CONSTRAINT emergency_live_location_shares_expiry_check CHECK (expires_at > started_at),
  CONSTRAINT emergency_live_location_shares_unique_booking_user UNIQUE (booking_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_emergency_live_location_shares_booking
  ON public.emergency_live_location_shares(booking_id, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_live_location_shares_user
  ON public.emergency_live_location_shares(user_id, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_live_location_shares_expires
  ON public.emergency_live_location_shares(expires_at);

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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT emergency_live_location_points_lat_check CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT emergency_live_location_points_lng_check CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT emergency_live_location_points_accuracy_check CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  CONSTRAINT emergency_live_location_points_heading_check CHECK (
    heading_deg IS NULL OR (heading_deg >= 0 AND heading_deg <= 360)
  ),
  CONSTRAINT emergency_live_location_points_speed_check CHECK (speed_mps IS NULL OR speed_mps >= 0),
  CONSTRAINT emergency_live_location_points_expiry_check CHECK (expires_at >= captured_at)
);

CREATE INDEX IF NOT EXISTS idx_emergency_live_location_points_booking
  ON public.emergency_live_location_points(booking_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_live_location_points_expires
  ON public.emergency_live_location_points(expires_at);

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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT emergency_live_location_view_tokens_status_check CHECK (status IN ('active', 'revoked', 'expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_live_location_tokens_hash
  ON public.emergency_live_location_view_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_emergency_live_location_tokens_share
  ON public.emergency_live_location_view_tokens(share_id, status, expires_at DESC);

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
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_emergency_contacts_updated_at') THEN
      CREATE TRIGGER trg_emergency_contacts_updated_at
        BEFORE UPDATE ON public.emergency_contacts
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_safety_preferences_updated_at') THEN
      CREATE TRIGGER trg_safety_preferences_updated_at
        BEFORE UPDATE ON public.safety_preferences
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_safety_feature_acknowledgements_updated_at') THEN
      CREATE TRIGGER trg_safety_feature_acknowledgements_updated_at
        BEFORE UPDATE ON public.safety_feature_acknowledgements
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_booking_safety_settings_updated_at') THEN
      CREATE TRIGGER trg_booking_safety_settings_updated_at
        BEFORE UPDATE ON public.booking_safety_settings
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_safety_monitor_sessions_updated_at') THEN
      CREATE TRIGGER trg_safety_monitor_sessions_updated_at
        BEFORE UPDATE ON public.safety_monitor_sessions
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_safety_checkins_updated_at') THEN
      CREATE TRIGGER trg_safety_checkins_updated_at
        BEFORE UPDATE ON public.safety_checkins
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_emergency_alert_dispatches_updated_at') THEN
      CREATE TRIGGER trg_emergency_alert_dispatches_updated_at
        BEFORE UPDATE ON public.emergency_alert_dispatches
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_emergency_live_location_shares_updated_at') THEN
      CREATE TRIGGER trg_emergency_live_location_shares_updated_at
        BEFORE UPDATE ON public.emergency_live_location_shares
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_emergency_live_location_points_updated_at') THEN
      CREATE TRIGGER trg_emergency_live_location_points_updated_at
        BEFORE UPDATE ON public.emergency_live_location_points
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_emergency_live_location_tokens_updated_at') THEN
      CREATE TRIGGER trg_emergency_live_location_tokens_updated_at
        BEFORE UPDATE ON public.emergency_live_location_view_tokens
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Helper functions
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

CREATE OR REPLACE FUNCTION public.get_booking_counterparty(
  p_booking_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN b.client_id = p_user_id THEN c.user_id
    WHEN c.user_id = p_user_id THEN b.client_id
    ELSE NULL
  END
  FROM public.bookings b
  JOIN public.companions c
    ON c.id = b.companion_id
  WHERE b.id = p_booking_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_booking_active_for_safety(
  p_booking_id UUID,
  p_now TIMESTAMPTZ DEFAULT NOW()
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
    WHERE b.id = p_booking_id
      AND COALESCE(b.status, 'pending') IN ('pending', 'confirmed', 'in_progress')
      AND (
        b.scheduled_start_at IS NULL
        OR p_now >= b.scheduled_start_at
      )
      AND (
        b.scheduled_end_at IS NULL
        OR p_now <= b.scheduled_end_at + INTERVAL '2 hours'
      )
  );
$$;

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
  INSERT INTO public.safety_preferences (
    user_id,
    checkins_enabled,
    checkin_interval_minutes,
    checkin_response_window_minutes,
    sos_enabled,
    auto_share_live_location,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    TRUE,
    30,
    10,
    TRUE,
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
    SELECT auth.uid() AS current_user_id
  ) current_user
  LEFT JOIN public.safety_feature_acknowledgements sfa
    ON sfa.user_id = current_user.current_user_id;
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
-- Emergency contact RPCs
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Safety preferences + booking settings RPCs
-- ---------------------------------------------------------------------------

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

CREATE OR REPLACE FUNCTION public.upsert_booking_safety_settings_v1(
  p_booking_id UUID,
  p_checkins_enabled_override BOOLEAN DEFAULT NULL,
  p_checkin_interval_minutes_override INTEGER DEFAULT NULL,
  p_checkin_response_window_minutes_override INTEGER DEFAULT NULL,
  p_live_share_enabled_override BOOLEAN DEFAULT NULL
)
RETURNS public.booking_safety_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result_row public.booking_safety_settings;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking ID is required';
  END IF;

  IF NOT public.is_booking_participant(p_booking_id, current_user_id) THEN
    RAISE EXCEPTION 'Booking access denied';
  END IF;

  INSERT INTO public.booking_safety_settings (
    booking_id,
    user_id,
    checkins_enabled_override,
    checkin_interval_minutes_override,
    checkin_response_window_minutes_override,
    live_share_enabled_override,
    created_at,
    updated_at
  ) VALUES (
    p_booking_id,
    current_user_id,
    p_checkins_enabled_override,
    p_checkin_interval_minutes_override,
    p_checkin_response_window_minutes_override,
    p_live_share_enabled_override,
    NOW(),
    NOW()
  )
  ON CONFLICT (booking_id, user_id)
  DO UPDATE SET
    checkins_enabled_override = EXCLUDED.checkins_enabled_override,
    checkin_interval_minutes_override = EXCLUDED.checkin_interval_minutes_override,
    checkin_response_window_minutes_override = EXCLUDED.checkin_response_window_minutes_override,
    live_share_enabled_override = EXCLUDED.live_share_enabled_override,
    updated_at = NOW()
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Safety session + check-in RPCs
-- ---------------------------------------------------------------------------

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
    status = CASE
      WHEN normalized_response = 'safe' THEN 'safe'
      ELSE 'unsafe'
    END,
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

-- ---------------------------------------------------------------------------
-- Emergency live location RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_emergency_live_location_share_v1(
  p_booking_id UUID,
  p_duration_minutes INTEGER DEFAULT 120
)
RETURNS public.emergency_live_location_shares
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  safe_duration_minutes INTEGER := LEAST(GREATEST(COALESCE(p_duration_minutes, 120), 10), 240);
  booking_status TEXT;
  booking_start TIMESTAMPTZ;
  booking_end TIMESTAMPTZ;
  computed_expires_at TIMESTAMPTZ;
  share_row public.emergency_live_location_shares;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking ID is required';
  END IF;

  IF NOT public.is_booking_participant(p_booking_id, current_user_id) THEN
    RAISE EXCEPTION 'Booking access denied';
  END IF;

  SELECT
    COALESCE(b.status, 'pending'),
    b.scheduled_start_at,
    b.scheduled_end_at
  INTO
    booking_status,
    booking_start,
    booking_end
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF booking_status IN ('cancelled', 'disputed', 'completed') THEN
    RAISE EXCEPTION 'Booking is not active for safety sharing';
  END IF;

  IF booking_start IS NOT NULL AND booking_start > NOW() THEN
    RAISE EXCEPTION 'Safety sharing starts when the booking begins';
  END IF;

  IF booking_end IS NOT NULL AND booking_end <= NOW() THEN
    RAISE EXCEPTION 'Booking has ended. Extend an active share before ending if additional sharing is needed.';
  END IF;

  computed_expires_at := NOW() + make_interval(mins => safe_duration_minutes);
  IF booking_end IS NOT NULL THEN
    computed_expires_at := LEAST(computed_expires_at, booking_end);
  END IF;

  INSERT INTO public.emergency_live_location_shares (
    booking_id,
    user_id,
    status,
    started_at,
    expires_at,
    stopped_at,
    last_heartbeat_at,
    created_at,
    updated_at
  ) VALUES (
    p_booking_id,
    current_user_id,
    'active',
    NOW(),
    computed_expires_at,
    NULL,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (booking_id, user_id)
  DO UPDATE SET
    status = 'active',
    started_at = CASE
      WHEN emergency_live_location_shares.status = 'active'
        AND emergency_live_location_shares.expires_at > NOW()
      THEN emergency_live_location_shares.started_at
      ELSE NOW()
    END,
    expires_at = EXCLUDED.expires_at,
    stopped_at = NULL,
    last_heartbeat_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO share_row;

  DELETE FROM public.emergency_live_location_points elp
  WHERE elp.share_id = share_row.id
    AND elp.expires_at <= NOW();

  RETURN share_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.stop_emergency_live_location_share_v1(
  p_booking_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  share_row public.emergency_live_location_shares;
  affected_rows INTEGER := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO share_row
  FROM public.emergency_live_location_shares
  WHERE booking_id = p_booking_id
    AND user_id = current_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.emergency_live_location_shares
  SET
    status = CASE WHEN status = 'expired' THEN 'expired' ELSE 'stopped' END,
    stopped_at = COALESCE(stopped_at, NOW()),
    updated_at = NOW()
  WHERE id = share_row.id;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  DELETE FROM public.emergency_live_location_points
  WHERE share_id = share_row.id;

  UPDATE public.emergency_live_location_view_tokens
  SET
    status = 'revoked',
    revoked_at = COALESCE(revoked_at, NOW()),
    updated_at = NOW()
  WHERE share_id = share_row.id
    AND status = 'active';

  RETURN affected_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.extend_emergency_live_location_share_v1(
  p_booking_id UUID,
  p_extension_minutes INTEGER DEFAULT 30
)
RETURNS public.emergency_live_location_shares
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  share_row public.emergency_live_location_shares;
  booking_end TIMESTAMPTZ;
  capped_extension INTEGER := LEAST(GREATEST(COALESCE(p_extension_minutes, 30), 5), 120);
  target_expiry TIMESTAMPTZ;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO share_row
  FROM public.emergency_live_location_shares
  WHERE booking_id = p_booking_id
    AND user_id = current_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found';
  END IF;

  SELECT b.scheduled_end_at
  INTO booking_end
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  target_expiry := GREATEST(share_row.expires_at, NOW()) + make_interval(mins => capped_extension);

  IF booking_end IS NOT NULL THEN
    target_expiry := LEAST(target_expiry, booking_end + INTERVAL '4 hours');
  END IF;

  UPDATE public.emergency_live_location_shares
  SET
    status = 'active',
    expires_at = target_expiry,
    stopped_at = NULL,
    updated_at = NOW()
  WHERE id = share_row.id
  RETURNING * INTO share_row;

  UPDATE public.emergency_live_location_view_tokens
  SET
    expires_at = LEAST(target_expiry, expires_at + make_interval(mins => capped_extension)),
    status = CASE
      WHEN status = 'expired' AND expires_at > NOW() THEN 'active'
      ELSE status
    END,
    updated_at = NOW()
  WHERE share_id = share_row.id;

  RETURN share_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_emergency_live_location_point_v1(
  p_booking_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_accuracy_m DOUBLE PRECISION DEFAULT NULL,
  p_heading_deg DOUBLE PRECISION DEFAULT NULL,
  p_speed_mps DOUBLE PRECISION DEFAULT NULL,
  p_captured_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.emergency_live_location_points
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  share_row public.emergency_live_location_shares;
  point_row public.emergency_live_location_points;
  now_ts TIMESTAMPTZ := NOW();
  normalized_captured_at TIMESTAMPTZ := COALESCE(p_captured_at, now_ts);
  computed_expires_at TIMESTAMPTZ;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking ID is required';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'Latitude and longitude are required';
  END IF;

  IF p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'Invalid coordinate range';
  END IF;

  IF p_accuracy_m IS NOT NULL AND p_accuracy_m < 0 THEN
    RAISE EXCEPTION 'Invalid accuracy value';
  END IF;

  IF p_heading_deg IS NOT NULL AND (p_heading_deg < 0 OR p_heading_deg > 360) THEN
    RAISE EXCEPTION 'Invalid heading value';
  END IF;

  IF p_speed_mps IS NOT NULL AND p_speed_mps < 0 THEN
    RAISE EXCEPTION 'Invalid speed value';
  END IF;

  SELECT *
  INTO share_row
  FROM public.emergency_live_location_shares
  WHERE booking_id = p_booking_id
    AND user_id = current_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emergency live location sharing is not active';
  END IF;

  IF share_row.status <> 'active' OR share_row.expires_at <= now_ts THEN
    UPDATE public.emergency_live_location_shares
    SET
      status = CASE WHEN expires_at <= now_ts THEN 'expired' ELSE status END,
      stopped_at = COALESCE(stopped_at, CASE WHEN expires_at <= now_ts THEN now_ts ELSE stopped_at END),
      updated_at = now_ts
    WHERE id = share_row.id;

    RAISE EXCEPTION 'Emergency live location sharing is not active';
  END IF;

  SELECT *
  INTO point_row
  FROM public.emergency_live_location_points
  WHERE share_id = share_row.id;

  IF point_row.share_id IS NOT NULL
     AND point_row.updated_at > now_ts - INTERVAL '2 seconds' THEN
    UPDATE public.emergency_live_location_shares
    SET
      last_heartbeat_at = now_ts,
      updated_at = now_ts
    WHERE id = share_row.id;

    RETURN point_row;
  END IF;

  IF normalized_captured_at < now_ts - INTERVAL '10 minutes'
     OR normalized_captured_at > now_ts + INTERVAL '2 minutes' THEN
    normalized_captured_at := now_ts;
  END IF;

  computed_expires_at := LEAST(share_row.expires_at, now_ts + INTERVAL '2 minutes');

  INSERT INTO public.emergency_live_location_points (
    share_id,
    booking_id,
    user_id,
    latitude,
    longitude,
    accuracy_m,
    heading_deg,
    speed_mps,
    captured_at,
    expires_at,
    updated_at
  ) VALUES (
    share_row.id,
    share_row.booking_id,
    share_row.user_id,
    p_lat,
    p_lng,
    p_accuracy_m,
    p_heading_deg,
    p_speed_mps,
    normalized_captured_at,
    computed_expires_at,
    now_ts
  )
  ON CONFLICT (share_id)
  DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    accuracy_m = EXCLUDED.accuracy_m,
    heading_deg = EXCLUDED.heading_deg,
    speed_mps = EXCLUDED.speed_mps,
    captured_at = EXCLUDED.captured_at,
    expires_at = EXCLUDED.expires_at,
    updated_at = now_ts
  RETURNING * INTO point_row;

  UPDATE public.emergency_live_location_shares
  SET
    last_heartbeat_at = now_ts,
    updated_at = now_ts
  WHERE id = share_row.id;

  RETURN point_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_emergency_safety_state_v1()
RETURNS TABLE (
  activated_sessions_count INTEGER,
  created_checkins_count INTEGER,
  timeout_escalations_count INTEGER,
  expired_shares_count INTEGER,
  deleted_points_count INTEGER,
  revoked_tokens_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activated_sessions INTEGER := 0;
  v_created_checkins INTEGER := 0;
  v_timeout_escalations INTEGER := 0;
  v_expired_shares INTEGER := 0;
  v_deleted_points INTEGER := 0;
  v_revoked_tokens INTEGER := 0;
BEGIN
  -- Ensure defaults exist for known users who already have active bookings.
  INSERT INTO public.safety_preferences (user_id, created_at, updated_at)
  SELECT DISTINCT b.client_id, NOW(), NOW()
  FROM public.bookings b
  WHERE b.client_id IS NOT NULL
  ON CONFLICT (user_id) DO NOTHING;

  -- Auto-create/refresh safety monitor sessions for upcoming/active bookings.
  INSERT INTO public.safety_monitor_sessions (
    booking_id,
    user_id,
    status,
    checkin_interval_minutes,
    response_window_minutes,
    started_at,
    ended_at,
    next_checkin_at,
    escalation_reason,
    last_escalated_at,
    created_at,
    updated_at
  )
  SELECT
    b.id,
    b.client_id,
    CASE
      WHEN b.scheduled_start_at IS NOT NULL AND b.scheduled_start_at <= NOW() THEN 'active'
      ELSE 'scheduled'
    END,
    COALESCE(bss.checkin_interval_minutes_override, sp.checkin_interval_minutes, 30),
    COALESCE(bss.checkin_response_window_minutes_override, sp.checkin_response_window_minutes, 10),
    CASE
      WHEN b.scheduled_start_at IS NOT NULL AND b.scheduled_start_at <= NOW() THEN NOW()
      ELSE NULL
    END,
    NULL,
    CASE
      WHEN COALESCE(bss.checkins_enabled_override, sp.checkins_enabled, TRUE)
        AND b.scheduled_start_at IS NOT NULL
        AND b.scheduled_start_at <= NOW()
      THEN NOW() + make_interval(mins => COALESCE(bss.checkin_interval_minutes_override, sp.checkin_interval_minutes, 30))
      ELSE NULL
    END,
    NULL,
    NULL,
    NOW(),
    NOW()
  FROM public.bookings b
  JOIN public.safety_preferences sp
    ON sp.user_id = b.client_id
  LEFT JOIN public.booking_safety_settings bss
    ON bss.booking_id = b.id
   AND bss.user_id = b.client_id
  WHERE b.client_id IS NOT NULL
    AND COALESCE(b.status, 'pending') IN ('pending', 'confirmed', 'in_progress')
    AND COALESCE(bss.checkins_enabled_override, sp.checkins_enabled, TRUE)
  ON CONFLICT (booking_id, user_id)
  DO UPDATE SET
    status = CASE
      WHEN safety_monitor_sessions.status IN ('completed', 'cancelled', 'expired') THEN safety_monitor_sessions.status
      WHEN EXCLUDED.status = 'active' THEN 'active'
      ELSE safety_monitor_sessions.status
    END,
    checkin_interval_minutes = EXCLUDED.checkin_interval_minutes,
    response_window_minutes = EXCLUDED.response_window_minutes,
    started_at = COALESCE(safety_monitor_sessions.started_at, EXCLUDED.started_at),
    next_checkin_at = CASE
      WHEN safety_monitor_sessions.status IN ('completed', 'cancelled', 'expired') THEN safety_monitor_sessions.next_checkin_at
      WHEN safety_monitor_sessions.status = 'scheduled' AND EXCLUDED.status = 'active' THEN NOW() + make_interval(mins => EXCLUDED.checkin_interval_minutes)
      ELSE safety_monitor_sessions.next_checkin_at
    END,
    updated_at = NOW();

  GET DIAGNOSTICS v_activated_sessions = ROW_COUNT;

  -- Disable check-ins for sessions where user turned check-ins off at account or booking level.
  UPDATE public.safety_monitor_sessions sms
  SET
    status = 'scheduled',
    next_checkin_at = NULL,
    updated_at = NOW()
  FROM public.bookings b
  JOIN public.safety_preferences sp
    ON sp.user_id = b.client_id
  LEFT JOIN public.booking_safety_settings bss
    ON bss.booking_id = b.id
   AND bss.user_id = b.client_id
  WHERE sms.booking_id = b.id
    AND sms.user_id = b.client_id
    AND sms.status IN ('scheduled', 'active')
    AND NOT COALESCE(bss.checkins_enabled_override, sp.checkins_enabled, TRUE);

  UPDATE public.safety_checkins sc
  SET
    status = 'dismissed',
    updated_at = NOW()
  WHERE sc.status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.safety_monitor_sessions sms
      WHERE sms.id = sc.session_id
        AND sms.status = 'scheduled'
        AND sms.next_checkin_at IS NULL
    );

  -- Close sessions for non-active bookings.
  UPDATE public.safety_monitor_sessions sms
  SET
    status = CASE
      WHEN b.status IN ('cancelled', 'disputed') THEN 'cancelled'
      WHEN b.status = 'completed' THEN 'completed'
      WHEN b.scheduled_end_at IS NOT NULL AND b.scheduled_end_at < NOW() THEN 'completed'
      ELSE sms.status
    END,
    ended_at = CASE
      WHEN b.status IN ('cancelled', 'disputed', 'completed')
        OR (b.scheduled_end_at IS NOT NULL AND b.scheduled_end_at < NOW())
      THEN COALESCE(sms.ended_at, NOW())
      ELSE sms.ended_at
    END,
    next_checkin_at = CASE
      WHEN b.status IN ('cancelled', 'disputed', 'completed')
        OR (b.scheduled_end_at IS NOT NULL AND b.scheduled_end_at < NOW())
      THEN NULL
      ELSE sms.next_checkin_at
    END,
    updated_at = NOW()
  FROM public.bookings b
  WHERE b.id = sms.booking_id
    AND sms.status IN ('scheduled', 'active')
    AND (
      b.status IN ('cancelled', 'disputed', 'completed')
      OR (b.scheduled_end_at IS NOT NULL AND b.scheduled_end_at < NOW())
    );

  -- Create pending check-ins when due.
  INSERT INTO public.safety_checkins (
    session_id,
    booking_id,
    user_id,
    scheduled_for,
    respond_by,
    status,
    created_at,
    updated_at
  )
  SELECT
    sms.id,
    sms.booking_id,
    sms.user_id,
    NOW(),
    NOW() + make_interval(mins => sms.response_window_minutes),
    'pending',
    NOW(),
    NOW()
  FROM public.safety_monitor_sessions sms
  WHERE sms.status = 'active'
    AND sms.next_checkin_at IS NOT NULL
    AND sms.next_checkin_at <= NOW()
    AND NOT EXISTS (
      SELECT 1
      FROM public.safety_checkins sc
      WHERE sc.session_id = sms.id
        AND sc.status = 'pending'
    );

  GET DIAGNOSTICS v_created_checkins = ROW_COUNT;

  UPDATE public.safety_monitor_sessions sms
  SET
    next_checkin_at = NOW() + make_interval(mins => sms.checkin_interval_minutes),
    updated_at = NOW()
  WHERE sms.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.safety_checkins sc
      WHERE sc.session_id = sms.id
        AND sc.status = 'pending'
        AND sc.created_at >= NOW() - INTERVAL '2 minutes'
    );

  -- Timeout stale pending check-ins.
  UPDATE public.safety_checkins sc
  SET
    status = 'timed_out',
    escalation_triggered = TRUE,
    escalation_source = 'timeout',
    updated_at = NOW()
  WHERE sc.status = 'pending'
    AND sc.respond_by <= NOW();

  GET DIAGNOSTICS v_timeout_escalations = ROW_COUNT;

  UPDATE public.safety_monitor_sessions sms
  SET
    escalation_reason = 'checkin_timeout',
    last_escalated_at = NOW(),
    updated_at = NOW()
  WHERE sms.id IN (
    SELECT DISTINCT sc.session_id
    FROM public.safety_checkins sc
    WHERE sc.status = 'timed_out'
      AND sc.updated_at >= NOW() - INTERVAL '2 minutes'
  );

  -- Expire shares and clean points/tokens.
  UPDATE public.emergency_live_location_shares
  SET
    status = 'expired',
    stopped_at = COALESCE(stopped_at, NOW()),
    updated_at = NOW()
  WHERE status = 'active'
    AND expires_at <= NOW();

  GET DIAGNOSTICS v_expired_shares = ROW_COUNT;

  DELETE FROM public.emergency_live_location_points elp
  WHERE elp.expires_at <= NOW()
     OR NOT EXISTS (
       SELECT 1
       FROM public.emergency_live_location_shares els
       WHERE els.id = elp.share_id
         AND els.status = 'active'
         AND els.expires_at > NOW()
     );

  GET DIAGNOSTICS v_deleted_points = ROW_COUNT;

  UPDATE public.emergency_live_location_view_tokens
  SET
    status = 'expired',
    updated_at = NOW()
  WHERE status = 'active'
    AND expires_at <= NOW();

  GET DIAGNOSTICS v_revoked_tokens = ROW_COUNT;

  RETURN QUERY
  SELECT
    v_activated_sessions,
    v_created_checkins,
    v_timeout_escalations,
    v_expired_shares,
    v_deleted_points,
    v_revoked_tokens;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_feature_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_safety_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_monitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_alert_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_live_location_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_live_location_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_live_location_view_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Emergency contacts select own v1" ON public.emergency_contacts;
CREATE POLICY "Emergency contacts select own v1"
ON public.emergency_contacts
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Emergency contacts insert own v1" ON public.emergency_contacts;
CREATE POLICY "Emergency contacts insert own v1"
ON public.emergency_contacts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Emergency contacts update own v1" ON public.emergency_contacts;
CREATE POLICY "Emergency contacts update own v1"
ON public.emergency_contacts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Emergency contacts delete own v1" ON public.emergency_contacts;
CREATE POLICY "Emergency contacts delete own v1"
ON public.emergency_contacts
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Safety preferences select own v1" ON public.safety_preferences;
CREATE POLICY "Safety preferences select own v1"
ON public.safety_preferences
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Safety preferences upsert own v1" ON public.safety_preferences;
CREATE POLICY "Safety preferences upsert own v1"
ON public.safety_preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Safety acknowledgement select own v1" ON public.safety_feature_acknowledgements;
CREATE POLICY "Safety acknowledgement select own v1"
ON public.safety_feature_acknowledgements
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Safety acknowledgement upsert own v1" ON public.safety_feature_acknowledgements;
CREATE POLICY "Safety acknowledgement upsert own v1"
ON public.safety_feature_acknowledgements
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Booking safety settings own participant v1" ON public.booking_safety_settings;
CREATE POLICY "Booking safety settings own participant v1"
ON public.booking_safety_settings
FOR ALL
USING (
  auth.uid() = user_id
  AND public.is_booking_participant(booking_id, auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_booking_participant(booking_id, auth.uid())
);

DROP POLICY IF EXISTS "Safety monitor sessions select own v1" ON public.safety_monitor_sessions;
CREATE POLICY "Safety monitor sessions select own v1"
ON public.safety_monitor_sessions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Safety checkins select own v1" ON public.safety_checkins;
CREATE POLICY "Safety checkins select own v1"
ON public.safety_checkins
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Safety checkins update own v1" ON public.safety_checkins;
CREATE POLICY "Safety checkins update own v1"
ON public.safety_checkins
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Emergency alert events select own v1" ON public.emergency_alert_events;
CREATE POLICY "Emergency alert events select own v1"
ON public.emergency_alert_events
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Emergency alert dispatches select own events v1" ON public.emergency_alert_dispatches;
CREATE POLICY "Emergency alert dispatches select own events v1"
ON public.emergency_alert_dispatches
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.emergency_alert_events eae
    WHERE eae.id = emergency_alert_dispatches.alert_event_id
      AND eae.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Emergency live shares select own v1" ON public.emergency_live_location_shares;
CREATE POLICY "Emergency live shares select own v1"
ON public.emergency_live_location_shares
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Emergency live shares mutate own v1" ON public.emergency_live_location_shares;
CREATE POLICY "Emergency live shares mutate own v1"
ON public.emergency_live_location_shares
FOR ALL
USING (
  auth.uid() = user_id
  AND public.is_booking_participant(booking_id, auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_booking_participant(booking_id, auth.uid())
);

DROP POLICY IF EXISTS "Emergency live points own share v1" ON public.emergency_live_location_points;
CREATE POLICY "Emergency live points own share v1"
ON public.emergency_live_location_points
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.emergency_live_location_shares els
    WHERE els.id = emergency_live_location_points.share_id
      AND els.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.emergency_live_location_shares els
    WHERE els.id = emergency_live_location_points.share_id
      AND els.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Emergency live tokens own share v1" ON public.emergency_live_location_view_tokens;
CREATE POLICY "Emergency live tokens own share v1"
ON public.emergency_live_location_view_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.emergency_live_location_shares els
    WHERE els.id = emergency_live_location_view_tokens.share_id
      AND els.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_feature_acknowledgements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_safety_settings TO authenticated;
GRANT SELECT, UPDATE ON public.safety_checkins TO authenticated;
GRANT SELECT ON public.safety_monitor_sessions TO authenticated;
GRANT SELECT ON public.emergency_alert_events TO authenticated;
GRANT SELECT ON public.emergency_alert_dispatches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_live_location_shares TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_live_location_points TO authenticated;
GRANT SELECT ON public.emergency_live_location_view_tokens TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_emergency_contacts_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_emergency_contact_v1(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_emergency_contact_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_safety_preferences_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_safety_acknowledgement_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_safety_disclaimer_v1(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_safety_preferences_v1(BOOLEAN, INTEGER, INTEGER, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_booking_safety_settings_v1(UUID, BOOLEAN, INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_active_safety_sessions_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_safety_checkin_v1(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_emergency_live_location_share_v1(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_emergency_live_location_share_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_emergency_live_location_share_v1(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_emergency_live_location_point_v1(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_emergency_safety_state_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_emergency_safety_state_v1() TO service_role;

-- ---------------------------------------------------------------------------
-- Realtime publication (emergency live points)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_live_location_points;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_live_location_shares;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END IF;
END
$$;

COMMIT;
