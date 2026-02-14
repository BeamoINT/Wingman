-- Add Missing Profile Verification Columns
-- These columns are defined in 20260201_core_tables.sql but may be missing from
-- the live DB if the migration was applied before they were added.
-- Uses IF NOT EXISTS for idempotent re-runs.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_verified_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_level TEXT DEFAULT 'basic';
