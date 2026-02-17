-- Backfill booking schema for legacy production environments.
-- Safe to run multiple times because each add uses IF NOT EXISTS.

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS client_id UUID;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS companion_id UUID;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS date DATE;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS start_time TIME;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS end_time TIME;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS duration_hours INTEGER;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2) DEFAULT 0;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS service_fee NUMERIC(10,2) DEFAULT 0;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2) DEFAULT 0;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS location_name TEXT;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS location_address TEXT;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS activity_type TEXT;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS cancelled_by UUID;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Normalize commonly missing values.
UPDATE bookings
SET
  status = COALESCE(NULLIF(TRIM(status), ''), 'pending'),
  hourly_rate = COALESCE(hourly_rate, 0),
  subtotal = COALESCE(subtotal, 0),
  service_fee = COALESCE(service_fee, 0),
  total_price = COALESCE(total_price, COALESCE(subtotal, 0) + COALESCE(service_fee, 0)),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW());

-- Backfill canonical owner/companion columns from known legacy column names, when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'UPDATE bookings SET client_id = COALESCE(client_id, user_id) WHERE client_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'booker_id'
  ) THEN
    EXECUTE 'UPDATE bookings SET client_id = COALESCE(client_id, booker_id) WHERE client_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'requester_id'
  ) THEN
    EXECUTE 'UPDATE bookings SET client_id = COALESCE(client_id, requester_id) WHERE client_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'profile_id'
  ) THEN
    EXECUTE 'UPDATE bookings SET client_id = COALESCE(client_id, profile_id) WHERE client_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'provider_id'
  ) THEN
    EXECUTE 'UPDATE bookings SET companion_id = COALESCE(companion_id, provider_id) WHERE companion_id IS NULL';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_companion ON bookings(companion_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
