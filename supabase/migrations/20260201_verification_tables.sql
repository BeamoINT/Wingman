-- ===========================================
-- VERIFICATION TABLES MIGRATION
-- Adds background check and verification preference tables
-- ===========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- 1. BACKGROUND CHECKS TABLE
-- Stores Checkr background check records
-- ===========================================
CREATE TABLE IF NOT EXISTS background_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Checkr specific fields
    checkr_candidate_id VARCHAR(255),
    checkr_invitation_id VARCHAR(255),
    checkr_report_id VARCHAR(255),

    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Valid values: 'pending', 'invitation_sent', 'processing', 'completed', 'failed', 'expired', 'disputed'

    -- Check details
    package VARCHAR(100) NOT NULL DEFAULT 'basic',
    -- Valid values: 'basic', 'standard', 'professional'

    -- Results (minimal for privacy)
    result VARCHAR(50),
    -- Valid values: 'clear', 'consider', 'adverse_action'

    result_summary JSONB,
    -- Stores: { "criminal_clear": true, "identity_verified": true, "ssn_valid": true }

    -- Timestamps
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_bg_check_status CHECK (status IN ('pending', 'invitation_sent', 'processing', 'completed', 'failed', 'expired', 'disputed')),
    CONSTRAINT valid_bg_check_result CHECK (result IS NULL OR result IN ('clear', 'consider', 'adverse_action'))
);

-- Indexes for background_checks
CREATE INDEX IF NOT EXISTS idx_background_checks_user_id ON background_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_background_checks_status ON background_checks(status);
CREATE INDEX IF NOT EXISTS idx_background_checks_checkr_report_id ON background_checks(checkr_report_id);
CREATE INDEX IF NOT EXISTS idx_background_checks_checkr_candidate_id ON background_checks(checkr_candidate_id);

-- ===========================================
-- 2. VERIFICATION PREFERENCES TABLE
-- User preferences for matching based on verification
-- ===========================================
CREATE TABLE IF NOT EXISTS verification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Matching preferences
    require_id_verified BOOLEAN NOT NULL DEFAULT false,
    require_background_checked BOOLEAN NOT NULL DEFAULT false,
    require_premium_verified BOOLEAN NOT NULL DEFAULT false,

    -- Display preferences
    show_verification_badges BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint - one preferences record per user
    CONSTRAINT unique_verification_preferences_user UNIQUE (user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_verification_preferences_user_id ON verification_preferences(user_id);

-- ===========================================
-- 3. VERIFICATION EVENTS TABLE (History/Audit Log)
-- Records all verification-related events
-- ===========================================
CREATE TABLE IF NOT EXISTS verification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Event details
    event_type VARCHAR(100) NOT NULL,
    -- Valid values: 'email_verified', 'phone_verified', 'id_verified', 'id_verification_failed',
    --              'background_check_initiated', 'background_check_completed', 'background_check_failed',
    --              'verification_level_upgraded', 'preferences_updated'

    event_status VARCHAR(50) NOT NULL DEFAULT 'success',
    -- Valid values: 'success', 'failed', 'pending'

    event_data JSONB,
    -- Additional event-specific data

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verification_events_user_id ON verification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_events_type ON verification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_verification_events_created ON verification_events(created_at DESC);

-- ===========================================
-- 4. UPDATE PROFILES TABLE
-- Add background check columns
-- ===========================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_level TEXT DEFAULT 'basic';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_checked BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_check_date TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_check_expires_at TIMESTAMPTZ;

-- Update verification_level to include 'background' if not already
-- The column should already exist from ID verification setup

-- Index for verification filtering
CREATE INDEX IF NOT EXISTS idx_profiles_background_checked ON profiles(background_checked);

-- ===========================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Enable RLS on new tables
ALTER TABLE background_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_events ENABLE ROW LEVEL SECURITY;

-- Background checks policies
-- Users can view their own background checks
CREATE POLICY "Users can view own background checks"
    ON background_checks FOR SELECT
    USING (auth.uid() = user_id);

-- Only service role (edge functions) can insert background checks
CREATE POLICY "Service role can insert background checks"
    ON background_checks FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Only service role (edge functions) can update background checks
CREATE POLICY "Service role can update background checks"
    ON background_checks FOR UPDATE
    USING (auth.role() = 'service_role');

-- Verification preferences policies
-- Users can view their own preferences
CREATE POLICY "Users can view own verification preferences"
    ON verification_preferences FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own verification preferences"
    ON verification_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own verification preferences"
    ON verification_preferences FOR UPDATE
    USING (auth.uid() = user_id);

-- Verification events policies
-- Users can view their own verification events
CREATE POLICY "Users can view own verification events"
    ON verification_events FOR SELECT
    USING (auth.uid() = user_id);

-- Only service role can insert verification events
CREATE POLICY "Service role can insert verification events"
    ON verification_events FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ===========================================
-- 6. FUNCTIONS & TRIGGERS
-- ===========================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for background_checks
DROP TRIGGER IF EXISTS update_background_checks_updated_at ON background_checks;
CREATE TRIGGER update_background_checks_updated_at
    BEFORE UPDATE ON background_checks
    FOR EACH ROW
    EXECUTE PROCEDURE update_verification_updated_at();

-- Trigger for verification_preferences
DROP TRIGGER IF EXISTS update_verification_preferences_updated_at ON verification_preferences;
CREATE TRIGGER update_verification_preferences_updated_at
    BEFORE UPDATE ON verification_preferences
    FOR EACH ROW
    EXECUTE PROCEDURE update_verification_updated_at();

-- ===========================================
-- 7. HELPER FUNCTION: Calculate Verification Level
-- ===========================================
CREATE OR REPLACE FUNCTION calculate_verification_level(
    p_email_verified BOOLEAN,
    p_phone_verified BOOLEAN,
    p_id_verified BOOLEAN,
    p_background_checked BOOLEAN,
    p_is_premium BOOLEAN DEFAULT false
)
RETURNS VARCHAR(50) AS $$
BEGIN
    -- Premium verified = background checked + premium subscription
    IF p_background_checked AND p_is_premium THEN
        RETURN 'premium';
    -- Background verified = passed background check
    ELSIF p_background_checked THEN
        RETURN 'background';
    -- Verified = ID verified
    ELSIF p_id_verified THEN
        RETURN 'verified';
    -- Basic = email/phone verified only
    ELSE
        RETURN 'basic';
    END IF;
END;
$$ language 'plpgsql';

-- ===========================================
-- 8. TRIGGER: Auto-update verification level on profile changes
-- ===========================================
CREATE OR REPLACE FUNCTION update_profile_verification_level()
RETURNS TRIGGER AS $$
BEGIN
    -- Update verification_level based on current verification status
    NEW.verification_level = calculate_verification_level(
        COALESCE(NEW.email_verified, false),
        COALESCE(NEW.phone_verified, false),
        COALESCE(NEW.id_verified, false),
        COALESCE(NEW.background_checked, false),
        COALESCE(NEW.is_premium, false)
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS auto_update_verification_level ON profiles;
CREATE TRIGGER auto_update_verification_level
    BEFORE INSERT OR UPDATE OF email_verified, phone_verified, id_verified, background_checked, is_premium
    ON profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_profile_verification_level();
