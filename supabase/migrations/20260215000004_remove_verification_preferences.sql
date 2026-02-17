-- Remove legacy verification preferences.
-- Wingman now enforces verified companions platform-wide.

BEGIN;

-- Drop obsolete preferences table and all dependent policies/triggers/indexes.
DROP TABLE IF EXISTS verification_preferences CASCADE;

-- Remove legacy preference-related verification history events.
DO $$
BEGIN
    IF to_regclass('public.verification_events') IS NOT NULL THEN
        DELETE FROM verification_events
        WHERE event_type = 'preferences_updated';
    END IF;
END $$;

COMMIT;
