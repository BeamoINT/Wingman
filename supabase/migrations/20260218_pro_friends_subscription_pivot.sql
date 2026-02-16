-- Wingman Pro Friends pivot
-- Single subscription tier (Pro) + ranked friend matching + connection requests

BEGIN;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.array_intersection_text(a TEXT[], b TEXT[])
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT item
      FROM unnest(COALESCE(a, ARRAY[]::TEXT[])) AS item
      WHERE item = ANY(COALESCE(b, ARRAY[]::TEXT[]))
      ORDER BY item
    ),
    ARRAY[]::TEXT[]
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles: normalize subscription model
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';

UPDATE public.profiles
SET subscription_tier = CASE
  WHEN LOWER(COALESCE(subscription_tier, 'free')) = 'pro' THEN 'pro'
  ELSE 'free'
END;

ALTER TABLE public.profiles
  ALTER COLUMN subscription_tier SET DEFAULT 'free';

DO $$
DECLARE
  existing_constraint RECORD;
BEGIN
  FOR existing_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%subscription_tier%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', existing_constraint.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'pro'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_status TEXT DEFAULT 'inactive'
  CHECK (pro_status IN ('inactive', 'active', 'grace', 'past_due', 'canceled'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_platform TEXT
  CHECK (pro_platform IS NULL OR pro_platform IN ('ios', 'android', 'web'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_product_id TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_started_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_renews_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_entitlement_updated_at TIMESTAMPTZ;

UPDATE public.profiles
SET
  pro_status = COALESCE(pro_status, 'inactive'),
  pro_platform = NULLIF(pro_platform, ''),
  pro_entitlement_updated_at = COALESCE(pro_entitlement_updated_at, NOW())
WHERE true;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_pro_status ON public.profiles(pro_status);
CREATE INDEX IF NOT EXISTS idx_profiles_pro_expires_at ON public.profiles(pro_expires_at);

-- ---------------------------------------------------------------------------
-- Friend profile model (matching attributes)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.friend_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline TEXT,
  about TEXT,
  interests TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  languages TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  friendship_goals TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  preferred_age_min INTEGER,
  preferred_age_max INTEGER,
  max_distance_km INTEGER,
  discoverable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friend_profiles_preferred_age_check CHECK (
    preferred_age_min IS NULL
    OR preferred_age_max IS NULL
    OR preferred_age_min <= preferred_age_max
  )
);

CREATE INDEX IF NOT EXISTS idx_friend_profiles_discoverable ON public.friend_profiles(discoverable);
CREATE INDEX IF NOT EXISTS idx_friend_profiles_interests ON public.friend_profiles USING GIN (interests);
CREATE INDEX IF NOT EXISTS idx_friend_profiles_languages ON public.friend_profiles USING GIN (languages);
CREATE INDEX IF NOT EXISTS idx_friend_profiles_friendship_goals ON public.friend_profiles USING GIN (friendship_goals);
CREATE INDEX IF NOT EXISTS idx_friend_profiles_updated_at ON public.friend_profiles(updated_at DESC);

DROP TRIGGER IF EXISTS trg_friend_profiles_updated_at ON public.friend_profiles;
CREATE TRIGGER trg_friend_profiles_updated_at
BEFORE UPDATE ON public.friend_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.friend_profiles (
  user_id,
  about,
  headline
)
SELECT
  p.id,
  p.bio,
  NULL
FROM public.profiles p
ON CONFLICT (user_id) DO UPDATE
SET about = COALESCE(public.friend_profiles.about, EXCLUDED.about);

-- ---------------------------------------------------------------------------
-- Friend connections model (request + accept)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.friend_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_low UUID GENERATED ALWAYS AS (LEAST(requester_id, recipient_id)) STORED,
  user_high UUID GENERATED ALWAYS AS (GREATEST(requester_id, recipient_id)) STORED,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'canceled', 'blocked')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friend_connections_self_check CHECK (requester_id <> recipient_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_connections_pair_unique
ON public.friend_connections(user_low, user_high);

CREATE INDEX IF NOT EXISTS idx_friend_connections_requester ON public.friend_connections(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_connections_recipient ON public.friend_connections(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_connections_updated_at ON public.friend_connections(updated_at DESC);

DROP TRIGGER IF EXISTS trg_friend_connections_updated_at ON public.friend_connections;
CREATE TRIGGER trg_friend_connections_updated_at
BEFORE UPDATE ON public.friend_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Subscription event audit log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON public.subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_provider_type ON public.subscription_events(provider, event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON public.subscription_events(created_at DESC);

-- ---------------------------------------------------------------------------
-- Pro entitlement helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_pro_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.subscription_tier = 'pro'
      AND (
        p.pro_status IN ('active', 'grace')
        OR (
          p.pro_status = 'past_due'
          AND p.pro_expires_at IS NOT NULL
          AND p.pro_expires_at > NOW()
        )
      )
      AND (
        p.pro_expires_at IS NULL
        OR p.pro_expires_at > NOW()
        OR p.pro_status = 'grace'
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Ranked friend recommendations
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_friend_recommendations_v2(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
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
      p.city AS me_city,
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
      p.city,
      p.state,
      p.country,
      fp.headline,
      fp.about,
      fp.updated_at,
      COALESCE(fp.interests, ARRAY[]::TEXT[]) AS interests,
      COALESCE(fp.languages, ARRAY[]::TEXT[]) AS languages,
      COALESCE(fp.friendship_goals, ARRAY[]::TEXT[]) AS friendship_goals,
      me.me_city,
      me.me_interests,
      me.me_languages,
      me.me_goals
    FROM public.profiles p
    LEFT JOIN public.friend_profiles fp
      ON fp.user_id = p.id
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
    s.city,
    s.state,
    s.country,
    s.headline,
    s.about,
    (
      CASE WHEN COALESCE(s.city, '') <> '' AND s.city = s.me_city THEN 30 ELSE 0 END
      + LEAST(COALESCE(array_length(s.shared_interests_calc, 1), 0), 4) * 12
      + LEAST(COALESCE(array_length(s.shared_goals_calc, 1), 0), 3) * 15
      + LEAST(COALESCE(array_length(s.shared_languages_calc, 1), 0), 3) * 10
      + CASE WHEN COALESCE(s.avatar_url, '') <> '' THEN 5 ELSE 0 END
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

GRANT EXECUTE ON FUNCTION public.get_friend_recommendations_v2(INTEGER, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Connection workflow RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_connection_request_v1(p_target_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  existing_connection public.friend_connections%ROWTYPE;
  new_connection_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_target_user_id IS NULL OR p_target_user_id = current_user_id THEN
    RAISE EXCEPTION 'Invalid target user';
  END IF;

  SELECT *
  INTO existing_connection
  FROM public.friend_connections
  WHERE user_low = LEAST(current_user_id, p_target_user_id)
    AND user_high = GREATEST(current_user_id, p_target_user_id)
  LIMIT 1;

  IF FOUND THEN
    IF existing_connection.status = 'blocked' THEN
      RAISE EXCEPTION 'Connection cannot be requested for blocked users';
    END IF;

    IF existing_connection.status = 'accepted' THEN
      RETURN existing_connection.id;
    END IF;

    IF existing_connection.status = 'pending' THEN
      IF existing_connection.requester_id = current_user_id THEN
        RETURN existing_connection.id;
      END IF;

      UPDATE public.friend_connections
      SET
        status = 'accepted',
        responded_at = NOW(),
        updated_at = NOW()
      WHERE id = existing_connection.id;

      RETURN existing_connection.id;
    END IF;

    UPDATE public.friend_connections
    SET
      requester_id = current_user_id,
      recipient_id = p_target_user_id,
      status = 'pending',
      requested_at = NOW(),
      responded_at = NULL,
      updated_at = NOW()
    WHERE id = existing_connection.id;

    RETURN existing_connection.id;
  END IF;

  INSERT INTO public.friend_connections (
    requester_id,
    recipient_id,
    status,
    requested_at
  )
  VALUES (
    current_user_id,
    p_target_user_id,
    'pending',
    NOW()
  )
  RETURNING id INTO new_connection_id;

  RETURN new_connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_connection_request_v1(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_connection_request_v1(
  p_connection_id UUID,
  p_decision TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  requested_decision TEXT := LOWER(COALESCE(p_decision, ''));
  connection_row public.friend_connections%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF requested_decision NOT IN ('accepted', 'declined', 'canceled', 'blocked') THEN
    RAISE EXCEPTION 'Unsupported decision';
  END IF;

  SELECT *
  INTO connection_row
  FROM public.friend_connections
  WHERE id = p_connection_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;

  IF current_user_id NOT IN (connection_row.requester_id, connection_row.recipient_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF requested_decision IN ('accepted', 'declined')
     AND current_user_id <> connection_row.recipient_id THEN
    RAISE EXCEPTION 'Only recipient can accept or decline';
  END IF;

  IF requested_decision = 'canceled'
     AND current_user_id <> connection_row.requester_id THEN
    RAISE EXCEPTION 'Only requester can cancel';
  END IF;

  UPDATE public.friend_connections
  SET
    status = requested_decision,
    responded_at = CASE
      WHEN requested_decision IN ('accepted', 'declined', 'canceled', 'blocked') THEN NOW()
      ELSE responded_at
    END,
    updated_at = NOW()
  WHERE id = p_connection_id;

  RETURN p_connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_connection_request_v1(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: friend_profiles + friend_connections + subscription_events
-- ---------------------------------------------------------------------------

ALTER TABLE public.friend_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view discoverable friend profiles" ON public.friend_profiles;
CREATE POLICY "Authenticated users can view discoverable friend profiles"
ON public.friend_profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert own friend profile" ON public.friend_profiles;
CREATE POLICY "Users can insert own friend profile"
ON public.friend_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own friend profile" ON public.friend_profiles;
CREATE POLICY "Users can update own friend profile"
ON public.friend_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own friend profile" ON public.friend_profiles;
CREATE POLICY "Users can delete own friend profile"
ON public.friend_profiles
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Participants can view friend connections" ON public.friend_connections;
CREATE POLICY "Participants can view friend connections"
ON public.friend_connections
FOR SELECT
USING (auth.uid() IN (requester_id, recipient_id));

DROP POLICY IF EXISTS "Users can create outgoing friend connections" ON public.friend_connections;
CREATE POLICY "Users can create outgoing friend connections"
ON public.friend_connections
FOR INSERT
WITH CHECK (auth.uid() = requester_id AND requester_id <> recipient_id);

DROP POLICY IF EXISTS "Participants can update friend connections" ON public.friend_connections;
CREATE POLICY "Participants can update friend connections"
ON public.friend_connections
FOR UPDATE
USING (auth.uid() IN (requester_id, recipient_id))
WITH CHECK (auth.uid() IN (requester_id, recipient_id));

DROP POLICY IF EXISTS "Participants can delete friend connections" ON public.friend_connections;
CREATE POLICY "Participants can delete friend connections"
ON public.friend_connections
FOR DELETE
USING (auth.uid() IN (requester_id, recipient_id));

DROP POLICY IF EXISTS "Users can view own subscription events" ON public.subscription_events;
CREATE POLICY "Users can view own subscription events"
ON public.subscription_events
FOR SELECT
USING (auth.uid() = user_id);

-- service-role only writes
DROP POLICY IF EXISTS "Service role can insert subscription events" ON public.subscription_events;
CREATE POLICY "Service role can insert subscription events"
ON public.subscription_events
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- RLS: Friends feature tables become Pro-only
-- ---------------------------------------------------------------------------

ALTER TABLE public.friend_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view public posts" ON public.friend_posts;
DROP POLICY IF EXISTS "Users can create own posts" ON public.friend_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.friend_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.friend_posts;

CREATE POLICY "Pro users can view posts"
ON public.friend_posts
FOR SELECT
USING (public.is_pro_user(auth.uid()));

CREATE POLICY "Pro users can create own posts"
ON public.friend_posts
FOR INSERT
WITH CHECK (public.is_pro_user(auth.uid()) AND auth.uid() = author_id);

CREATE POLICY "Pro users can update own posts"
ON public.friend_posts
FOR UPDATE
USING (public.is_pro_user(auth.uid()) AND auth.uid() = author_id)
WITH CHECK (public.is_pro_user(auth.uid()) AND auth.uid() = author_id);

CREATE POLICY "Pro users can delete own posts"
ON public.friend_posts
FOR DELETE
USING (public.is_pro_user(auth.uid()) AND auth.uid() = author_id);

DROP POLICY IF EXISTS "Anyone can view public groups" ON public.friend_groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.friend_groups;
DROP POLICY IF EXISTS "Admins can update groups" ON public.friend_groups;

CREATE POLICY "Pro users can view groups"
ON public.friend_groups
FOR SELECT
USING (public.is_pro_user(auth.uid()));

CREATE POLICY "Pro users can create groups"
ON public.friend_groups
FOR INSERT
WITH CHECK (public.is_pro_user(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Pro admins can update groups"
ON public.friend_groups
FOR UPDATE
USING (
  public.is_pro_user(auth.uid())
  AND (
    auth.uid() = created_by
    OR auth.uid() IN (
      SELECT gm.user_id
      FROM public.group_memberships gm
      WHERE gm.group_id = friend_groups.id
        AND gm.role = 'admin'
    )
  )
)
WITH CHECK (public.is_pro_user(auth.uid()));

DROP POLICY IF EXISTS "Members can view memberships" ON public.group_memberships;
DROP POLICY IF EXISTS "Users can join groups" ON public.group_memberships;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_memberships;

CREATE POLICY "Pro users can view memberships"
ON public.group_memberships
FOR SELECT
USING (public.is_pro_user(auth.uid()));

CREATE POLICY "Pro users can join groups"
ON public.group_memberships
FOR INSERT
WITH CHECK (public.is_pro_user(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Pro users can leave groups"
ON public.group_memberships
FOR DELETE
USING (public.is_pro_user(auth.uid()) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view public events" ON public.friend_events;
DROP POLICY IF EXISTS "Users can create events" ON public.friend_events;
DROP POLICY IF EXISTS "Hosts can update events" ON public.friend_events;

CREATE POLICY "Pro users can view events"
ON public.friend_events
FOR SELECT
USING (public.is_pro_user(auth.uid()));

CREATE POLICY "Pro users can create events"
ON public.friend_events
FOR INSERT
WITH CHECK (public.is_pro_user(auth.uid()) AND auth.uid() = host_id);

CREATE POLICY "Pro hosts can update events"
ON public.friend_events
FOR UPDATE
USING (public.is_pro_user(auth.uid()) AND auth.uid() = host_id)
WITH CHECK (public.is_pro_user(auth.uid()) AND auth.uid() = host_id);

DROP POLICY IF EXISTS "Anyone can view RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can update own RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can delete own RSVP" ON public.event_rsvps;

CREATE POLICY "Pro users can view RSVPs"
ON public.event_rsvps
FOR SELECT
USING (public.is_pro_user(auth.uid()));

CREATE POLICY "Pro users can RSVP"
ON public.event_rsvps
FOR INSERT
WITH CHECK (public.is_pro_user(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Pro users can update own RSVP"
ON public.event_rsvps
FOR UPDATE
USING (public.is_pro_user(auth.uid()) AND auth.uid() = user_id)
WITH CHECK (public.is_pro_user(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Pro users can delete own RSVP"
ON public.event_rsvps
FOR DELETE
USING (public.is_pro_user(auth.uid()) AND auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Legacy swipe/match tables become read-only for rollback visibility
-- ---------------------------------------------------------------------------

ALTER TABLE public.match_swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create swipes" ON public.match_swipes;
DROP POLICY IF EXISTS "Users can update swipes" ON public.match_swipes;
DROP POLICY IF EXISTS "Users can delete swipes" ON public.match_swipes;

DROP POLICY IF EXISTS "Users can insert matches" ON public.friend_matches;
DROP POLICY IF EXISTS "Users can update matches" ON public.friend_matches;
DROP POLICY IF EXISTS "Users can delete matches" ON public.friend_matches;

COMMIT;
