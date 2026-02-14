-- Companion Applications Migration
-- Tracks the companion signup/onboarding process and enables manual review

-- ===========================================
-- Companion Applications Table
-- ===========================================
CREATE TABLE IF NOT EXISTS companion_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Application status
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'under_review', 'approved', 'rejected', 'suspended')),

  -- ID Verification documents
  id_document_url TEXT,
  id_document_type TEXT CHECK (id_document_type IS NULL OR id_document_type IN ('passport', 'drivers_license', 'national_id')),
  selfie_url TEXT,

  -- Companion profile data (collected during onboarding)
  specialties TEXT[] DEFAULT '{}',
  hourly_rate DECIMAL(10,2),
  about TEXT,
  languages TEXT[] DEFAULT '{}',
  gallery TEXT[] DEFAULT '{}',

  -- Agreement acceptance
  companion_agreement_accepted BOOLEAN DEFAULT FALSE,
  companion_agreement_accepted_at TIMESTAMPTZ,

  -- Review metadata
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Timestamps
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- Enable Row Level Security
-- ===========================================
ALTER TABLE companion_applications ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- RLS Policies
-- ===========================================

-- Users can view their own application
CREATE POLICY "Users can view own companion application" ON companion_applications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own application
CREATE POLICY "Users can insert own companion application" ON companion_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own application (only if in draft or rejected status)
CREATE POLICY "Users can update own companion application" ON companion_applications
  FOR UPDATE USING (
    auth.uid() = user_id AND status IN ('draft', 'rejected')
  );

-- ===========================================
-- Indexes
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_companion_applications_user ON companion_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_companion_applications_status ON companion_applications(status);

-- ===========================================
-- Trigger for updated_at
-- ===========================================
CREATE TRIGGER update_companion_applications_updated_at
  BEFORE UPDATE ON companion_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
