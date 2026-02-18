BEGIN;

ALTER TABLE IF EXISTS public.safety_preferences
  ADD COLUMN IF NOT EXISTS auto_record_safety_audio_on_visit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS safety_audio_policy_ack_version TEXT,
  ADD COLUMN IF NOT EXISTS safety_audio_policy_ack_at TIMESTAMPTZ;

UPDATE public.safety_preferences
SET auto_record_safety_audio_on_visit = FALSE
WHERE auto_record_safety_audio_on_visit IS NULL;

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

GRANT EXECUTE ON FUNCTION public.get_safety_preferences_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_safety_preferences_v2(BOOLEAN, INTEGER, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN) TO authenticated;

COMMIT;
