-- Wingman onboarding hardening:
-- - strict 1->2->3 flow (ID verification -> agreement -> profile setup)
-- - immutable agreement acceptance logging
-- - auto-publish companion profile on successful setup
-- - server-side enforcement for existing and new wingmen

BEGIN;

-- ---------------------------------------------------------------------------
-- Companion applications lifecycle metadata
-- ---------------------------------------------------------------------------

ALTER TABLE public.companion_applications
  ADD COLUMN IF NOT EXISTS companion_agreement_version TEXT,
  ADD COLUMN IF NOT EXISTS companion_agreement_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_last_step INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS profile_setup_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS id_verification_failure_code TEXT,
  ADD COLUMN IF NOT EXISTS id_verification_failure_message TEXT;

UPDATE public.companion_applications
SET companion_agreement_version = '1.0'
WHERE companion_agreement_accepted = TRUE
  AND COALESCE(BTRIM(companion_agreement_version), '') = '';

UPDATE public.companion_applications
SET companion_agreement_acknowledged_at = COALESCE(
  companion_agreement_acknowledged_at,
  companion_agreement_accepted_at,
  updated_at,
  created_at,
  NOW()
)
WHERE companion_agreement_accepted = TRUE
  AND companion_agreement_acknowledged_at IS NULL;

UPDATE public.companion_applications ca
SET profile_setup_completed_at = COALESCE(
  ca.profile_setup_completed_at,
  c.updated_at,
  ca.submitted_at,
  ca.updated_at,
  NOW()
)
FROM public.companions c
WHERE c.user_id = ca.user_id
  AND ca.profile_setup_completed_at IS NULL;

UPDATE public.companion_applications ca
SET onboarding_last_step = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.companions c
    WHERE c.user_id = ca.user_id
  ) THEN 3
  WHEN ca.companion_agreement_accepted = TRUE THEN 2
  ELSE 1
END
WHERE ca.onboarding_last_step IS NULL
  OR ca.onboarding_last_step < 1
  OR ca.onboarding_last_step > 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'companion_applications_onboarding_last_step_check'
  ) THEN
    ALTER TABLE public.companion_applications
      ADD CONSTRAINT companion_applications_onboarding_last_step_check
      CHECK (onboarding_last_step BETWEEN 1 AND 3);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_companion_applications_onboarding_last_step
  ON public.companion_applications(onboarding_last_step);

CREATE INDEX IF NOT EXISTS idx_companion_applications_agreement_version
  ON public.companion_applications(companion_agreement_version);

-- ---------------------------------------------------------------------------
-- Immutable legal acceptance log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.companion_agreement_acceptance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agreement_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acceptance_source TEXT NOT NULL DEFAULT 'onboarding',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companion_agreement_acceptance_log_user_id
  ON public.companion_agreement_acceptance_log(user_id);

CREATE INDEX IF NOT EXISTS idx_companion_agreement_acceptance_log_accepted_at
  ON public.companion_agreement_acceptance_log(accepted_at DESC);

INSERT INTO public.companion_agreement_acceptance_log (
  user_id,
  agreement_version,
  accepted_at,
  acceptance_source
)
SELECT
  ca.user_id,
  COALESCE(NULLIF(BTRIM(ca.companion_agreement_version), ''), '1.0'),
  COALESCE(ca.companion_agreement_accepted_at, ca.updated_at, ca.created_at, NOW()),
  'legacy_backfill'
FROM public.companion_applications ca
WHERE ca.companion_agreement_accepted = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM public.companion_agreement_acceptance_log l
    WHERE l.user_id = ca.user_id
      AND l.agreement_version = COALESCE(NULLIF(BTRIM(ca.companion_agreement_version), ''), '1.0')
      AND l.accepted_at = COALESCE(ca.companion_agreement_accepted_at, ca.updated_at, ca.created_at, NOW())
  );

ALTER TABLE public.companion_agreement_acceptance_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companion_agreement_acceptance_log'
      AND policyname = 'Users can view own companion agreement log'
  ) THEN
    CREATE POLICY "Users can view own companion agreement log"
      ON public.companion_agreement_acceptance_log
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Verification failure reason transparency
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_verification_failure_code TEXT,
  ADD COLUMN IF NOT EXISTS id_verification_failure_message TEXT,
  ADD COLUMN IF NOT EXISTS id_verification_last_failed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Agreement version helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_companion_agreement_version()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT '1.0'::TEXT;
$$;

CREATE OR REPLACE FUNCTION public.has_accepted_current_companion_agreement(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companion_applications ca
    WHERE ca.user_id = p_user_id
      AND COALESCE(ca.companion_agreement_accepted, FALSE) = TRUE
      AND ca.companion_agreement_accepted_at IS NOT NULL
      AND COALESCE(NULLIF(BTRIM(ca.companion_agreement_version), ''), '') = public.current_companion_agreement_version()
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_companion_agreement_version() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_accepted_current_companion_agreement(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Agreement acceptance RPC (append-only + current state)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_companion_agreement_v1(
  p_agreement_version TEXT,
  p_source TEXT DEFAULT 'onboarding'
)
RETURNS TABLE (
  companion_agreement_accepted BOOLEAN,
  companion_agreement_accepted_at TIMESTAMPTZ,
  companion_agreement_version TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  accepted_at_ts TIMESTAMPTZ := NOW();
  normalized_version TEXT := NULLIF(BTRIM(COALESCE(p_agreement_version, '')), '');
  normalized_source TEXT := COALESCE(NULLIF(BTRIM(COALESCE(p_source, '')), ''), 'onboarding');
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF normalized_version IS NULL THEN
    RAISE EXCEPTION 'Agreement version is required';
  END IF;

  IF normalized_version <> public.current_companion_agreement_version() THEN
    RAISE EXCEPTION 'Agreement version mismatch'
      USING DETAIL = 'Please refresh and accept the latest Wingman Agreement version.';
  END IF;

  IF NOT public.has_active_id_verification(current_user_id) THEN
    RAISE EXCEPTION 'ID_VERIFICATION_REQUIRED'
      USING ERRCODE = 'P0001',
            DETAIL = 'You must complete active ID verification before accepting the Wingman Agreement.';
  END IF;

  INSERT INTO public.companion_applications (
    user_id,
    status,
    companion_agreement_accepted,
    companion_agreement_accepted_at,
    companion_agreement_version,
    companion_agreement_acknowledged_at,
    onboarding_last_step,
    updated_at
  ) VALUES (
    current_user_id,
    'draft',
    TRUE,
    accepted_at_ts,
    normalized_version,
    accepted_at_ts,
    2,
    accepted_at_ts
  )
  ON CONFLICT (user_id)
  DO UPDATE
  SET
    companion_agreement_accepted = TRUE,
    companion_agreement_accepted_at = accepted_at_ts,
    companion_agreement_version = normalized_version,
    companion_agreement_acknowledged_at = accepted_at_ts,
    onboarding_last_step = GREATEST(COALESCE(public.companion_applications.onboarding_last_step, 1), 2),
    updated_at = accepted_at_ts;

  INSERT INTO public.companion_agreement_acceptance_log (
    user_id,
    agreement_version,
    accepted_at,
    acceptance_source
  ) VALUES (
    current_user_id,
    normalized_version,
    accepted_at_ts,
    normalized_source
  );

  RETURN QUERY
  SELECT
    TRUE,
    accepted_at_ts,
    normalized_version;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_companion_agreement_v1(TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Onboarding state RPC (resumable first-incomplete-step)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_wingman_onboarding_state_v1()
RETURNS TABLE (
  current_step INTEGER,
  total_steps INTEGER,
  id_verification_completed BOOLEAN,
  id_verification_status TEXT,
  id_verification_failure_code TEXT,
  id_verification_failure_message TEXT,
  companion_agreement_completed BOOLEAN,
  companion_agreement_version TEXT,
  companion_agreement_accepted_at TIMESTAMPTZ,
  profile_setup_completed BOOLEAN,
  profile_setup_completed_at TIMESTAMPTZ,
  onboarding_last_step INTEGER,
  companion_id UUID,
  companion_application_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  profile_row RECORD;
  app_row RECORD;
  companion_row RECORD;
  id_done BOOLEAN;
  agreement_done BOOLEAN;
  profile_done BOOLEAN;
  computed_step INTEGER;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    p.id_verification_status,
    p.id_verification_failure_code,
    p.id_verification_failure_message
  INTO profile_row
  FROM public.profiles p
  WHERE p.id = current_user_id;

  SELECT
    ca.status,
    ca.companion_agreement_accepted,
    ca.companion_agreement_accepted_at,
    ca.companion_agreement_version,
    ca.profile_setup_completed_at,
    ca.onboarding_last_step
  INTO app_row
  FROM public.companion_applications ca
  WHERE ca.user_id = current_user_id;

  SELECT c.id, c.updated_at
  INTO companion_row
  FROM public.companions c
  WHERE c.user_id = current_user_id
  LIMIT 1;

  id_done := public.has_active_id_verification(current_user_id);
  agreement_done := public.has_accepted_current_companion_agreement(current_user_id);
  profile_done := companion_row.id IS NOT NULL;

  computed_step := CASE
    WHEN NOT id_done THEN 1
    WHEN NOT agreement_done THEN 2
    WHEN NOT profile_done THEN 3
    ELSE 3
  END;

  RETURN QUERY
  SELECT
    computed_step,
    3,
    id_done,
    COALESCE(profile_row.id_verification_status, 'unverified'),
    profile_row.id_verification_failure_code,
    profile_row.id_verification_failure_message,
    agreement_done,
    app_row.companion_agreement_version,
    app_row.companion_agreement_accepted_at,
    profile_done,
    COALESCE(app_row.profile_setup_completed_at, companion_row.updated_at),
    GREATEST(
      COALESCE(app_row.onboarding_last_step, CASE
        WHEN profile_done THEN 3
        WHEN agreement_done THEN 2
        ELSE 1
      END),
      CASE
        WHEN profile_done THEN 3
        WHEN agreement_done THEN 2
        ELSE 1
      END
    ),
    companion_row.id,
    app_row.status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wingman_onboarding_state_v1() TO authenticated;

-- ---------------------------------------------------------------------------
-- Profile setup RPC (auto-publish companion profile)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_wingman_profile_v1(
  p_specialties TEXT[],
  p_hourly_rate NUMERIC,
  p_about TEXT,
  p_languages TEXT[],
  p_gallery TEXT[] DEFAULT '{}'::TEXT[],
  p_is_available BOOLEAN DEFAULT TRUE
)
RETURNS public.companions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  now_ts TIMESTAMPTZ := NOW();
  normalized_specialties TEXT[] := COALESCE(p_specialties, '{}'::TEXT[]);
  normalized_languages TEXT[] := COALESCE(p_languages, '{}'::TEXT[]);
  normalized_gallery TEXT[] := COALESCE(p_gallery, '{}'::TEXT[]);
  normalized_about TEXT := BTRIM(COALESCE(p_about, ''));
  companion_row public.companions;
  existing_status TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_active_id_verification(current_user_id) THEN
    RAISE EXCEPTION 'ID_VERIFICATION_REQUIRED'
      USING ERRCODE = 'P0001',
            DETAIL = 'Complete ID verification before setting up your Wingman profile.';
  END IF;

  IF NOT public.has_accepted_current_companion_agreement(current_user_id) THEN
    RAISE EXCEPTION 'WINGMAN_AGREEMENT_REQUIRED'
      USING ERRCODE = 'P0001',
            DETAIL = 'Accept the current Wingman Agreement before profile setup.';
  END IF;

  SELECT ca.status
  INTO existing_status
  FROM public.companion_applications ca
  WHERE ca.user_id = current_user_id;

  IF existing_status = 'suspended' THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED'
      USING ERRCODE = 'P0001',
            DETAIL = 'Your Wingman account is suspended. Contact support for assistance.';
  END IF;

  IF CARDINALITY(normalized_specialties) < 2 THEN
    RAISE EXCEPTION 'At least two specialties are required';
  END IF;

  IF p_hourly_rate IS NULL OR p_hourly_rate < 15 OR p_hourly_rate > 500 THEN
    RAISE EXCEPTION 'Hourly rate must be between $15 and $500';
  END IF;

  IF CHAR_LENGTH(normalized_about) < 50 THEN
    RAISE EXCEPTION 'Profile bio must be at least 50 characters';
  END IF;

  IF CARDINALITY(normalized_languages) < 1 THEN
    RAISE EXCEPTION 'At least one language is required';
  END IF;

  IF CARDINALITY(normalized_gallery) > 6 THEN
    RAISE EXCEPTION 'A maximum of 6 gallery photos is allowed';
  END IF;

  INSERT INTO public.companions (
    user_id,
    hourly_rate,
    specialties,
    languages,
    about,
    gallery,
    is_active,
    is_available,
    updated_at
  ) VALUES (
    current_user_id,
    p_hourly_rate,
    normalized_specialties,
    normalized_languages,
    normalized_about,
    normalized_gallery,
    TRUE,
    COALESCE(p_is_available, TRUE),
    now_ts
  )
  ON CONFLICT (user_id)
  DO UPDATE
  SET
    hourly_rate = EXCLUDED.hourly_rate,
    specialties = EXCLUDED.specialties,
    languages = EXCLUDED.languages,
    about = EXCLUDED.about,
    gallery = EXCLUDED.gallery,
    is_active = TRUE,
    is_available = EXCLUDED.is_available,
    updated_at = now_ts
  RETURNING * INTO companion_row;

  INSERT INTO public.companion_applications (
    user_id,
    status,
    onboarding_last_step,
    profile_setup_completed_at,
    updated_at
  ) VALUES (
    current_user_id,
    'approved',
    3,
    now_ts,
    now_ts
  )
  ON CONFLICT (user_id)
  DO UPDATE
  SET
    status = 'approved',
    onboarding_last_step = 3,
    profile_setup_completed_at = COALESCE(public.companion_applications.profile_setup_completed_at, now_ts),
    updated_at = now_ts;

  RETURN companion_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_wingman_profile_v1(TEXT[], NUMERIC, TEXT, TEXT[], TEXT[], BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- Existing wingman hard enforcement (restrictive RLS)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Companions require active id + agreement on insert v1" ON public.companions;
CREATE POLICY "Companions require active id + agreement on insert v1"
ON public.companions
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.has_active_id_verification(user_id)
  AND public.has_accepted_current_companion_agreement(user_id)
);

DROP POLICY IF EXISTS "Companions require active id + agreement on update v1" ON public.companions;
CREATE POLICY "Companions require active id + agreement on update v1"
ON public.companions
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.has_active_id_verification(user_id)
  AND public.has_accepted_current_companion_agreement(user_id)
)
WITH CHECK (
  auth.uid() = user_id
  AND public.has_active_id_verification(user_id)
  AND public.has_accepted_current_companion_agreement(user_id)
);

COMMIT;
