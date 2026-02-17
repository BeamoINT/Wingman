BEGIN;

-- ---------------------------------------------------------------------------
-- App-wide blocking primitives
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.friend_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friend_blocks_not_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT friend_blocks_pair_unique UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_blocks_blocker ON public.friend_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_friend_blocks_blocked ON public.friend_blocks(blocked_id);

ALTER TABLE public.friend_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view friend blocks" ON public.friend_blocks;
DROP POLICY IF EXISTS "Users can view own block list only" ON public.friend_blocks;
CREATE POLICY "Users can view own block list only"
ON public.friend_blocks
FOR SELECT
USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can insert own block records" ON public.friend_blocks;
CREATE POLICY "Users can insert own block records"
ON public.friend_blocks
FOR INSERT
WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can remove own block records" ON public.friend_blocks;
CREATE POLICY "Users can remove own block records"
ON public.friend_blocks
FOR DELETE
USING (auth.uid() = blocker_id);

CREATE OR REPLACE FUNCTION public.are_users_blocked(
  p_user_a UUID,
  p_user_b UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_a IS NULL OR p_user_b IS NULL THEN FALSE
    WHEN p_user_a = p_user_b THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM public.friend_blocks fb
      WHERE (fb.blocker_id = p_user_a AND fb.blocked_id = p_user_b)
         OR (fb.blocker_id = p_user_b AND fb.blocked_id = p_user_a)
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_users_interact(
  p_user_a UUID,
  p_user_b UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_a IS NULL OR p_user_b IS NULL THEN FALSE
    WHEN p_user_a = p_user_b THEN TRUE
    ELSE NOT public.are_users_blocked(p_user_a, p_user_b)
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_companion_user_id(p_companion_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.user_id
  FROM public.companions c
  WHERE c.id = p_companion_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_direct_conversation_blocked(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pair AS (
    SELECT ARRAY_AGG(participant_id ORDER BY participant_id) AS ids
    FROM (
      SELECT DISTINCT participant_id
      FROM (
        SELECT c.participant_1 AS participant_id
        FROM public.conversations c
        WHERE c.id = p_conversation_id
          AND COALESCE(c.kind, 'direct') = 'direct'

        UNION ALL

        SELECT c.participant_2 AS participant_id
        FROM public.conversations c
        WHERE c.id = p_conversation_id
          AND COALESCE(c.kind, 'direct') = 'direct'

        UNION ALL

        SELECT UNNEST(COALESCE(c.participant_ids, '{}'::UUID[])) AS participant_id
        FROM public.conversations c
        WHERE c.id = p_conversation_id
          AND COALESCE(c.kind, 'direct') = 'direct'
      ) raw_ids
      WHERE participant_id IS NOT NULL
      LIMIT 2
    ) normalized
  )
  SELECT CASE
    WHEN COALESCE(array_length(pair.ids, 1), 0) < 2 THEN FALSE
    ELSE public.are_users_blocked(pair.ids[1], pair.ids[2])
  END
  FROM pair;
$$;

CREATE OR REPLACE FUNCTION public.are_direct_participants_blocked(
  p_participant_ids UUID[],
  p_participant_1 UUID,
  p_participant_2 UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pair AS (
    SELECT ARRAY_AGG(participant_id ORDER BY participant_id) AS ids
    FROM (
      SELECT DISTINCT participant_id
      FROM (
        SELECT UNNEST(COALESCE(p_participant_ids, '{}'::UUID[])) AS participant_id
        UNION ALL
        SELECT p_participant_1 AS participant_id
        UNION ALL
        SELECT p_participant_2 AS participant_id
      ) raw_ids
      WHERE participant_id IS NOT NULL
      LIMIT 2
    ) normalized
  )
  SELECT CASE
    WHEN COALESCE(array_length(pair.ids, 1), 0) < 2 THEN FALSE
    ELSE public.are_users_blocked(pair.ids[1], pair.ids[2])
  END
  FROM pair;
$$;

-- ---------------------------------------------------------------------------
-- Profiles public view: hide blocked users from each other
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.bio,
  p.date_of_birth,
  p.gender,
  p.email_verified,
  p.phone_verified,
  p.id_verified,
  p.verification_level,
  p.subscription_tier,
  p.pro_status,
  p.message_encryption_public_key,
  p.message_encryption_key_version,
  p.message_encryption_updated_at,
  p.metro_area_id,
  p.metro_area_name,
  p.metro_city,
  p.metro_state,
  p.metro_country,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE auth.uid() IS NOT NULL
  AND (
    p.id = auth.uid()
    OR public.can_users_interact(auth.uid(), p.id)
  );

GRANT SELECT ON public.profiles_public TO authenticated;

-- ---------------------------------------------------------------------------
-- Conversation membership & direct-chat enforcement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_conversation_member(
  p_conversation_id UUID,
  p_user_id UUID,
  p_require_active BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.conversation_members cm
      JOIN public.conversations c
        ON c.id = cm.conversation_id
      WHERE cm.conversation_id = p_conversation_id
        AND cm.user_id = p_user_id
        AND (
          NOT p_require_active
          OR cm.left_at IS NULL
        )
        AND (
          c.kind <> 'direct'
          OR NOT public.is_direct_conversation_blocked(c.id)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = p_conversation_id
        AND (
          c.participant_1 = p_user_id
          OR c.participant_2 = p_user_id
        )
        AND (
          c.kind <> 'direct'
          OR NOT public.is_direct_conversation_blocked(c.id)
        )
    )
  );
$$;

DROP POLICY IF EXISTS "Conversations hide blocked direct chats v1" ON public.conversations;
CREATE POLICY "Conversations hide blocked direct chats v1"
ON public.conversations
AS RESTRICTIVE
FOR SELECT
USING (
  COALESCE(kind, 'direct') <> 'direct'
  OR NOT public.are_direct_participants_blocked(participant_ids, participant_1, participant_2)
);

DROP POLICY IF EXISTS "Conversations prevent blocked direct chat inserts v1" ON public.conversations;
CREATE POLICY "Conversations prevent blocked direct chat inserts v1"
ON public.conversations
AS RESTRICTIVE
FOR INSERT
WITH CHECK (
  COALESCE(kind, 'direct') <> 'direct'
  OR NOT public.are_direct_participants_blocked(participant_ids, participant_1, participant_2)
);

DROP POLICY IF EXISTS "Conversations prevent blocked direct chat updates v1" ON public.conversations;
CREATE POLICY "Conversations prevent blocked direct chat updates v1"
ON public.conversations
AS RESTRICTIVE
FOR UPDATE
USING (
  COALESCE(kind, 'direct') <> 'direct'
  OR NOT public.are_direct_participants_blocked(participant_ids, participant_1, participant_2)
)
WITH CHECK (
  COALESCE(kind, 'direct') <> 'direct'
  OR NOT public.are_direct_participants_blocked(participant_ids, participant_1, participant_2)
);

DROP POLICY IF EXISTS "Messages hide blocked direct chats v1" ON public.messages;
CREATE POLICY "Messages hide blocked direct chats v1"
ON public.messages
AS RESTRICTIVE
FOR SELECT
USING (NOT public.is_direct_conversation_blocked(conversation_id));

DROP POLICY IF EXISTS "Messages prevent send on blocked direct chats v1" ON public.messages;
CREATE POLICY "Messages prevent send on blocked direct chats v1"
ON public.messages
AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT public.is_direct_conversation_blocked(conversation_id));

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation_v2(p_other_user_id UUID)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  canonical_pair UUID[];
  resolved_conversation public.conversations;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_other_user_id IS NULL OR p_other_user_id = current_user_id THEN
    RAISE EXCEPTION 'Invalid conversation participant';
  END IF;

  IF public.are_users_blocked(current_user_id, p_other_user_id) THEN
    RAISE EXCEPTION 'Conversation unavailable';
  END IF;

  canonical_pair := ARRAY(
    SELECT value
    FROM UNNEST(ARRAY[current_user_id, p_other_user_id]) AS value
    ORDER BY value
  );

  PERFORM pg_advisory_xact_lock(hashtext(canonical_pair::TEXT));

  SELECT c.*
  INTO resolved_conversation
  FROM public.conversations c
  WHERE COALESCE(c.kind, 'direct') = 'direct'
    AND (
      (
        c.participant_ids @> canonical_pair
        AND COALESCE(ARRAY_LENGTH(c.participant_ids, 1), 0) = 2
      )
      OR (
        c.participant_1 IN (canonical_pair[1], canonical_pair[2])
        AND c.participant_2 IN (canonical_pair[1], canonical_pair[2])
      )
    )
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.conversations (
      participant_ids,
      kind,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      canonical_pair,
      'direct',
      current_user_id,
      NOW(),
      NOW()
    )
    RETURNING *
    INTO resolved_conversation;
  END IF;

  INSERT INTO public.conversation_members (
    conversation_id,
    user_id,
    role,
    joined_at,
    left_at
  )
  SELECT resolved_conversation.id, member_user_id, 'member', NOW(), NULL
  FROM UNNEST(canonical_pair) AS member_user_id
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    left_at = NULL,
    updated_at = NOW();

  RETURN resolved_conversation;
END;
$$;

-- ---------------------------------------------------------------------------
-- Booking hardening for blocked pairs
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Bookings hide blocked pairs v1" ON public.bookings;
CREATE POLICY "Bookings hide blocked pairs v1"
ON public.bookings
AS RESTRICTIVE
FOR SELECT
USING (
  client_id IS NULL
  OR companion_id IS NULL
  OR public.can_users_interact(client_id, public.get_companion_user_id(companion_id))
);

DROP POLICY IF EXISTS "Bookings prevent blocked pair inserts v1" ON public.bookings;
CREATE POLICY "Bookings prevent blocked pair inserts v1"
ON public.bookings
AS RESTRICTIVE
FOR INSERT
WITH CHECK (
  client_id IS NULL
  OR companion_id IS NULL
  OR public.can_users_interact(client_id, public.get_companion_user_id(companion_id))
);

DROP POLICY IF EXISTS "Bookings prevent blocked pair updates v1" ON public.bookings;
CREATE POLICY "Bookings prevent blocked pair updates v1"
ON public.bookings
AS RESTRICTIVE
FOR UPDATE
USING (
  client_id IS NULL
  OR companion_id IS NULL
  OR public.can_users_interact(client_id, public.get_companion_user_id(companion_id))
)
WITH CHECK (
  client_id IS NULL
  OR companion_id IS NULL
  OR public.can_users_interact(client_id, public.get_companion_user_id(companion_id))
);

CREATE OR REPLACE FUNCTION public.create_booking_with_meetup_v1(
  p_companion_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_duration_hours INTEGER,
  p_hourly_rate NUMERIC,
  p_location_name TEXT,
  p_location_address TEXT DEFAULT NULL,
  p_place_id TEXT DEFAULT NULL,
  p_location_latitude DOUBLE PRECISION DEFAULT NULL,
  p_location_longitude DOUBLE PRECISION DEFAULT NULL,
  p_activity_type TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL,
  p_meetup_note TEXT DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  companion_user_id UUID;
  resolved_conversation_id UUID;
  booking_row public.bookings;
  proposal_row public.meetup_location_proposals;
  subtotal NUMERIC;
  service_fee NUMERIC;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_companion_id IS NULL OR p_date IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Missing required booking fields';
  END IF;

  IF COALESCE(TRIM(p_location_name), '') = '' AND COALESCE(TRIM(p_place_id), '') = '' THEN
    RAISE EXCEPTION 'Meetup location is required';
  END IF;

  SELECT c.user_id
  INTO companion_user_id
  FROM public.companions c
  WHERE c.id = p_companion_id
  LIMIT 1;

  IF companion_user_id IS NULL THEN
    RAISE EXCEPTION 'Companion not found';
  END IF;

  IF public.are_users_blocked(current_user_id, companion_user_id) THEN
    RAISE EXCEPTION 'Unable to create booking';
  END IF;

  IF p_conversation_id IS NOT NULL THEN
    SELECT c.id
    INTO resolved_conversation_id
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND COALESCE(c.kind, 'direct') = 'direct'
      AND (
        (
          c.participant_ids @> ARRAY[current_user_id, companion_user_id]::UUID[]
          AND COALESCE(ARRAY_LENGTH(c.participant_ids, 1), 0) = 2
        )
        OR (
          c.participant_1 IN (current_user_id, companion_user_id)
          AND c.participant_2 IN (current_user_id, companion_user_id)
        )
      )
    LIMIT 1;
  END IF;

  IF resolved_conversation_id IS NULL THEN
    SELECT (public.get_or_create_direct_conversation_v2(companion_user_id)).id
    INTO resolved_conversation_id;
  END IF;

  subtotal := COALESCE(p_hourly_rate, 0) * GREATEST(COALESCE(p_duration_hours, 1), 1);
  service_fee := ROUND((subtotal * 0.10)::NUMERIC, 2);

  INSERT INTO public.bookings (
    client_id,
    companion_id,
    conversation_id,
    status,
    date,
    start_time,
    duration_hours,
    hourly_rate,
    subtotal,
    service_fee,
    total_price,
    location_name,
    location_address,
    location_place_id,
    location_latitude,
    location_longitude,
    location_lat,
    location_lng,
    activity_type,
    notes,
    meetup_status,
    created_at,
    updated_at
  ) VALUES (
    current_user_id,
    p_companion_id,
    resolved_conversation_id,
    'pending',
    p_date,
    p_start_time,
    GREATEST(COALESCE(p_duration_hours, 1), 1),
    COALESCE(p_hourly_rate, 0),
    subtotal,
    service_fee,
    subtotal + service_fee,
    COALESCE(NULLIF(TRIM(p_location_name), ''), 'Meetup location'),
    NULLIF(TRIM(p_location_address), ''),
    NULLIF(TRIM(p_place_id), ''),
    p_location_latitude,
    p_location_longitude,
    p_location_latitude,
    p_location_longitude,
    NULLIF(TRIM(p_activity_type), ''),
    NULLIF(TRIM(p_notes), ''),
    'proposed',
    NOW(),
    NOW()
  ) RETURNING * INTO booking_row;

  INSERT INTO public.meetup_location_proposals (
    conversation_id,
    booking_id,
    proposer_user_id,
    place_id,
    place_name,
    place_address,
    latitude,
    longitude,
    note,
    status,
    created_at,
    updated_at
  ) VALUES (
    resolved_conversation_id,
    booking_row.id,
    current_user_id,
    NULLIF(TRIM(p_place_id), ''),
    COALESCE(NULLIF(TRIM(p_location_name), ''), 'Meetup location'),
    NULLIF(TRIM(p_location_address), ''),
    p_location_latitude,
    p_location_longitude,
    NULLIF(TRIM(p_meetup_note), ''),
    'pending',
    NOW(),
    NOW()
  ) RETURNING * INTO proposal_row;

  UPDATE public.bookings
  SET meetup_proposal_id = proposal_row.id,
      updated_at = NOW()
  WHERE id = booking_row.id
  RETURNING * INTO booking_row;

  UPDATE public.conversations
  SET updated_at = NOW(),
      last_message_at = NOW(),
      last_message_preview = 'Proposed meetup location'
  WHERE id = resolved_conversation_id;

  RETURN booking_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Friends social/feed visibility hardening
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Companions hide blocked users v1" ON public.companions;
CREATE POLICY "Companions hide blocked users v1"
ON public.companions
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() IS NULL
  OR public.can_users_interact(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "Friend posts hide blocked users v1" ON public.friend_posts;
CREATE POLICY "Friend posts hide blocked users v1"
ON public.friend_posts
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.can_users_interact(auth.uid(), author_id)
);

DROP POLICY IF EXISTS "Friend events hide blocked users v1" ON public.friend_events;
CREATE POLICY "Friend events hide blocked users v1"
ON public.friend_events
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.can_users_interact(auth.uid(), host_id)
);

DROP POLICY IF EXISTS "Friend connections hide blocked pairs v1" ON public.friend_connections;
CREATE POLICY "Friend connections hide blocked pairs v1"
ON public.friend_connections
AS RESTRICTIVE
FOR SELECT
USING (public.can_users_interact(requester_id, recipient_id));

DROP POLICY IF EXISTS "Reviews hide blocked users v1" ON public.reviews;
CREATE POLICY "Reviews hide blocked users v1"
ON public.reviews
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() IS NULL
  OR (
    public.can_users_interact(auth.uid(), reviewer_id)
    AND public.can_users_interact(auth.uid(), reviewee_id)
  )
);

DROP POLICY IF EXISTS "Post comments hide blocked users v1" ON public.post_comments;
CREATE POLICY "Post comments hide blocked users v1"
ON public.post_comments
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.can_users_interact(auth.uid(), author_id)
);

DROP POLICY IF EXISTS "Post likes hide blocked users v1" ON public.post_likes;
CREATE POLICY "Post likes hide blocked users v1"
ON public.post_likes
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.can_users_interact(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "Event RSVPs hide blocked users v1" ON public.event_rsvps;
CREATE POLICY "Event RSVPs hide blocked users v1"
ON public.event_rsvps
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.can_users_interact(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "Group memberships hide blocked users v1" ON public.group_memberships;
CREATE POLICY "Group memberships hide blocked users v1"
ON public.group_memberships
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.can_users_interact(auth.uid(), user_id)
);

-- ---------------------------------------------------------------------------
-- Block/unblock/list RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_connection_request_v1(p_target_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  existing_connection public.friend_connections%ROWTYPE;
  new_connection_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_target_user_id IS NULL OR p_target_user_id = current_user_id THEN
    RAISE EXCEPTION 'Invalid target user';
  END IF;

  IF public.are_users_blocked(current_user_id, p_target_user_id) THEN
    RAISE EXCEPTION 'Unable to send request right now';
  END IF;

  SELECT *
  INTO existing_connection
  FROM public.friend_connections
  WHERE user_low = LEAST(current_user_id, p_target_user_id)
    AND user_high = GREATEST(current_user_id, p_target_user_id)
  LIMIT 1;

  IF FOUND THEN
    IF existing_connection.status = 'blocked' THEN
      RAISE EXCEPTION 'Unable to send request right now';
    END IF;

    IF existing_connection.status = 'accepted' THEN
      RETURN existing_connection.id;
    END IF;

    IF existing_connection.status = 'pending' THEN
      IF existing_connection.requester_id = current_user_id THEN
        RETURN existing_connection.id;
      END IF;

      UPDATE public.friend_connections
      SET
        status = 'accepted',
        responded_at = NOW(),
        updated_at = NOW()
      WHERE id = existing_connection.id;

      RETURN existing_connection.id;
    END IF;

    UPDATE public.friend_connections
    SET
      requester_id = current_user_id,
      recipient_id = p_target_user_id,
      status = 'pending',
      requested_at = NOW(),
      responded_at = NULL,
      updated_at = NOW()
    WHERE id = existing_connection.id;

    RETURN existing_connection.id;
  END IF;

  INSERT INTO public.friend_connections (
    requester_id,
    recipient_id,
    status,
    requested_at
  )
  VALUES (
    current_user_id,
    p_target_user_id,
    'pending',
    NOW()
  )
  RETURNING id INTO new_connection_id;

  RETURN new_connection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_user_v1(
  p_target_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.friend_blocks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  block_row public.friend_blocks;
  block_timestamp TIMESTAMPTZ := NOW();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_target_user_id IS NULL OR p_target_user_id = current_user_id THEN
    RAISE EXCEPTION 'Invalid target user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_target_user_id
  ) THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  INSERT INTO public.friend_blocks (blocker_id, blocked_id, created_at)
  VALUES (current_user_id, p_target_user_id, block_timestamp)
  ON CONFLICT (blocker_id, blocked_id)
  DO UPDATE SET created_at = public.friend_blocks.created_at
  RETURNING *
  INTO block_row;

  DELETE FROM public.friend_connections
  WHERE user_low = LEAST(current_user_id, p_target_user_id)
    AND user_high = GREATEST(current_user_id, p_target_user_id);

  UPDATE public.bookings b
  SET
    status = 'cancelled',
    cancelled_at = COALESCE(b.cancelled_at, block_timestamp),
    cancelled_by = COALESCE(b.cancelled_by, current_user_id),
    cancellation_reason = COALESCE(
      NULLIF(TRIM(p_reason), ''),
      'Booking cancelled for privacy and safety reasons.'
    ),
    updated_at = block_timestamp
  FROM public.companions c
  WHERE b.companion_id = c.id
    AND b.status IN ('pending', 'confirmed', 'in_progress')
    AND (
      (b.client_id = current_user_id AND c.user_id = p_target_user_id)
      OR (b.client_id = p_target_user_id AND c.user_id = current_user_id)
    );

  UPDATE public.conversation_members cm
  SET
    left_at = COALESCE(cm.left_at, block_timestamp),
    updated_at = block_timestamp
  FROM public.conversations c
  WHERE cm.conversation_id = c.id
    AND COALESCE(c.kind, 'direct') = 'direct'
    AND cm.user_id IN (current_user_id, p_target_user_id)
    AND (
      (
        c.participant_ids @> ARRAY[current_user_id, p_target_user_id]::UUID[]
        AND COALESCE(ARRAY_LENGTH(c.participant_ids, 1), 0) = 2
      )
      OR (
        c.participant_1 IN (current_user_id, p_target_user_id)
        AND c.participant_2 IN (current_user_id, p_target_user_id)
      )
    );

  UPDATE public.conversations c
  SET
    updated_at = block_timestamp,
    last_message_at = COALESCE(c.last_message_at, block_timestamp)
  WHERE COALESCE(c.kind, 'direct') = 'direct'
    AND (
      (
        c.participant_ids @> ARRAY[current_user_id, p_target_user_id]::UUID[]
        AND COALESCE(ARRAY_LENGTH(c.participant_ids, 1), 0) = 2
      )
      OR (
        c.participant_1 IN (current_user_id, p_target_user_id)
        AND c.participant_2 IN (current_user_id, p_target_user_id)
      )
    );

  RETURN block_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user_v1(
  p_target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  deleted_count INTEGER := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_target_user_id IS NULL OR p_target_user_id = current_user_id THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.friend_blocks
  WHERE blocker_id = current_user_id
    AND blocked_id = p_target_user_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_blocked_users_v1(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  blocked_user_id UUID,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  blocked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  safe_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    fb.created_at AS blocked_at
  FROM public.friend_blocks fb
  JOIN public.profiles p
    ON p.id = fb.blocked_id
  WHERE fb.blocker_id = current_user_id
  ORDER BY fb.created_at DESC
  LIMIT safe_limit
  OFFSET safe_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.block_user_v1(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_blocked_users_v1(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_connection_request_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_users_blocked(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_users_interact(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_direct_conversation_blocked(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_direct_participants_blocked(UUID[], UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_companion_user_id(UUID) TO authenticated;

COMMIT;
