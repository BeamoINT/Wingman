-- Fix: Update handle_new_user trigger to prevent signup failures
-- The trigger now has exception handling so it never blocks auth.users creation.
-- If the full profile insert fails (e.g., missing columns), it falls back to a
-- minimal insert. If even that fails, it logs a warning and lets signup proceed.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  dob_text TEXT;
  dob_value DATE;
BEGIN
  -- Parse MM/DD/YYYY date format from the app into a proper DATE
  dob_text := NEW.raw_user_meta_data->>'date_of_birth';
  IF dob_text IS NOT NULL AND dob_text != '' THEN
    BEGIN
      dob_value := TO_DATE(dob_text, 'MM/DD/YYYY');
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        dob_value := dob_text::DATE;
      EXCEPTION WHEN OTHERS THEN
        dob_value := NULL;
      END;
    END;
  END IF;

  -- Try full profile insert with all metadata
  BEGIN
    INSERT INTO profiles (
      id, first_name, last_name, email, phone, bio,
      date_of_birth, gender, city, state, country,
      terms_accepted, terms_accepted_at,
      privacy_accepted, privacy_accepted_at,
      age_confirmed, age_confirmed_at
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'bio',
      dob_value,
      NEW.raw_user_meta_data->>'gender',
      NEW.raw_user_meta_data->>'city',
      NEW.raw_user_meta_data->>'state',
      NEW.raw_user_meta_data->>'country',
      COALESCE((NEW.raw_user_meta_data->>'terms_accepted')::BOOLEAN, FALSE),
      CASE WHEN COALESCE((NEW.raw_user_meta_data->>'terms_accepted')::BOOLEAN, FALSE) THEN NOW() ELSE NULL END,
      COALESCE((NEW.raw_user_meta_data->>'privacy_accepted')::BOOLEAN, FALSE),
      CASE WHEN COALESCE((NEW.raw_user_meta_data->>'privacy_accepted')::BOOLEAN, FALSE) THEN NOW() ELSE NULL END,
      COALESCE((NEW.raw_user_meta_data->>'age_confirmed')::BOOLEAN, FALSE),
      CASE WHEN COALESCE((NEW.raw_user_meta_data->>'age_confirmed')::BOOLEAN, FALSE) THEN NOW() ELSE NULL END
    );
  EXCEPTION WHEN OTHERS THEN
    -- Full insert failed; try minimal insert so user creation is not blocked
    BEGIN
      INSERT INTO profiles (id, first_name, last_name, email)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        NEW.email
      );
    EXCEPTION WHEN OTHERS THEN
      -- Even minimal insert failed; log but do not block user creation
      RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
    END;
  END;

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;
