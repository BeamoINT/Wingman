-- Metro matching + location security hardening
-- US-first metro grouping with city/state/country fallback for non-US users.

BEGIN;

-- ---------------------------------------------------------------------------
-- Metro lookup tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.us_metro_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cbsa_code TEXT NOT NULL UNIQUE,
  metro_name TEXT NOT NULL,
  display_city TEXT NOT NULL,
  state_code TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.us_city_metro_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_city TEXT NOT NULL,
  state_code TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  metro_area_id UUID NOT NULL REFERENCES public.us_metro_areas(id) ON DELETE CASCADE,
  source_priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(normalized_city, state_code, country_code)
);

CREATE TABLE IF NOT EXISTS public.friend_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friend_blocks_not_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT friend_blocks_pair_unique UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_us_city_metro_aliases_lookup
  ON public.us_city_metro_aliases(normalized_city, state_code, country_code);

CREATE INDEX IF NOT EXISTS idx_us_city_metro_aliases_metro
  ON public.us_city_metro_aliases(metro_area_id);

CREATE INDEX IF NOT EXISTS idx_friend_blocks_blocker ON public.friend_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_friend_blocks_blocked ON public.friend_blocks(blocked_id);

-- Keep updated_at fresh.
DROP TRIGGER IF EXISTS trg_us_metro_areas_updated_at ON public.us_metro_areas;
CREATE TRIGGER trg_us_metro_areas_updated_at
BEFORE UPDATE ON public.us_metro_areas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_us_city_metro_aliases_updated_at ON public.us_city_metro_aliases;
CREATE TRIGGER trg_us_city_metro_aliases_updated_at
BEFORE UPDATE ON public.us_city_metro_aliases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS for metro lookup + blocks
-- ---------------------------------------------------------------------------

ALTER TABLE public.us_metro_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.us_city_metro_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view metro areas" ON public.us_metro_areas;
CREATE POLICY "Authenticated users can view metro areas"
ON public.us_metro_areas
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view metro aliases" ON public.us_city_metro_aliases;
CREATE POLICY "Authenticated users can view metro aliases"
ON public.us_city_metro_aliases
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Participants can view friend blocks" ON public.friend_blocks;
CREATE POLICY "Participants can view friend blocks"
ON public.friend_blocks
FOR SELECT
USING (auth.uid() IN (blocker_id, blocked_id));

DROP POLICY IF EXISTS "Users can insert own block records" ON public.friend_blocks;
CREATE POLICY "Users can insert own block records"
ON public.friend_blocks
FOR INSERT
WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can remove own block records" ON public.friend_blocks;
CREATE POLICY "Users can remove own block records"
ON public.friend_blocks
FOR DELETE
USING (auth.uid() = blocker_id);

-- ---------------------------------------------------------------------------
-- Profiles metro fields (coarse location only)
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS metro_area_id UUID REFERENCES public.us_metro_areas(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS metro_area_name TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS metro_city TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS metro_state TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS metro_country TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS metro_resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_metro_area_id ON public.profiles(metro_area_id);
CREATE INDEX IF NOT EXISTS idx_profiles_city_state_country ON public.profiles(country, state, city);

-- Optional guard: reject precise location writes from client payloads if legacy
-- coordinate fields exist in any environment.
CREATE OR REPLACE FUNCTION public.reject_precise_profile_location_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  raw_lat TEXT;
  raw_lng TEXT;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  raw_lat := to_jsonb(NEW) ->> 'location_lat';
  raw_lng := to_jsonb(NEW) ->> 'location_lng';

  IF COALESCE(NULLIF(trim(raw_lat), ''), '') <> ''
     OR COALESCE(NULLIF(trim(raw_lng), ''), '') <> '' THEN
    RAISE EXCEPTION 'Precise location writes are not allowed.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_precise_profile_location_writes ON public.profiles;
CREATE TRIGGER trg_reject_precise_profile_location_writes
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.reject_precise_profile_location_writes();

-- ---------------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_city_text(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(lower(trim(COALESCE(p_value, ''))), '\.', '', 'g'),
      '\s+', ' ', 'g'
    ),
    '[^a-z0-9 ]', '',
    'g'
  );
$$;

-- ---------------------------------------------------------------------------
-- Seed metro data (US-first, real metro aliases)
-- ---------------------------------------------------------------------------

WITH upsert_metros AS (
  INSERT INTO public.us_metro_areas (cbsa_code, metro_name, display_city, state_code, country_code)
  VALUES
    ('34980', 'Nashville-Davidson--Murfreesboro--Franklin, TN Metro', 'Nashville Metro', 'TN', 'US'),
    ('35620', 'New York-Newark-Jersey City, NY-NJ-PA Metro', 'New York Metro', 'NY', 'US'),
    ('16980', 'Chicago-Naperville-Elgin, IL-IN-WI Metro', 'Chicago Metro', 'IL', 'US'),
    ('19100', 'Dallas-Fort Worth-Arlington, TX Metro', 'Dallas-Fort Worth Metro', 'TX', 'US'),
    ('26420', 'Houston-The Woodlands-Sugar Land, TX Metro', 'Houston Metro', 'TX', 'US'),
    ('31100', 'Los Angeles-Long Beach-Anaheim, CA Metro', 'Los Angeles Metro', 'CA', 'US'),
    ('12060', 'Atlanta-Sandy Springs-Alpharetta, GA Metro', 'Atlanta Metro', 'GA', 'US'),
    ('37980', 'Philadelphia-Camden-Wilmington, PA-NJ-DE-MD Metro', 'Philadelphia Metro', 'PA', 'US'),
    ('41700', 'San Antonio-New Braunfels, TX Metro', 'San Antonio Metro', 'TX', 'US'),
    ('42660', 'Seattle-Tacoma-Bellevue, WA Metro', 'Seattle Metro', 'WA', 'US'),
    ('41860', 'San Francisco-Oakland-Berkeley, CA Metro', 'San Francisco Bay Area', 'CA', 'US'),
    ('47900', 'Washington-Arlington-Alexandria, DC-VA-MD-WV Metro', 'Washington DC Metro', 'DC', 'US'),
    ('33100', 'Miami-Fort Lauderdale-Pompano Beach, FL Metro', 'Miami Metro', 'FL', 'US'),
    ('38060', 'Phoenix-Mesa-Chandler, AZ Metro', 'Phoenix Metro', 'AZ', 'US'),
    ('29820', 'Las Vegas-Henderson-Paradise, NV Metro', 'Las Vegas Metro', 'NV', 'US')
  ON CONFLICT (cbsa_code) DO UPDATE
  SET
    metro_name = EXCLUDED.metro_name,
    display_city = EXCLUDED.display_city,
    state_code = EXCLUDED.state_code,
    country_code = EXCLUDED.country_code,
    updated_at = NOW()
  RETURNING id, cbsa_code
)
INSERT INTO public.us_city_metro_aliases (normalized_city, state_code, country_code, metro_area_id, source_priority)
SELECT alias_city, alias_state, 'US', m.id, alias_priority
FROM (
  VALUES
    ('nashville', 'TN', '34980', 1),
    ('franklin', 'TN', '34980', 1),
    ('mt juliet', 'TN', '34980', 1),
    ('mount juliet', 'TN', '34980', 1),
    ('murfreesboro', 'TN', '34980', 1),
    ('brentwood', 'TN', '34980', 1),
    ('smyrna', 'TN', '34980', 1),
    ('new york', 'NY', '35620', 1),
    ('brooklyn', 'NY', '35620', 1),
    ('queens', 'NY', '35620', 1),
    ('jersey city', 'NJ', '35620', 1),
    ('newark', 'NJ', '35620', 1),
    ('los angeles', 'CA', '31100', 1),
    ('long beach', 'CA', '31100', 1),
    ('anaheim', 'CA', '31100', 1),
    ('chicago', 'IL', '16980', 1),
    ('naperville', 'IL', '16980', 1),
    ('elgin', 'IL', '16980', 1),
    ('dallas', 'TX', '19100', 1),
    ('fort worth', 'TX', '19100', 1),
    ('arlington', 'TX', '19100', 1),
    ('houston', 'TX', '26420', 1),
    ('the woodlands', 'TX', '26420', 1),
    ('sugar land', 'TX', '26420', 1),
    ('atlanta', 'GA', '12060', 1),
    ('alpharetta', 'GA', '12060', 1),
    ('sandy springs', 'GA', '12060', 1),
    ('philadelphia', 'PA', '37980', 1),
    ('camden', 'NJ', '37980', 1),
    ('san antonio', 'TX', '41700', 1),
    ('seattle', 'WA', '42660', 1),
    ('tacoma', 'WA', '42660', 1),
    ('bellevue', 'WA', '42660', 1),
    ('san francisco', 'CA', '41860', 1),
    ('oakland', 'CA', '41860', 1),
    ('berkeley', 'CA', '41860', 1),
    ('washington', 'DC', '47900', 1),
    ('arlington', 'VA', '47900', 1),
    ('alexandria', 'VA', '47900', 1),
    ('miami', 'FL', '33100', 1),
    ('fort lauderdale', 'FL', '33100', 1),
    ('pompano beach', 'FL', '33100', 1),
    ('phoenix', 'AZ', '38060', 1),
    ('mesa', 'AZ', '38060', 1),
    ('chandler', 'AZ', '38060', 1),
    ('las vegas', 'NV', '29820', 1),
    ('henderson', 'NV', '29820', 1)
) AS alias_data(alias_city, alias_state, alias_cbsa, alias_priority)
JOIN public.us_metro_areas m ON m.cbsa_code = alias_data.alias_cbsa
ON CONFLICT (normalized_city, state_code, country_code) DO UPDATE
SET
  metro_area_id = EXCLUDED.metro_area_id,
  source_priority = LEAST(public.us_city_metro_aliases.source_priority, EXCLUDED.source_priority),
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Harden profile read policy (owner-only raw location access)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  profile_select_policy RECORD;
BEGIN
  FOR profile_select_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', profile_select_policy.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "Users can view own profile row"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Controlled public read path for non-sensitive profile fields
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.bio,
  p.date_of_birth,
  p.gender,
  p.email_verified,
  p.phone_verified,
  p.id_verified,
  p.verification_level,
  p.subscription_tier,
  p.pro_status,
  p.message_encryption_public_key,
  p.message_encryption_key_version,
  p.message_encryption_updated_at,
  p.metro_area_id,
  p.metro_area_name,
  p.metro_city,
  p.metro_state,
  p.metro_country,
  p.created_at,
  p.updated_at
FROM public.profiles p;

GRANT SELECT ON public.profiles_public TO authenticated;

-- ---------------------------------------------------------------------------
-- Metro-first recommendations
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_friend_recommendations_v3(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  metro_area_id UUID,
  metro_area_name TEXT,
  metro_city TEXT,
  metro_state TEXT,
  metro_country TEXT,
  location_label TEXT,
  headline TEXT,
  about TEXT,
  compatibility_score INTEGER,
  shared_interests TEXT[],
  shared_languages TEXT[],
  shared_goals TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH me AS (
    SELECT
      p.id AS me_id,
      p.metro_area_id AS me_metro_area_id,
      lower(trim(COALESCE(p.city, ''))) AS me_city,
      lower(trim(COALESCE(p.state, ''))) AS me_state,
      lower(trim(COALESCE(p.country, ''))) AS me_country,
      COALESCE(fp.interests, ARRAY[]::TEXT[]) AS me_interests,
      COALESCE(fp.languages, ARRAY[]::TEXT[]) AS me_languages,
      COALESCE(fp.friendship_goals, ARRAY[]::TEXT[]) AS me_goals
    FROM public.profiles p
    LEFT JOIN public.friend_profiles fp ON fp.user_id = p.id
    WHERE p.id = current_user_id
  ),
  candidates AS (
    SELECT
      p.id,
      p.first_name,
      p.last_name,
      p.avatar_url,
      p.metro_area_id,
      p.metro_area_name,
      p.metro_city,
      p.metro_state,
      p.metro_country,
      p.city,
      p.state,
      p.country,
      fp.headline,
      fp.about,
      fp.updated_at,
      COALESCE(fp.interests, ARRAY[]::TEXT[]) AS interests,
      COALESCE(fp.languages, ARRAY[]::TEXT[]) AS languages,
      COALESCE(fp.friendship_goals, ARRAY[]::TEXT[]) AS friendship_goals,
      me.me_metro_area_id,
      me.me_city,
      me.me_state,
      me.me_country,
      me.me_interests,
      me.me_languages,
      me.me_goals
    FROM public.profiles p
    LEFT JOIN public.friend_profiles fp ON fp.user_id = p.id
    CROSS JOIN me
    WHERE p.id <> current_user_id
      AND COALESCE(fp.discoverable, true) = true
      AND COALESCE(p.id_verified, false) = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.friend_connections fc
        WHERE fc.user_low = LEAST(current_user_id, p.id)
          AND fc.user_high = GREATEST(current_user_id, p.id)
          AND fc.status IN ('pending', 'accepted', 'blocked')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.friend_blocks fb
        WHERE (
          (fb.blocker_id = current_user_id AND fb.blocked_id = p.id)
          OR (fb.blocker_id = p.id AND fb.blocked_id = current_user_id)
        )
      )
  ),
  scored AS (
    SELECT
      c.*,
      public.array_intersection_text(c.interests, c.me_interests) AS shared_interests_calc,
      public.array_intersection_text(c.languages, c.me_languages) AS shared_languages_calc,
      public.array_intersection_text(c.friendship_goals, c.me_goals) AS shared_goals_calc
    FROM candidates c
  )
  SELECT
    s.id AS user_id,
    s.first_name,
    s.last_name,
    s.avatar_url,
    s.metro_area_id,
    s.metro_area_name,
    s.metro_city,
    s.metro_state,
    s.metro_country,
    COALESCE(
      NULLIF(trim(s.metro_area_name), ''),
      CASE
        WHEN NULLIF(trim(COALESCE(s.city, '')), '') IS NOT NULL
          THEN concat_ws(', ', NULLIF(trim(s.city), ''), NULLIF(trim(s.state), ''), NULLIF(trim(s.country), ''))
        ELSE 'Location unavailable'
      END
    ) AS location_label,
    s.headline,
    s.about,
    (
      CASE
        WHEN s.metro_area_id IS NOT NULL
             AND s.me_metro_area_id IS NOT NULL
             AND s.metro_area_id = s.me_metro_area_id
          THEN 36
        WHEN s.metro_area_id IS NULL
             AND s.me_metro_area_id IS NULL
             AND lower(trim(COALESCE(s.city, ''))) = s.me_city
             AND lower(trim(COALESCE(s.state, ''))) = s.me_state
             AND lower(trim(COALESCE(s.country, ''))) = s.me_country
          THEN 20
        WHEN lower(trim(COALESCE(s.country, ''))) = s.me_country
          THEN 4
        ELSE 0
      END
      + LEAST(COALESCE(array_length(s.shared_interests_calc, 1), 0), 4) * 11
      + LEAST(COALESCE(array_length(s.shared_goals_calc, 1), 0), 3) * 14
      + LEAST(COALESCE(array_length(s.shared_languages_calc, 1), 0), 3) * 8
      + CASE WHEN COALESCE(s.avatar_url, '') <> '' THEN 4 ELSE 0 END
      + CASE WHEN s.updated_at IS NOT NULL AND s.updated_at >= (NOW() - interval '30 days') THEN 4 ELSE 0 END
    )::INTEGER AS compatibility_score,
    s.shared_interests_calc AS shared_interests,
    s.shared_languages_calc AS shared_languages,
    s.shared_goals_calc AS shared_goals
  FROM scored s
  ORDER BY
    compatibility_score DESC,
    s.updated_at DESC,
    s.id ASC
  LIMIT GREATEST(COALESCE(p_limit, 20), 0)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_friend_recommendations_v3(INTEGER, INTEGER) TO authenticated;

COMMIT;
