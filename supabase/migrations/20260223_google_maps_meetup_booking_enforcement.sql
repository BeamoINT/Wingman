BEGIN;

ALTER TABLE IF EXISTS public.bookings
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.bookings
ADD COLUMN IF NOT EXISTS location_place_id TEXT;

ALTER TABLE IF EXISTS public.bookings
ADD COLUMN IF NOT EXISTS location_latitude DOUBLE PRECISION;

ALTER TABLE IF EXISTS public.bookings
ADD COLUMN IF NOT EXISTS location_longitude DOUBLE PRECISION;

ALTER TABLE IF EXISTS public.bookings
ADD COLUMN IF NOT EXISTS meetup_status TEXT DEFAULT 'none';

ALTER TABLE IF EXISTS public.bookings
ADD COLUMN IF NOT EXISTS meetup_proposal_id UUID;

ALTER TABLE IF EXISTS public.bookings
ADD COLUMN IF NOT EXISTS meetup_agreed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_meetup_status_check_v1'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_meetup_status_check_v1
      CHECK (meetup_status IN ('none', 'proposed', 'countered', 'declined', 'agreed'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_meetup_proposal_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_meetup_proposal_id_fkey
      FOREIGN KEY (meetup_proposal_id)
      REFERENCES public.meetup_location_proposals(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END
$$;

UPDATE public.bookings
SET location_latitude = COALESCE(location_latitude, location_lat),
    location_longitude = COALESCE(location_longitude, location_lng)
WHERE TRUE;

CREATE TABLE IF NOT EXISTS public.meetup_location_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  proposer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id TEXT,
  place_name TEXT NOT NULL,
  place_address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  response_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  response_note TEXT,
  responded_at TIMESTAMPTZ,
  supersedes_proposal_id UUID REFERENCES public.meetup_location_proposals(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT meetup_location_proposals_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'countered', 'withdrawn'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_meetup_proposal_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_meetup_proposal_id_fkey
      FOREIGN KEY (meetup_proposal_id)
      REFERENCES public.meetup_location_proposals(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_meetup_location_proposals_conversation
  ON public.meetup_location_proposals(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meetup_location_proposals_booking
  ON public.meetup_location_proposals(booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meetup_location_proposals_status
  ON public.meetup_location_proposals(status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meetup_proposals_single_pending_context
  ON public.meetup_location_proposals (
    conversation_id,
    COALESCE(booking_id, '00000000-0000-0000-0000-000000000000'::UUID)
  )
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_bookings_conversation_id
  ON public.bookings(conversation_id);

CREATE INDEX IF NOT EXISTS idx_bookings_meetup_status
  ON public.bookings(meetup_status);

UPDATE public.bookings
SET meetup_status = CASE
  WHEN status IN ('confirmed', 'in_progress', 'completed')
    AND (
      COALESCE(TRIM(location_name), '') <> ''
      OR COALESCE(TRIM(location_address), '') <> ''
      OR COALESCE(TRIM(location_place_id), '') <> ''
    )
    THEN 'agreed'
  WHEN status = 'pending'
    AND (
      COALESCE(TRIM(location_name), '') <> ''
      OR COALESCE(TRIM(location_address), '') <> ''
      OR COALESCE(TRIM(location_place_id), '') <> ''
    )
    THEN 'proposed'
  ELSE COALESCE(meetup_status, 'none')
END,
meetup_agreed_at = CASE
  WHEN status IN ('confirmed', 'in_progress', 'completed')
    AND meetup_agreed_at IS NULL
    AND (
      COALESCE(TRIM(location_name), '') <> ''
      OR COALESCE(TRIM(location_address), '') <> ''
      OR COALESCE(TRIM(location_place_id), '') <> ''
    )
    THEN COALESCE(updated_at, created_at, NOW())
  ELSE meetup_agreed_at
END
WHERE TRUE;

CREATE OR REPLACE FUNCTION public.trg_set_meetup_location_proposals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meetup_location_proposals_updated_at ON public.meetup_location_proposals;
CREATE TRIGGER trg_meetup_location_proposals_updated_at
BEFORE UPDATE ON public.meetup_location_proposals
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_meetup_location_proposals_updated_at();

CREATE OR REPLACE FUNCTION public.trg_enforce_booking_meetup_agreement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  has_location boolean;
BEGIN
  IF NEW.status IN ('confirmed', 'in_progress', 'completed') THEN
    has_location := (
      COALESCE(TRIM(NEW.location_name), '') <> ''
      OR COALESCE(TRIM(NEW.location_address), '') <> ''
      OR COALESCE(TRIM(NEW.location_place_id), '') <> ''
    );

    IF COALESCE(NEW.meetup_status, 'none') <> 'agreed' OR has_location = FALSE THEN
      RAISE EXCEPTION 'booking_meetup_required'
        USING MESSAGE = 'Booking cannot move beyond pending until meetup location is agreed.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_meetup_agreement ON public.bookings;
CREATE TRIGGER trg_enforce_booking_meetup_agreement
BEFORE INSERT OR UPDATE OF status, meetup_status, location_name, location_address, location_place_id
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.trg_enforce_booking_meetup_agreement();

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

  IF p_conversation_id IS NOT NULL THEN
    SELECT c.id
    INTO resolved_conversation_id
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND c.kind = 'direct'
      AND c.participant_ids @> ARRAY[current_user_id, companion_user_id]::UUID[]
      AND COALESCE(ARRAY_LENGTH(c.participant_ids, 1), 0) = 2
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

CREATE OR REPLACE FUNCTION public.propose_meetup_location_v1(
  p_conversation_id UUID,
  p_booking_id UUID DEFAULT NULL,
  p_place_id TEXT DEFAULT NULL,
  p_place_name TEXT DEFAULT NULL,
  p_place_address TEXT DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_supersedes_proposal_id UUID DEFAULT NULL
)
RETURNS public.meetup_location_proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  proposal_row public.meetup_location_proposals;
  normalized_place_name TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Conversation is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = p_conversation_id
      AND cm.user_id = current_user_id
      AND cm.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conversation access denied';
  END IF;

  normalized_place_name := COALESCE(NULLIF(TRIM(p_place_name), ''), NULLIF(TRIM(p_place_address), ''), NULLIF(TRIM(p_place_id), ''));

  IF normalized_place_name IS NULL THEN
    RAISE EXCEPTION 'Meetup place details are required';
  END IF;

  IF p_booking_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = p_booking_id
        AND b.conversation_id = p_conversation_id
    ) THEN
      RAISE EXCEPTION 'Booking does not belong to this conversation';
    END IF;
  END IF;

  UPDATE public.meetup_location_proposals
  SET status = 'countered',
      response_by_user_id = current_user_id,
      response_note = COALESCE(response_note, 'Superseded by a newer proposal'),
      responded_at = NOW(),
      updated_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND COALESCE(booking_id, '00000000-0000-0000-0000-000000000000'::UUID)
      = COALESCE(p_booking_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND status = 'pending';

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
    supersedes_proposal_id,
    created_at,
    updated_at
  ) VALUES (
    p_conversation_id,
    p_booking_id,
    current_user_id,
    NULLIF(TRIM(p_place_id), ''),
    normalized_place_name,
    NULLIF(TRIM(p_place_address), ''),
    p_latitude,
    p_longitude,
    NULLIF(TRIM(p_note), ''),
    'pending',
    p_supersedes_proposal_id,
    NOW(),
    NOW()
  ) RETURNING * INTO proposal_row;

  IF p_booking_id IS NOT NULL THEN
    UPDATE public.bookings
    SET meetup_status = CASE
          WHEN meetup_status = 'agreed' THEN meetup_status
          ELSE 'proposed'
        END,
        meetup_proposal_id = proposal_row.id,
        location_place_id = COALESCE(NULLIF(TRIM(p_place_id), ''), location_place_id),
        location_name = normalized_place_name,
        location_address = COALESCE(NULLIF(TRIM(p_place_address), ''), location_address),
        location_latitude = COALESCE(p_latitude, location_latitude),
        location_longitude = COALESCE(p_longitude, location_longitude),
        location_lat = COALESCE(p_latitude, location_lat),
        location_lng = COALESCE(p_longitude, location_lng),
        updated_at = NOW()
    WHERE id = p_booking_id;
  END IF;

  UPDATE public.conversations
  SET updated_at = NOW(),
      last_message_at = NOW(),
      last_message_preview = 'Proposed meetup location'
  WHERE id = p_conversation_id;

  RETURN proposal_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_meetup_location_v1(
  p_proposal_id UUID,
  p_action TEXT,
  p_response_note TEXT DEFAULT NULL,
  p_counter_place_id TEXT DEFAULT NULL,
  p_counter_place_name TEXT DEFAULT NULL,
  p_counter_place_address TEXT DEFAULT NULL,
  p_counter_latitude DOUBLE PRECISION DEFAULT NULL,
  p_counter_longitude DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE(
  responded_proposal_id UUID,
  counter_proposal_id UUID,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  action_value TEXT := LOWER(TRIM(COALESCE(p_action, '')));
  proposal_row public.meetup_location_proposals;
  new_counter_row public.meetup_location_proposals;
  counter_name TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO proposal_row
  FROM public.meetup_location_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF proposal_row.id IS NULL THEN
    RAISE EXCEPTION 'Meetup proposal not found';
  END IF;

  IF proposal_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Meetup proposal is no longer pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = proposal_row.conversation_id
      AND cm.user_id = current_user_id
      AND cm.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conversation access denied';
  END IF;

  IF action_value NOT IN ('accept', 'decline', 'counter') THEN
    RAISE EXCEPTION 'Invalid meetup response action';
  END IF;

  IF action_value = 'accept' THEN
    UPDATE public.meetup_location_proposals
    SET status = 'accepted',
        response_by_user_id = current_user_id,
        response_note = NULLIF(TRIM(p_response_note), ''),
        responded_at = NOW(),
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = proposal_row.id;

    UPDATE public.meetup_location_proposals
    SET status = 'declined',
        response_by_user_id = current_user_id,
        response_note = COALESCE(response_note, 'Superseded by accepted meetup'),
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id <> proposal_row.id
      AND conversation_id = proposal_row.conversation_id
      AND COALESCE(booking_id, '00000000-0000-0000-0000-000000000000'::UUID)
        = COALESCE(proposal_row.booking_id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND status = 'pending';

    IF proposal_row.booking_id IS NOT NULL THEN
      UPDATE public.bookings
      SET meetup_status = 'agreed',
          meetup_proposal_id = proposal_row.id,
          meetup_agreed_at = NOW(),
          location_place_id = COALESCE(proposal_row.place_id, location_place_id),
          location_name = COALESCE(proposal_row.place_name, location_name),
          location_address = COALESCE(proposal_row.place_address, location_address),
          location_latitude = COALESCE(proposal_row.latitude, location_latitude),
          location_longitude = COALESCE(proposal_row.longitude, location_longitude),
          location_lat = COALESCE(proposal_row.latitude, location_lat),
          location_lng = COALESCE(proposal_row.longitude, location_lng),
          updated_at = NOW()
      WHERE id = proposal_row.booking_id;
    END IF;

    UPDATE public.conversations
    SET updated_at = NOW(),
        last_message_at = NOW(),
        last_message_preview = 'Meetup location accepted'
    WHERE id = proposal_row.conversation_id;

    RETURN QUERY SELECT proposal_row.id, NULL::UUID, 'accepted'::TEXT;
    RETURN;
  END IF;

  IF action_value = 'decline' THEN
    UPDATE public.meetup_location_proposals
    SET status = 'declined',
        response_by_user_id = current_user_id,
        response_note = NULLIF(TRIM(p_response_note), ''),
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = proposal_row.id;

    IF proposal_row.booking_id IS NOT NULL THEN
      UPDATE public.bookings
      SET meetup_status = CASE WHEN meetup_status = 'agreed' THEN meetup_status ELSE 'declined' END,
          meetup_proposal_id = proposal_row.id,
          updated_at = NOW()
      WHERE id = proposal_row.booking_id;
    END IF;

    UPDATE public.conversations
    SET updated_at = NOW(),
        last_message_at = NOW(),
        last_message_preview = 'Meetup location declined'
    WHERE id = proposal_row.conversation_id;

    RETURN QUERY SELECT proposal_row.id, NULL::UUID, 'declined'::TEXT;
    RETURN;
  END IF;

  counter_name := COALESCE(NULLIF(TRIM(p_counter_place_name), ''), NULLIF(TRIM(p_counter_place_address), ''), NULLIF(TRIM(p_counter_place_id), ''));
  IF counter_name IS NULL THEN
    RAISE EXCEPTION 'Counter proposal must include a meetup location';
  END IF;

  UPDATE public.meetup_location_proposals
  SET status = 'countered',
      response_by_user_id = current_user_id,
      response_note = NULLIF(TRIM(p_response_note), ''),
      responded_at = NOW(),
      updated_at = NOW()
  WHERE id = proposal_row.id;

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
    supersedes_proposal_id,
    created_at,
    updated_at
  ) VALUES (
    proposal_row.conversation_id,
    proposal_row.booking_id,
    current_user_id,
    NULLIF(TRIM(p_counter_place_id), ''),
    counter_name,
    NULLIF(TRIM(p_counter_place_address), ''),
    p_counter_latitude,
    p_counter_longitude,
    NULL,
    'pending',
    proposal_row.id,
    NOW(),
    NOW()
  ) RETURNING * INTO new_counter_row;

  IF proposal_row.booking_id IS NOT NULL THEN
    UPDATE public.bookings
    SET meetup_status = CASE WHEN meetup_status = 'agreed' THEN meetup_status ELSE 'countered' END,
        meetup_proposal_id = new_counter_row.id,
        location_place_id = COALESCE(new_counter_row.place_id, location_place_id),
        location_name = COALESCE(new_counter_row.place_name, location_name),
        location_address = COALESCE(new_counter_row.place_address, location_address),
        location_latitude = COALESCE(new_counter_row.latitude, location_latitude),
        location_longitude = COALESCE(new_counter_row.longitude, location_longitude),
        location_lat = COALESCE(new_counter_row.latitude, location_lat),
        location_lng = COALESCE(new_counter_row.longitude, location_lng),
        updated_at = NOW()
    WHERE id = proposal_row.booking_id;
  END IF;

  UPDATE public.conversations
  SET updated_at = NOW(),
      last_message_at = NOW(),
      last_message_preview = 'Suggested an alternative meetup location'
  WHERE id = proposal_row.conversation_id;

  RETURN QUERY SELECT proposal_row.id, new_counter_row.id, 'countered'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_meetup_location_proposals_v1(
  p_conversation_id UUID,
  p_booking_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 200,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF public.meetup_location_proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  safe_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 200), 500));
  safe_offset INTEGER := GREATEST(0, COALESCE(p_offset, 0));
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Conversation ID is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = p_conversation_id
      AND cm.user_id = current_user_id
      AND cm.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conversation access denied';
  END IF;

  RETURN QUERY
  SELECT mlp.*
  FROM public.meetup_location_proposals mlp
  WHERE mlp.conversation_id = p_conversation_id
    AND (p_booking_id IS NULL OR mlp.booking_id = p_booking_id)
  ORDER BY mlp.created_at ASC
  LIMIT safe_limit
  OFFSET safe_offset;
END;
$$;

ALTER TABLE public.meetup_location_proposals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meetup_location_proposals'
      AND policyname = 'Meetup proposals select members v1'
  ) THEN
    CREATE POLICY "Meetup proposals select members v1"
      ON public.meetup_location_proposals
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.conversation_members cm
          WHERE cm.conversation_id = meetup_location_proposals.conversation_id
            AND cm.user_id = auth.uid()
            AND cm.left_at IS NULL
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meetup_location_proposals'
      AND policyname = 'Meetup proposals insert members v1'
  ) THEN
    CREATE POLICY "Meetup proposals insert members v1"
      ON public.meetup_location_proposals
      FOR INSERT
      WITH CHECK (
        proposer_user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.conversation_members cm
          WHERE cm.conversation_id = meetup_location_proposals.conversation_id
            AND cm.user_id = auth.uid()
            AND cm.left_at IS NULL
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meetup_location_proposals'
      AND policyname = 'Meetup proposals update members v1'
  ) THEN
    CREATE POLICY "Meetup proposals update members v1"
      ON public.meetup_location_proposals
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.conversation_members cm
          WHERE cm.conversation_id = meetup_location_proposals.conversation_id
            AND cm.user_id = auth.uid()
            AND cm.left_at IS NULL
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.conversation_members cm
          WHERE cm.conversation_id = meetup_location_proposals.conversation_id
            AND cm.user_id = auth.uid()
            AND cm.left_at IS NULL
        )
      );
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_with_meetup_v1(
  UUID,
  DATE,
  TIME,
  INTEGER,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TEXT,
  TEXT,
  UUID,
  TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.propose_meetup_location_v1(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TEXT,
  UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.respond_meetup_location_v1(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  DOUBLE PRECISION,
  DOUBLE PRECISION
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_meetup_location_proposals_v1(UUID, UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;
