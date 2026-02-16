-- Add missing profile consent columns used by the app's requirements context.
-- These columns are optional-safe and preserve compatibility with existing environments.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS electronic_signature_consent BOOLEAN DEFAULT FALSE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS electronic_signature_consent_at TIMESTAMPTZ;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT FALSE;
