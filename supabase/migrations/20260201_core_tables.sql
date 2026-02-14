-- Core Tables Migration for Wingman App
-- This creates the production database schema

-- ===========================================
-- Profiles Table (extends Supabase auth.users)
-- ===========================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  date_of_birth DATE,
  gender TEXT,
  city TEXT,
  state TEXT,
  country TEXT,

  -- Verification status
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  id_verified BOOLEAN DEFAULT FALSE,
  id_verified_at TIMESTAMPTZ,
  verification_level TEXT DEFAULT 'basic',

  -- Legal consents
  terms_accepted BOOLEAN DEFAULT FALSE,
  terms_accepted_at TIMESTAMPTZ,
  terms_version TEXT,
  privacy_accepted BOOLEAN DEFAULT FALSE,
  privacy_accepted_at TIMESTAMPTZ,
  privacy_version TEXT,
  age_confirmed BOOLEAN DEFAULT FALSE,
  age_confirmed_at TIMESTAMPTZ,

  -- Subscription
  subscription_tier TEXT DEFAULT 'free',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- Companions Table
-- ===========================================
CREATE TABLE IF NOT EXISTS companions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  hourly_rate DECIMAL(10,2) NOT NULL,
  specialties TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  about TEXT,
  gallery TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  completed_bookings INTEGER DEFAULT 0,
  response_time TEXT DEFAULT 'Usually responds within 1 hour',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- Bookings Table
-- ===========================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  companion_id UUID REFERENCES companions(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed')),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  duration_hours INTEGER NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  service_fee DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  location_name TEXT,
  location_address TEXT,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  activity_type TEXT,
  notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles(id),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- Conversations Table
-- ===========================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2 UUID REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2)
);

-- ===========================================
-- Messages Table
-- ===========================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'booking_request', 'system')),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- Reviews Table
-- ===========================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  tags TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- Friends Feature Tables
-- ===========================================

-- Friend Posts (Social Feed)
CREATE TABLE IF NOT EXISTS friend_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'event_share', 'group_share')),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post Likes
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES friend_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Post Comments
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES friend_posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Friend Groups
CREATE TABLE IF NOT EXISTS friend_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  cover_image TEXT,
  member_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Memberships
CREATE TABLE IF NOT EXISTS group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES friend_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Friend Events
CREATE TABLE IF NOT EXISTS friend_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  cover_image TEXT,
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  location_address TEXT,
  location_city TEXT NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  end_date_time TIMESTAMPTZ,
  max_attendees INTEGER,
  current_attendees INTEGER DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  group_id UUID REFERENCES friend_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event RSVPs
CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES friend_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'going' CHECK (status IN ('going', 'interested', 'not_going')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Friend Matches
CREATE TABLE IF NOT EXISTS friend_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1 UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id_2 UUID REFERENCES profiles(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'matched' CHECK (status IN ('matched', 'chatting', 'met_up', 'friends')),
  UNIQUE(user_id_1, user_id_2)
);

-- Match Swipes
CREATE TABLE IF NOT EXISTS match_swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'pass', 'super_like')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

-- ===========================================
-- Enable Row Level Security
-- ===========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_swipes ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- RLS Policies - Profiles
-- ===========================================
CREATE POLICY "Users can view any profile" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ===========================================
-- RLS Policies - Companions
-- ===========================================
CREATE POLICY "Anyone can view active companions" ON companions
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can insert own companion profile" ON companions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own companion profile" ON companions
  FOR UPDATE USING (auth.uid() = user_id);

-- ===========================================
-- RLS Policies - Bookings
-- ===========================================
CREATE POLICY "Users can view own bookings" ON bookings
  FOR SELECT USING (
    auth.uid() = client_id OR
    auth.uid() IN (SELECT user_id FROM companions WHERE id = companion_id)
  );

CREATE POLICY "Users can create bookings" ON bookings
  FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Participants can update bookings" ON bookings
  FOR UPDATE USING (
    auth.uid() = client_id OR
    auth.uid() IN (SELECT user_id FROM companions WHERE id = companion_id)
  );

-- ===========================================
-- RLS Policies - Conversations
-- ===========================================
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- ===========================================
-- RLS Policies - Messages
-- ===========================================
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE USING (auth.uid() = sender_id);

-- ===========================================
-- RLS Policies - Reviews
-- ===========================================
CREATE POLICY "Anyone can view reviews" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can create reviews for their bookings" ON reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id AND
    booking_id IN (
      SELECT id FROM bookings WHERE client_id = auth.uid() OR
      companion_id IN (SELECT id FROM companions WHERE user_id = auth.uid())
    )
  );

-- ===========================================
-- RLS Policies - Friend Posts
-- ===========================================
CREATE POLICY "Anyone can view public posts" ON friend_posts
  FOR SELECT USING (true);

CREATE POLICY "Users can create own posts" ON friend_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own posts" ON friend_posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own posts" ON friend_posts
  FOR DELETE USING (auth.uid() = author_id);

-- ===========================================
-- RLS Policies - Post Likes
-- ===========================================
CREATE POLICY "Anyone can view likes" ON post_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like posts" ON post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike" ON post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ===========================================
-- RLS Policies - Post Comments
-- ===========================================
CREATE POLICY "Anyone can view comments" ON post_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON post_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete own comments" ON post_comments
  FOR DELETE USING (auth.uid() = author_id);

-- ===========================================
-- RLS Policies - Groups
-- ===========================================
CREATE POLICY "Anyone can view public groups" ON friend_groups
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create groups" ON friend_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update groups" ON friend_groups
  FOR UPDATE USING (
    auth.uid() = created_by OR
    auth.uid() IN (
      SELECT user_id FROM group_memberships
      WHERE group_id = id AND role = 'admin'
    )
  );

-- ===========================================
-- RLS Policies - Group Memberships
-- ===========================================
CREATE POLICY "Members can view memberships" ON group_memberships
  FOR SELECT USING (true);

CREATE POLICY "Users can join groups" ON group_memberships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups" ON group_memberships
  FOR DELETE USING (auth.uid() = user_id);

-- ===========================================
-- RLS Policies - Events
-- ===========================================
CREATE POLICY "Anyone can view public events" ON friend_events
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create events" ON friend_events
  FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update events" ON friend_events
  FOR UPDATE USING (auth.uid() = host_id);

-- ===========================================
-- RLS Policies - Event RSVPs
-- ===========================================
CREATE POLICY "Anyone can view RSVPs" ON event_rsvps
  FOR SELECT USING (true);

CREATE POLICY "Users can RSVP" ON event_rsvps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RSVP" ON event_rsvps
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own RSVP" ON event_rsvps
  FOR DELETE USING (auth.uid() = user_id);

-- ===========================================
-- RLS Policies - Friend Matches
-- ===========================================
CREATE POLICY "Users can view own matches" ON friend_matches
  FOR SELECT USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- ===========================================
-- RLS Policies - Match Swipes
-- ===========================================
CREATE POLICY "Users can view own swipes" ON match_swipes
  FOR SELECT USING (auth.uid() = from_user_id);

CREATE POLICY "Users can create swipes" ON match_swipes
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- ===========================================
-- Triggers for updated_at
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companions_updated_at
  BEFORE UPDATE ON companions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friend_posts_updated_at
  BEFORE UPDATE ON friend_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friend_groups_updated_at
  BEFORE UPDATE ON friend_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Trigger: Auto-create profile on auth signup
-- ===========================================
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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===========================================
-- Trigger: Update companion rating on new review
-- ===========================================
CREATE OR REPLACE FUNCTION update_companion_rating()
RETURNS TRIGGER AS $$
DECLARE
  companion_user_id UUID;
  avg_rating DECIMAL;
  review_count INTEGER;
BEGIN
  -- Get the companion for this reviewee
  SELECT user_id INTO companion_user_id
  FROM companions c
  JOIN profiles p ON c.user_id = p.id
  WHERE p.id = NEW.reviewee_id;

  IF companion_user_id IS NOT NULL THEN
    -- Calculate new average rating
    SELECT AVG(rating), COUNT(*) INTO avg_rating, review_count
    FROM reviews
    WHERE reviewee_id = NEW.reviewee_id;

    -- Update companion
    UPDATE companions
    SET rating = avg_rating, review_count = review_count
    WHERE user_id = companion_user_id;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companion_rating_trigger
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_companion_rating();

-- ===========================================
-- Trigger: Update conversation last_message
-- ===========================================
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- ===========================================
-- Indexes for performance
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_companions_active ON companions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_companions_rating ON companions(rating DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_companion ON bookings(companion_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant_1, participant_2);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_friend_posts_author ON friend_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_friend_posts_created ON friend_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_events_date ON friend_events(date_time);
CREATE INDEX IF NOT EXISTS idx_friend_events_host ON friend_events(host_id);
