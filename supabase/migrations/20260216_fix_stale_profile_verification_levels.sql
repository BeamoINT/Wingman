-- Fix stale profile verification levels that were previously set from phone verification.
-- ID verification should be the only source of "verified"/"premium" identity levels.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'id_verified'
  ) THEN
    UPDATE profiles
    SET verification_level = CASE
      WHEN COALESCE(id_verified, false) THEN
        CASE
          WHEN verification_level = 'premium' THEN 'premium'
          ELSE 'verified'
        END
      ELSE 'basic'
    END;
  END IF;
END $$;
