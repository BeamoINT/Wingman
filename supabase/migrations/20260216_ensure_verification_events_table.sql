-- Ensure verification_events exists in environments that missed earlier verification migrations.

CREATE TABLE IF NOT EXISTS verification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_status VARCHAR(50) NOT NULL DEFAULT 'success',
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE verification_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_verification_events_user_id ON verification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_events_type ON verification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_verification_events_created ON verification_events(created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'verification_events'
      AND policyname = 'Users can view own verification events'
  ) THEN
    CREATE POLICY "Users can view own verification events"
      ON verification_events
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'verification_events'
      AND policyname = 'Service role can insert verification events'
  ) THEN
    CREATE POLICY "Service role can insert verification events"
      ON verification_events
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END
$$;
