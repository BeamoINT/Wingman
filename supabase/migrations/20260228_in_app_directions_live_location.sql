BEGIN;

-- ---------------------------------------------------------------------------
-- Live location share sessions (ephemeral, conversation-scoped)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.live_location_shares (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stopped', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_location_shares_pkey PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT live_location_shares_not_self_expired CHECK (expires_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_live_location_shares_conversation
  ON public.live_location_shares(conversation_id, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_location_shares_user
  ON public.live_location_shares(user_id, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_location_shares_expires
  ON public.live_location_shares(expires_at);

-- ---------------------------------------------------------------------------
-- Live location points (single latest point per conversation/user)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.live_location_points (
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  heading_deg DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  captured_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_location_points_pkey PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT live_location_points_share_fkey
    FOREIGN KEY (conversation_id, user_id)
    REFERENCES public.live_location_shares(conversation_id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT live_location_points_latitude_check CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT live_location_points_longitude_check CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT live_location_points_accuracy_check CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  CONSTRAINT live_location_points_heading_check CHECK (
    heading_deg IS NULL
    OR (heading_deg >= 0 AND heading_deg <= 360)
  ),
  CONSTRAINT live_location_points_speed_check CHECK (speed_mps IS NULL OR speed_mps >= 0),
  CONSTRAINT live_location_points_expires_after_capture CHECK (expires_at >= captured_at)
);

CREATE INDEX IF NOT EXISTS idx_live_location_points_conversation
  ON public.live_location_points(conversation_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_location_points_expires
  ON public.live_location_points(expires_at);

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
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'trg_live_location_shares_updated_at'
    ) THEN
      CREATE TRIGGER trg_live_location_shares_updated_at
      BEFORE UPDATE ON public.live_location_shares
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'trg_live_location_points_updated_at'
    ) THEN
      CREATE TRIGGER trg_live_location_points_updated_at
      BEFORE UPDATE ON public.live_location_points
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_live_share_active(
  p_conversation_id UUID,
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
    FROM public.live_location_shares lls
    WHERE lls.conversation_id = p_conversation_id
      AND lls.user_id = p_user_id
      AND lls.status = 'active'
      AND lls.expires_at > NOW()
      AND (lls.stopped_at IS NULL)
  );
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_live_location_share_v1(
  p_conversation_id UUID,
  p_duration_minutes INTEGER DEFAULT 120
)
RETURNS public.live_location_shares
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  safe_duration_minutes INTEGER := LEAST(GREATEST(COALESCE(p_duration_minutes, 120), 5), 240);
  share_row public.live_location_shares;
  expires_at_value TIMESTAMPTZ := NOW() + make_interval(mins => safe_duration_minutes);
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Conversation ID is required';
  END IF;

  IF NOT public.is_conversation_member(p_conversation_id, current_user_id, TRUE) THEN
    RAISE EXCEPTION 'Conversation access denied';
  END IF;

  INSERT INTO public.live_location_shares (
    conversation_id,
    user_id,
    status,
    started_at,
    expires_at,
    stopped_at,
    last_heartbeat_at,
    created_at,
    updated_at
  ) VALUES (
    p_conversation_id,
    current_user_id,
    'active',
    NOW(),
    expires_at_value,
    NULL,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    status = 'active',
    started_at = CASE
      WHEN live_location_shares.status = 'active'
        AND live_location_shares.expires_at > NOW()
      THEN live_location_shares.started_at
      ELSE NOW()
    END,
    expires_at = EXCLUDED.expires_at,
    stopped_at = NULL,
    last_heartbeat_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO share_row;

  DELETE FROM public.live_location_points llp
  WHERE llp.conversation_id = p_conversation_id
    AND llp.user_id = current_user_id
    AND llp.expires_at <= NOW();

  RETURN share_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.stop_live_location_share_v1(
  p_conversation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  affected_count INTEGER := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Conversation ID is required';
  END IF;

  UPDATE public.live_location_shares
  SET
    status = CASE WHEN status = 'expired' THEN 'expired' ELSE 'stopped' END,
    stopped_at = COALESCE(stopped_at, NOW()),
    updated_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND user_id = current_user_id;

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  DELETE FROM public.live_location_points
  WHERE conversation_id = p_conversation_id
    AND user_id = current_user_id;

  RETURN affected_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_live_location_point_v1(
  p_conversation_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_accuracy_m DOUBLE PRECISION,
  p_heading_deg DOUBLE PRECISION,
  p_speed_mps DOUBLE PRECISION,
  p_captured_at TIMESTAMPTZ
)
RETURNS public.live_location_points
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  share_row public.live_location_shares;
  point_row public.live_location_points;
  now_ts TIMESTAMPTZ := NOW();
  normalized_captured_at TIMESTAMPTZ := COALESCE(p_captured_at, now_ts);
  expires_at_value TIMESTAMPTZ;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Conversation ID is required';
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

  IF NOT public.is_conversation_member(p_conversation_id, current_user_id, TRUE) THEN
    RAISE EXCEPTION 'Conversation access denied';
  END IF;

  SELECT *
  INTO share_row
  FROM public.live_location_shares
  WHERE conversation_id = p_conversation_id
    AND user_id = current_user_id
  FOR UPDATE;

  IF share_row.conversation_id IS NULL THEN
    RAISE EXCEPTION 'Live location sharing is not active';
  END IF;

  IF share_row.status <> 'active' OR share_row.expires_at <= now_ts THEN
    UPDATE public.live_location_shares
    SET
      status = CASE
        WHEN status = 'active' AND expires_at <= now_ts THEN 'expired'
        ELSE status
      END,
      stopped_at = COALESCE(stopped_at, CASE WHEN expires_at <= now_ts THEN now_ts ELSE stopped_at END),
      updated_at = now_ts
    WHERE conversation_id = p_conversation_id
      AND user_id = current_user_id;

    RAISE EXCEPTION 'Live location sharing is not active';
  END IF;

  -- Basic write-throttle for abuse control.
  SELECT *
  INTO point_row
  FROM public.live_location_points
  WHERE conversation_id = p_conversation_id
    AND user_id = current_user_id;

  IF point_row.conversation_id IS NOT NULL
     AND point_row.updated_at > now_ts - INTERVAL '2 seconds' THEN
    UPDATE public.live_location_shares
    SET
      last_heartbeat_at = now_ts,
      updated_at = now_ts
    WHERE conversation_id = p_conversation_id
      AND user_id = current_user_id;

    RETURN point_row;
  END IF;

  IF normalized_captured_at < now_ts - INTERVAL '10 minutes'
     OR normalized_captured_at > now_ts + INTERVAL '2 minutes' THEN
    normalized_captured_at := now_ts;
  END IF;

  expires_at_value := LEAST(share_row.expires_at, now_ts + INTERVAL '2 minutes');

  INSERT INTO public.live_location_points (
    conversation_id,
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
    p_conversation_id,
    current_user_id,
    p_lat,
    p_lng,
    p_accuracy_m,
    p_heading_deg,
    p_speed_mps,
    normalized_captured_at,
    expires_at_value,
    now_ts
  )
  ON CONFLICT (conversation_id, user_id)
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

  UPDATE public.live_location_shares
  SET
    last_heartbeat_at = now_ts,
    updated_at = now_ts
  WHERE conversation_id = p_conversation_id
    AND user_id = current_user_id;

  RETURN point_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_live_location_points_v1(
  p_conversation_id UUID
)
RETURNS SETOF public.live_location_points
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

  IF p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Conversation ID is required';
  END IF;

  IF NOT public.is_conversation_member(p_conversation_id, current_user_id, TRUE) THEN
    RAISE EXCEPTION 'Conversation access denied';
  END IF;

  IF NOT public.is_live_share_active(p_conversation_id, current_user_id) THEN
    RAISE EXCEPTION 'Live location sharing is required to view other locations';
  END IF;

  RETURN QUERY
  SELECT llp.*
  FROM public.live_location_points llp
  JOIN public.live_location_shares lls
    ON lls.conversation_id = llp.conversation_id
   AND lls.user_id = llp.user_id
  WHERE llp.conversation_id = p_conversation_id
    AND llp.expires_at > NOW()
    AND lls.status = 'active'
    AND lls.expires_at > NOW()
    AND lls.stopped_at IS NULL
  ORDER BY llp.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_active_live_location_shares_v1()
RETURNS SETOF public.live_location_shares
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lls.*
  FROM public.live_location_shares lls
  WHERE lls.user_id = auth.uid()
    AND lls.status = 'active'
    AND lls.expires_at > NOW()
    AND lls.stopped_at IS NULL
  ORDER BY lls.expires_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.expire_live_location_state_v1()
RETURNS TABLE (
  expired_shares_count INTEGER,
  deleted_points_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_shares INTEGER := 0;
  v_deleted_points INTEGER := 0;
BEGIN
  UPDATE public.live_location_shares
  SET
    status = 'expired',
    stopped_at = COALESCE(stopped_at, NOW()),
    updated_at = NOW()
  WHERE status = 'active'
    AND expires_at <= NOW();

  GET DIAGNOSTICS v_expired_shares = ROW_COUNT;

  DELETE FROM public.live_location_points llp
  WHERE llp.expires_at <= NOW()
     OR NOT EXISTS (
       SELECT 1
       FROM public.live_location_shares lls
       WHERE lls.conversation_id = llp.conversation_id
         AND lls.user_id = llp.user_id
         AND lls.status = 'active'
         AND lls.expires_at > NOW()
         AND lls.stopped_at IS NULL
     );

  GET DIAGNOSTICS v_deleted_points = ROW_COUNT;

  RETURN QUERY
  SELECT v_expired_shares, v_deleted_points;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.live_location_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_location_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Live location shares select own v1" ON public.live_location_shares;
CREATE POLICY "Live location shares select own v1"
ON public.live_location_shares
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Live location shares insert own v1" ON public.live_location_shares;
CREATE POLICY "Live location shares insert own v1"
ON public.live_location_shares
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.is_conversation_member(conversation_id, auth.uid(), TRUE)
);

DROP POLICY IF EXISTS "Live location shares update own v1" ON public.live_location_shares;
CREATE POLICY "Live location shares update own v1"
ON public.live_location_shares
FOR UPDATE
USING (
  auth.uid() = user_id
  AND public.is_conversation_member(conversation_id, auth.uid(), TRUE)
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_conversation_member(conversation_id, auth.uid(), TRUE)
);

DROP POLICY IF EXISTS "Live location shares delete own v1" ON public.live_location_shares;
CREATE POLICY "Live location shares delete own v1"
ON public.live_location_shares
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Live location points select opted-in sharers v1" ON public.live_location_points;
CREATE POLICY "Live location points select opted-in sharers v1"
ON public.live_location_points
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.is_conversation_member(conversation_id, auth.uid(), TRUE)
  AND public.is_live_share_active(conversation_id, auth.uid())
  AND public.is_live_share_active(conversation_id, user_id)
  AND expires_at > NOW()
);

DROP POLICY IF EXISTS "Live location points insert own active share v1" ON public.live_location_points;
CREATE POLICY "Live location points insert own active share v1"
ON public.live_location_points
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.is_conversation_member(conversation_id, auth.uid(), TRUE)
  AND public.is_live_share_active(conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "Live location points update own active share v1" ON public.live_location_points;
CREATE POLICY "Live location points update own active share v1"
ON public.live_location_points
FOR UPDATE
USING (
  auth.uid() = user_id
  AND public.is_conversation_member(conversation_id, auth.uid(), TRUE)
  AND public.is_live_share_active(conversation_id, auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_conversation_member(conversation_id, auth.uid(), TRUE)
  AND public.is_live_share_active(conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "Live location points delete own v1" ON public.live_location_points;
CREATE POLICY "Live location points delete own v1"
ON public.live_location_points
FOR DELETE
USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Grants + realtime publication
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_location_shares TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_location_points TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_live_share_active(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_live_location_share_v1(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_live_location_share_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_live_location_point_v1(
  UUID,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TIMESTAMPTZ
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_live_location_points_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_active_live_location_shares_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_live_location_state_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_live_location_state_v1() TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.live_location_points;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.live_location_shares;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END IF;
END
$$;

COMMIT;
