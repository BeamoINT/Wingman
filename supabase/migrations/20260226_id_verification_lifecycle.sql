-- ID verification lifecycle hardening:
-- - Stripe Identity status + expiry metadata
-- - 3-year reverification expiry model
-- - reminder + webhook idempotency tables
-- - name change invalidation trigger

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_verification_status TEXT,
  ADD COLUMN IF NOT EXISTS id_verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS id_verification_provider TEXT,
  ADD COLUMN IF NOT EXISTS id_verification_provider_ref TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_photo_id_match_attested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS profile_photo_id_match_attested_at TIMESTAMPTZ;

UPDATE public.profiles
SET id_verification_status = CASE
  WHEN COALESCE(id_verified, FALSE) = TRUE THEN 'verified'
  ELSE 'unverified'
END
WHERE id_verification_status IS NULL
   OR BTRIM(id_verification_status) = '';

ALTER TABLE public.profiles
  ALTER COLUMN id_verification_status SET DEFAULT 'unverified';

ALTER TABLE public.profiles
  ALTER COLUMN id_verification_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_id_verification_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_verification_status_check
      CHECK (
        id_verification_status IN (
          'unverified',
          'pending',
          'verified',
          'expired',
          'failed_name_mismatch',
          'failed'
        )
      );
  END IF;
END
$$;

-- Backfill legacy verified users into 3-year lifecycle.
UPDATE public.profiles
SET id_verification_provider = COALESCE(NULLIF(BTRIM(id_verification_provider), ''), 'legacy')
WHERE COALESCE(id_verified, FALSE) = TRUE;

UPDATE public.profiles
SET id_verification_expires_at = COALESCE(
  id_verification_expires_at,
  COALESCE(id_verified_at, updated_at, created_at, NOW()) + INTERVAL '3 years'
)
WHERE COALESCE(id_verified, FALSE) = TRUE;

-- Legacy verified users are grandfathered into attestation to avoid hard migration failures.
UPDATE public.profiles
SET
  profile_photo_id_match_attested = TRUE,
  profile_photo_id_match_attested_at = COALESCE(
    profile_photo_id_match_attested_at,
    id_verified_at,
    NOW()
  )
WHERE COALESCE(id_verified, FALSE) = TRUE
  AND COALESCE(profile_photo_id_match_attested, FALSE) = FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_verified_requires_photo_id_attestation'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_verified_requires_photo_id_attestation
      CHECK (
        NOT (
          (
            COALESCE(id_verified, FALSE)
            OR id_verification_status = 'verified'
          )
          AND COALESCE(profile_photo_id_match_attested, FALSE) = FALSE
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_verified_requires_expiry_timestamp'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_verified_requires_expiry_timestamp
      CHECK (
        id_verification_status <> 'verified'
        OR id_verification_expires_at IS NOT NULL
      );
  END IF;
END
$$;

-- Normalize any already-expired rows.
UPDATE public.profiles
SET
  id_verified = FALSE,
  id_verification_status = 'expired'
WHERE COALESCE(id_verified, FALSE) = TRUE
  AND id_verification_expires_at IS NOT NULL
  AND id_verification_expires_at <= NOW();

CREATE INDEX IF NOT EXISTS idx_profiles_id_verification_status
  ON public.profiles(id_verification_status);

CREATE INDEX IF NOT EXISTS idx_profiles_id_verification_expires_at
  ON public.profiles(id_verification_expires_at);

-- Dedupe table for reminder sends (email + in-app threshold checkpoints).
CREATE TABLE IF NOT EXISTS public.id_verification_reminder_log (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cycle_verified_at TIMESTAMPTZ NOT NULL,
  threshold_days INTEGER NOT NULL,
  channel TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, cycle_verified_at, threshold_days, channel),
  CONSTRAINT id_verification_reminder_threshold_days_check
    CHECK (threshold_days IN (90, 30, 7, 1)),
  CONSTRAINT id_verification_reminder_channel_check
    CHECK (channel IN ('email', 'in_app'))
);

CREATE INDEX IF NOT EXISTS idx_id_verification_reminder_log_user_id
  ON public.id_verification_reminder_log(user_id);

CREATE INDEX IF NOT EXISTS idx_id_verification_reminder_log_sent_at
  ON public.id_verification_reminder_log(sent_at DESC);

ALTER TABLE public.id_verification_reminder_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'id_verification_reminder_log'
      AND policyname = 'Users can view own id verification reminder log'
  ) THEN
    CREATE POLICY "Users can view own id verification reminder log"
      ON public.id_verification_reminder_log
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'id_verification_reminder_log'
      AND policyname = 'Service role can insert id verification reminder log'
  ) THEN
    CREATE POLICY "Service role can insert id verification reminder log"
      ON public.id_verification_reminder_log
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END
$$;

-- Idempotency tracking for Stripe webhooks.
CREATE TABLE IF NOT EXISTS public.stripe_identity_webhook_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Canonical helper used by booking enforcement and app logic.
CREATE OR REPLACE FUNCTION public.has_active_id_verification(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND COALESCE(p.id_verified, FALSE) = TRUE
      AND COALESCE(p.id_verification_status, 'unverified') = 'verified'
      AND p.id_verification_expires_at IS NOT NULL
      AND p.id_verification_expires_at > NOW()
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_id_verification(UUID) TO authenticated;

-- If a user changes legal profile name, invalidate prior ID verification.
CREATE OR REPLACE FUNCTION public.invalidate_id_verification_on_name_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    COALESCE(OLD.first_name, '') IS DISTINCT FROM COALESCE(NEW.first_name, '')
    OR COALESCE(OLD.last_name, '') IS DISTINCT FROM COALESCE(NEW.last_name, '')
  )
  AND (
    COALESCE(OLD.id_verified, FALSE) = TRUE
    OR COALESCE(OLD.id_verification_status, 'unverified') = 'verified'
  ) THEN
    NEW.id_verified := FALSE;
    NEW.id_verified_at := NULL;
    NEW.id_verification_status := 'unverified';
    NEW.id_verification_expires_at := NULL;
    NEW.id_verification_provider_ref := NULL;
    NEW.updated_at := NOW();

    IF to_regclass('public.verification_events') IS NOT NULL THEN
      INSERT INTO public.verification_events (
        user_id,
        event_type,
        event_status,
        event_data
      )
      VALUES (
        NEW.id,
        'id_verification_invalidated_name_change',
        'success',
        jsonb_build_object(
          'old_first_name', OLD.first_name,
          'old_last_name', OLD.last_name,
          'new_first_name', NEW.first_name,
          'new_last_name', NEW.last_name,
          'reason', 'legal_name_changed_requires_reverification'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_id_verification_on_name_change ON public.profiles;
CREATE TRIGGER trg_invalidate_id_verification_on_name_change
  BEFORE UPDATE OF first_name, last_name
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_id_verification_on_name_change();
