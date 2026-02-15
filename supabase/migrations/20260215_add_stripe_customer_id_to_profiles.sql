-- Add Stripe customer mapping for authenticated customer portal sessions.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
ON profiles(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;
