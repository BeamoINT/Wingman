-- Extend profiles_public with ID verification lifecycle fields,
-- and enforce active verification in booking creation RPC.

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
  p.id_verified_at,
  p.id_verification_status,
  p.id_verification_expires_at,
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

  IF NOT public.has_active_id_verification(current_user_id) THEN
    RAISE EXCEPTION 'ID_VERIFICATION_REQUIRED'
      USING ERRCODE = 'P0001',
            DETAIL = 'Your ID verification is expired or incomplete. Re-verify to continue booking.';
  END IF;

  IF NOT public.has_active_id_verification(companion_user_id) THEN
    RAISE EXCEPTION 'ID_VERIFICATION_REQUIRED'
      USING ERRCODE = 'P0001',
            DETAIL = 'This wingman cannot accept bookings until ID verification is renewed.';
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

DROP POLICY IF EXISTS "Bookings require active id verification inserts v1" ON public.bookings;
CREATE POLICY "Bookings require active id verification inserts v1"
ON public.bookings
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  client_id IS NULL
  OR (
    client_id = auth.uid()
    AND public.has_active_id_verification(client_id)
    AND companion_id IS NOT NULL
    AND public.has_active_id_verification(public.get_companion_user_id(companion_id))
  )
);

DROP POLICY IF EXISTS "Bookings require active id verification updates v1" ON public.bookings;
CREATE POLICY "Bookings require active id verification updates v1"
ON public.bookings
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  client_id IS NULL
  OR (
    client_id = auth.uid()
    AND public.has_active_id_verification(client_id)
    AND companion_id IS NOT NULL
    AND public.has_active_id_verification(public.get_companion_user_id(companion_id))
  )
)
WITH CHECK (
  client_id IS NULL
  OR (
    client_id = auth.uid()
    AND public.has_active_id_verification(client_id)
    AND companion_id IS NOT NULL
    AND public.has_active_id_verification(public.get_companion_user_id(companion_id))
  )
);
