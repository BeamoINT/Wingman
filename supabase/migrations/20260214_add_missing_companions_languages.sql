-- Ensure legacy databases include companions.languages used by the app.
ALTER TABLE companions
ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}'::TEXT[];

-- Normalize existing nulls to an empty array for consistent reads.
UPDATE companions
SET languages = '{}'::TEXT[]
WHERE languages IS NULL;
