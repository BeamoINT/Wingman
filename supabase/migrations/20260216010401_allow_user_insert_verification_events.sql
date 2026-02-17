-- Allow authenticated users to insert their own verification history events.
-- Required so client-side auto-sync can persist email/phone/ID events.

DO $$
BEGIN
  IF to_regclass('public.verification_events') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'verification_events'
      AND policyname = 'Users can insert own verification events'
  ) THEN
    CREATE POLICY "Users can insert own verification events"
      ON verification_events
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
