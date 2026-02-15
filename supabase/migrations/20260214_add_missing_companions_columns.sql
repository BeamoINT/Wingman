-- Backfill companion schema for older production environments.
-- Safe to run multiple times because every ADD uses IF NOT EXISTS.
ALTER TABLE companions
ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}'::TEXT[];

ALTER TABLE companions
ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}'::TEXT[];

ALTER TABLE companions
ADD COLUMN IF NOT EXISTS about TEXT;

ALTER TABLE companions
ADD COLUMN IF NOT EXISTS gallery TEXT[] DEFAULT '{}'::TEXT[];

ALTER TABLE companions
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE companions
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;

ALTER TABLE companions
ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0;

ALTER TABLE companions
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

ALTER TABLE companions
ADD COLUMN IF NOT EXISTS completed_bookings INTEGER DEFAULT 0;

ALTER TABLE companions
ADD COLUMN IF NOT EXISTS response_time TEXT DEFAULT 'Usually responds within 1 hour';

ALTER TABLE companions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE companions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE companions
SET
  specialties = COALESCE(specialties, '{}'::TEXT[]),
  languages = COALESCE(languages, '{}'::TEXT[]),
  gallery = COALESCE(gallery, '{}'::TEXT[]),
  is_active = COALESCE(is_active, TRUE),
  is_available = COALESCE(is_available, TRUE),
  rating = COALESCE(rating, 0),
  review_count = COALESCE(review_count, 0),
  completed_bookings = COALESCE(completed_bookings, 0),
  response_time = COALESCE(NULLIF(response_time, ''), 'Usually responds within 1 hour'),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW());
