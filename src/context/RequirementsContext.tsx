/**
 * Requirements Context
 *
 * Manages and enforces user requirements for accessing various app features.
 * This is the central gating system that ensures users cannot bypass:
 * - Terms of Service acceptance
 * - Privacy Policy acceptance
 * - Age verification (18+)
 * - Email verification
 * - Phone verification
 * - ID and photo verification (required only at final booking confirmation)
 *
 * NEW BUSINESS MODEL:
 * - Companion booking is FREE for all users (no booking limits)
 * - 10% platform fee on all bookings
 * - "Find New Friends" feature is subscription-gated
 */

import React, {
    createContext, useCallback, useContext, useEffect, useMemo,
    useRef, useState
} from 'react';
import { supabase } from '../services/supabase';
import type { SubscriptionTier } from '../types';
import { useAuth } from './AuthContext';
import { useVerification } from './VerificationContext';

// ===========================================
// Types
// ===========================================

export interface UserConsents {
  termsAccepted: boolean;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  privacyAccepted: boolean;
  privacyAcceptedAt: string | null;
  privacyVersion: string | null;
  ageConfirmed: boolean;
  ageConfirmedAt: string | null;
  electronicSignatureConsent: boolean;
  electronicSignatureConsentAt: string | null;
  marketingOptIn: boolean;
}

export interface RequirementCheck {
  met: boolean;
  requirement: string;
  action?: string;
  navigateTo?: string;
}

export interface BookingRequirements {
  isAuthenticated: RequirementCheck;
  ageConfirmed: RequirementCheck;
  termsAccepted: RequirementCheck;
  privacyAccepted: RequirementCheck;
  emailVerified: RequirementCheck;
  phoneVerified: RequirementCheck;
  idVerified: RequirementCheck;
  photoVerified: RequirementCheck;
  profileComplete: RequirementCheck;
  allMet: boolean;
  unmetRequirements: RequirementCheck[];
}

export interface CompanionRequirements extends BookingRequirements {
  companionAgreementAccepted: RequirementCheck;
}

export type BookingRequirementMode = 'entry' | 'finalize';

/**
 * Friends feature limits based on subscription tier
 */
export interface FriendsFeatureLimits {
  matchesPerMonth: number;
  groupsCanJoin: number;
  canPost: boolean;
  canCreateEvents: boolean;
  priorityMatching: boolean;
}

/**
 * Tracks usage of Friends features
 */
export interface FriendsUsage {
  matchesThisMonth: number;
  groupsJoined: number;
  nextResetDate: string;
}

interface RequirementsContextType {
  // Consents
  consents: UserConsents;
  acceptTerms: (version: string) => Promise<void>;
  acceptPrivacy: (version: string) => Promise<void>;
  confirmAge: () => Promise<void>;
  acceptElectronicSignature: () => Promise<void>;
  setMarketingOptIn: (optIn: boolean) => Promise<void>;
  revokeAllConsents: () => Promise<void>;

  // Requirement checks
  checkBookingRequirements: (mode?: BookingRequirementMode) => BookingRequirements;
  checkCompanionRequirements: () => CompanionRequirements;
  canAccessFeature: (feature: AppFeature) => RequirementCheck;

  // Companion-specific
  companionAgreementAccepted: boolean;
  acceptCompanionAgreement: () => Promise<void>;

  // Profile completion
  isProfileComplete: boolean;
  profileCompletionPercentage: number;
  missingProfileFields: string[];

  // Friends feature limits (subscription-gated)
  friendsLimits: FriendsFeatureLimits;
  friendsUsage: FriendsUsage;
  canUseFriendsFeature: (feature: 'match' | 'join_group' | 'post' | 'create_event') => RequirementCheck;
  refreshFriendsUsage: () => Promise<void>;
  recordFriendsMatch: (targetUserId?: string) => Promise<void>;
  recordGroupJoin: (groupId: string) => Promise<void>;

  // Loading state
  isLoading: boolean;
}

export type AppFeature =
  | 'browse_companions'
  | 'view_companion_profile'
  | 'book_companion'
  | 'send_message'
  | 'leave_review'
  | 'become_companion'
  | 'safety_features'
  | 'subscription'
  | 'friends_matching'
  | 'friends_feed'
  | 'friends_groups'
  | 'friends_post'
  | 'friends_events';

/**
 * Friends feature limits per subscription tier
 * FREE: Browse only, no matching/posting
 * PLUS: 5 matches/month, 3 groups
 * PREMIUM: Unlimited matches/groups, can post
 * ELITE: All Premium + create events + priority matching
 */
const FRIENDS_FEATURE_LIMITS: Record<SubscriptionTier, FriendsFeatureLimits> = {
  free: {
    matchesPerMonth: 0,
    groupsCanJoin: 0,
    canPost: false,
    canCreateEvents: false,
    priorityMatching: false,
  },
  plus: {
    matchesPerMonth: 5,
    groupsCanJoin: 3,
    canPost: false,
    canCreateEvents: false,
    priorityMatching: false,
  },
  premium: {
    matchesPerMonth: 999, // Effectively unlimited
    groupsCanJoin: 999,
    canPost: true,
    canCreateEvents: false,
    priorityMatching: false,
  },
  elite: {
    matchesPerMonth: 999,
    groupsCanJoin: 999,
    canPost: true,
    canCreateEvents: true,
    priorityMatching: true,
  },
};

// Current legal document versions
const CURRENT_TERMS_VERSION = '1.0';
const CURRENT_PRIVACY_VERSION = '1.0';

const defaultConsents: UserConsents = {
  termsAccepted: false,
  termsAcceptedAt: null,
  termsVersion: null,
  privacyAccepted: false,
  privacyAcceptedAt: null,
  privacyVersion: null,
  ageConfirmed: false,
  ageConfirmedAt: null,
  electronicSignatureConsent: false,
  electronicSignatureConsentAt: null,
  marketingOptIn: false,
};

const defaultFriendsUsage: FriendsUsage = {
  matchesThisMonth: 0,
  groupsJoined: 0,
  nextResetDate: '',
};

const RequirementsContext = createContext<RequirementsContextType | undefined>(undefined);

// ===========================================
// Provider Component
// ===========================================

export const RequirementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isNewUser, signupConsents } = useAuth();
  const { emailVerified, phoneVerified, idVerified } = useVerification();

  const [isLoading, setIsLoading] = useState(true);
  const [consents, setConsents] = useState<UserConsents>(defaultConsents);
  const [companionAgreementAccepted, setCompanionAgreementAccepted] = useState(false);
  const [friendsUsage, setFriendsUsage] = useState<FriendsUsage>(defaultFriendsUsage);

  // Track if we've already synced consents for this new user
  const hasSyncedNewUserConsents = useRef(false);

  // ===========================================
  // Persistence
  // ===========================================

  const toIsoOrNull = (value: unknown): string | null => (
    typeof value === 'string' && value.trim().length > 0 ? value : null
  );

  const parseMissingColumn = (message: string): string | null => {
    const directColumnMatch = message.match(/column\s+([a-zA-Z0-9_]+)\s+does not exist/i);
    if (directColumnMatch?.[1]) {
      return directColumnMatch[1];
    }

    const scopedColumnMatch = message.match(/column\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s+does not exist/i);
    if (scopedColumnMatch?.[2]) {
      return scopedColumnMatch[2];
    }

    return null;
  };

  const getNextResetDate = (): string => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  };

  const normalizeConsentVersions = (rawConsents: UserConsents): UserConsents => {
    const updated = { ...rawConsents };

    if (updated.termsVersion !== CURRENT_TERMS_VERSION) {
      updated.termsAccepted = false;
      updated.termsAcceptedAt = null;
      updated.termsVersion = null;
    }

    if (updated.privacyVersion !== CURRENT_PRIVACY_VERSION) {
      updated.privacyAccepted = false;
      updated.privacyAcceptedAt = null;
      updated.privacyVersion = null;
    }

    return updated;
  };

  const buildConsentUpdates = (newConsents: UserConsents): Record<string, unknown> => ({
    terms_accepted: newConsents.termsAccepted,
    terms_accepted_at: newConsents.termsAccepted ? newConsents.termsAcceptedAt : null,
    terms_version: newConsents.termsAccepted ? newConsents.termsVersion : null,
    privacy_accepted: newConsents.privacyAccepted,
    privacy_accepted_at: newConsents.privacyAccepted ? newConsents.privacyAcceptedAt : null,
    privacy_version: newConsents.privacyAccepted ? newConsents.privacyVersion : null,
    age_confirmed: newConsents.ageConfirmed,
    age_confirmed_at: newConsents.ageConfirmed ? newConsents.ageConfirmedAt : null,
    electronic_signature_consent: newConsents.electronicSignatureConsent,
    electronic_signature_consent_at: newConsents.electronicSignatureConsent
      ? newConsents.electronicSignatureConsentAt
      : null,
    marketing_opt_in: newConsents.marketingOptIn,
    updated_at: new Date().toISOString(),
  });

  const persistConsentsToSupabase = useCallback(async (
    userId: string,
    newConsents: UserConsents
  ) => {
    const payload = buildConsentUpdates(newConsents);

    while (Object.keys(payload).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId);

      if (!error) {
        return;
      }

      if (error.code === '42703') {
        const missingColumn = parseMissingColumn(String(error.message || ''));
        if (missingColumn && missingColumn in payload) {
          delete payload[missingColumn];
          continue;
        }
      }

      console.error('Error persisting consent data:', error);
      return;
    }
  }, []);

  const loadFriendsUsageFromSupabase = useCallback(async (userId: string) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nextResetDate = getNextResetDate();

    const [matchesResult, groupsResult] = await Promise.all([
      supabase
        .from('match_swipes')
        .select('id', { count: 'exact', head: true })
        .eq('from_user_id', userId)
        .in('action', ['like', 'super_like'])
        .gte('created_at', monthStart),
      supabase
        .from('group_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    if (matchesResult.error) {
      console.error('Error loading match usage:', matchesResult.error);
    }

    if (groupsResult.error) {
      console.error('Error loading group usage:', groupsResult.error);
    }

    setFriendsUsage({
      matchesThisMonth: matchesResult.count || 0,
      groupsJoined: groupsResult.count || 0,
      nextResetDate,
    });
  }, []);

  const loadStoredData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error loading profile consents:', profileError);
      }

      const profileData = (profile || {}) as Record<string, unknown>;
      const loadedConsents: UserConsents = {
        termsAccepted: profileData.terms_accepted === true,
        termsAcceptedAt: toIsoOrNull(profileData.terms_accepted_at),
        termsVersion: toIsoOrNull(profileData.terms_version),
        privacyAccepted: profileData.privacy_accepted === true,
        privacyAcceptedAt: toIsoOrNull(profileData.privacy_accepted_at),
        privacyVersion: toIsoOrNull(profileData.privacy_version),
        ageConfirmed: profileData.age_confirmed === true,
        ageConfirmedAt: toIsoOrNull(profileData.age_confirmed_at),
        electronicSignatureConsent: profileData.electronic_signature_consent === true,
        electronicSignatureConsentAt: toIsoOrNull(profileData.electronic_signature_consent_at),
        marketingOptIn: profileData.marketing_opt_in === true,
      };

      const normalizedConsents = normalizeConsentVersions(loadedConsents);
      setConsents(normalizedConsents);

      if (JSON.stringify(normalizedConsents) !== JSON.stringify(loadedConsents)) {
        await persistConsentsToSupabase(user.id, normalizedConsents);
      }

      const { data: application, error: applicationError } = await supabase
        .from('companion_applications')
        .select('companion_agreement_accepted')
        .eq('user_id', user.id)
        .maybeSingle();

      if (applicationError && applicationError.code !== 'PGRST116' && applicationError.code !== '42P01') {
        console.error('Error loading companion agreement state:', applicationError);
      }

      setCompanionAgreementAccepted(
        (application as { companion_agreement_accepted?: boolean } | null)?.companion_agreement_accepted === true
      );

      await loadFriendsUsageFromSupabase(user.id);
    } catch (error) {
      console.error('Error loading requirements data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, loadFriendsUsageFromSupabase, persistConsentsToSupabase]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadStoredData();
    } else {
      // Reset when logged out
      setConsents(defaultConsents);
      setCompanionAgreementAccepted(false);
      setFriendsUsage(defaultFriendsUsage);
      setIsLoading(false);
      hasSyncedNewUserConsents.current = false;
    }
  }, [isAuthenticated, user?.id, loadStoredData]);

  /**
   * SECURITY: Sync consents from signup flow when a new user is created
   */
  useEffect(() => {
    const syncNewUserConsents = async () => {
      if (!isNewUser || !user?.id || hasSyncedNewUserConsents.current) {
        return;
      }

      if (signupConsents?.termsAccepted && signupConsents?.privacyAccepted && signupConsents?.ageConfirmed) {
        const now = new Date().toISOString();
        const newConsents: UserConsents = {
          termsAccepted: signupConsents.termsAccepted,
          termsAcceptedAt: now,
          termsVersion: CURRENT_TERMS_VERSION,
          privacyAccepted: signupConsents.privacyAccepted,
          privacyAcceptedAt: now,
          privacyVersion: CURRENT_PRIVACY_VERSION,
          ageConfirmed: signupConsents.ageConfirmed,
          ageConfirmedAt: now,
          electronicSignatureConsent: false,
          electronicSignatureConsentAt: null,
          marketingOptIn: signupConsents.marketingOptIn || false,
        };

        setConsents(newConsents);
        await persistConsentsToSupabase(user.id, newConsents);

        hasSyncedNewUserConsents.current = true;
        console.log('Successfully synced signup consents for new user');
      }
    };

    syncNewUserConsents();
  }, [isNewUser, user?.id, signupConsents, persistConsentsToSupabase]);

  // ===========================================
  // Consent Actions
  // ===========================================

  const saveConsents = useCallback(
    async (newConsents: UserConsents) => {
      if (!user?.id) return;
      setConsents(newConsents);
      await persistConsentsToSupabase(user.id, newConsents);
    },
    [user?.id, persistConsentsToSupabase]
  );

  const acceptTerms = useCallback(
    async (version: string) => {
      const newConsents: UserConsents = {
        ...consents,
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        termsVersion: version,
      };
      await saveConsents(newConsents);
    },
    [consents, saveConsents]
  );

  const acceptPrivacy = useCallback(
    async (version: string) => {
      const newConsents: UserConsents = {
        ...consents,
        privacyAccepted: true,
        privacyAcceptedAt: new Date().toISOString(),
        privacyVersion: version,
      };
      await saveConsents(newConsents);
    },
    [consents, saveConsents]
  );

  const confirmAge = useCallback(async () => {
    const newConsents: UserConsents = {
      ...consents,
      ageConfirmed: true,
      ageConfirmedAt: new Date().toISOString(),
    };
    await saveConsents(newConsents);
  }, [consents, saveConsents]);

  const acceptElectronicSignature = useCallback(async () => {
    const newConsents: UserConsents = {
      ...consents,
      electronicSignatureConsent: true,
      electronicSignatureConsentAt: new Date().toISOString(),
    };
    await saveConsents(newConsents);
  }, [consents, saveConsents]);

  const setMarketingOptIn = useCallback(
    async (optIn: boolean) => {
      const newConsents: UserConsents = {
        ...consents,
        marketingOptIn: optIn,
      };
      await saveConsents(newConsents);
    },
    [consents, saveConsents]
  );

  const revokeAllConsents = useCallback(async () => {
    await saveConsents(defaultConsents);
  }, [saveConsents]);

  const acceptCompanionAgreement = useCallback(async () => {
    if (!user?.id) return;
    const now = new Date().toISOString();

    const { data: existingApplication, error: existingApplicationError } = await supabase
      .from('companion_applications')
      .select('id, status, companion_agreement_accepted')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingApplicationError && existingApplicationError.code !== 'PGRST116' && existingApplicationError.code !== '42P01') {
      console.error('Error checking companion application:', existingApplicationError);
      return;
    }

    const existing = existingApplication as {
      id?: string;
      status?: string;
      companion_agreement_accepted?: boolean;
    } | null;

    if (existing?.id) {
      if (existing.companion_agreement_accepted === true) {
        setCompanionAgreementAccepted(true);
        return;
      }

      if (existing.status && !['draft', 'rejected'].includes(existing.status)) {
        console.error('Cannot update companion agreement for non-editable application status:', existing.status);
        return;
      }

      const { error: updateError } = await supabase
        .from('companion_applications')
        .update({
          companion_agreement_accepted: true,
          companion_agreement_accepted_at: now,
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Error updating companion agreement:', updateError);
        return;
      }

      setCompanionAgreementAccepted(true);
      return;
    }

    const { error: insertError } = await supabase
      .from('companion_applications')
      .insert({
        user_id: user.id,
        status: 'draft',
        companion_agreement_accepted: true,
        companion_agreement_accepted_at: now,
      });

    if (insertError && insertError.code !== '23505') {
      console.error('Error creating companion application with agreement state:', insertError);
      return;
    }

    setCompanionAgreementAccepted(true);
  }, [user?.id]);

  // ===========================================
  // Friends Feature Limits
  // ===========================================

  const subscriptionTier = user?.subscriptionTier || 'free';
  const friendsLimits = FRIENDS_FEATURE_LIMITS[subscriptionTier];

  const recordFriendsMatch = useCallback(async (targetUserId?: string) => {
    if (!user?.id) return;
    if (targetUserId && targetUserId !== user.id) {
      const { error } = await supabase
        .from('match_swipes')
        .insert({
          from_user_id: user.id,
          to_user_id: targetUserId,
          action: 'like',
        });

      if (error && error.code !== '23505') {
        console.error('Error recording friend match swipe:', error);
      }
    }

    await loadFriendsUsageFromSupabase(user.id);
  }, [loadFriendsUsageFromSupabase, user?.id]);

  const recordGroupJoin = useCallback(async (groupId: string) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('group_memberships')
      .insert({
        group_id: groupId,
        user_id: user.id,
      });

    if (error && error.code !== '23505') {
      console.error('Error recording group join usage:', error);
      return;
    }

    await loadFriendsUsageFromSupabase(user.id);
  }, [loadFriendsUsageFromSupabase, user?.id]);

  const refreshFriendsUsageState = useCallback(async () => {
    if (!user?.id) return;
    await loadFriendsUsageFromSupabase(user.id);
  }, [loadFriendsUsageFromSupabase, user?.id]);

  const canUseFriendsFeature = useCallback(
    (feature: 'match' | 'join_group' | 'post' | 'create_event'): RequirementCheck => {
      if (!isAuthenticated) {
        return { met: false, requirement: 'Sign in required', navigateTo: 'SignIn' };
      }

      switch (feature) {
        case 'match':
          if (friendsLimits.matchesPerMonth === 0) {
            return {
              met: false,
              requirement: 'Upgrade to Plus or higher to match with friends',
              action: 'Upgrade',
              navigateTo: 'Subscription',
            };
          }
          if (friendsUsage.matchesThisMonth >= friendsLimits.matchesPerMonth) {
            return {
              met: false,
              requirement: `You've reached your monthly match limit (${friendsLimits.matchesPerMonth})`,
              action: 'Upgrade',
              navigateTo: 'Subscription',
            };
          }
          return { met: true, requirement: '' };

        case 'join_group':
          if (friendsLimits.groupsCanJoin === 0) {
            return {
              met: false,
              requirement: 'Upgrade to Plus or higher to join groups',
              action: 'Upgrade',
              navigateTo: 'Subscription',
            };
          }
          if (friendsUsage.groupsJoined >= friendsLimits.groupsCanJoin) {
            return {
              met: false,
              requirement: `You've reached your group limit (${friendsLimits.groupsCanJoin})`,
              action: 'Upgrade',
              navigateTo: 'Subscription',
            };
          }
          return { met: true, requirement: '' };

        case 'post':
          if (!friendsLimits.canPost) {
            return {
              met: false,
              requirement: 'Upgrade to Premium or higher to post',
              action: 'Upgrade',
              navigateTo: 'Subscription',
            };
          }
          return { met: true, requirement: '' };

        case 'create_event':
          if (!friendsLimits.canCreateEvents) {
            return {
              met: false,
              requirement: 'Upgrade to Elite to create events',
              action: 'Upgrade',
              navigateTo: 'Subscription',
            };
          }
          return { met: true, requirement: '' };

        default:
          return { met: true, requirement: '' };
      }
    },
    [isAuthenticated, friendsLimits, friendsUsage]
  );

  // ===========================================
  // Profile Completion
  // ===========================================

  const profileCompletionData = useMemo(() => {
    if (!user) {
      return { isComplete: false, percentage: 0, missing: ['account'] };
    }

    const requiredFields = [
      { field: 'firstName', label: 'First Name', value: user.firstName },
      { field: 'lastName', label: 'Last Name', value: user.lastName },
      { field: 'email', label: 'Email', value: user.email },
      { field: 'dateOfBirth', label: 'Date of Birth', value: user.dateOfBirth },
      { field: 'phone', label: 'Phone Number', value: user.phone },
      { field: 'location', label: 'Location', value: user.location?.city },
      { field: 'avatar', label: 'Profile Photo', value: user.avatar },
    ];

    const completed = requiredFields.filter((f) => !!f.value);
    const missing = requiredFields.filter((f) => !f.value).map((f) => f.label);
    const percentage = Math.round((completed.length / requiredFields.length) * 100);

    return {
      isComplete: missing.length === 0,
      percentage,
      missing,
    };
  }, [user]);

  // ===========================================
  // Requirement Checks
  // ===========================================

  const checkBookingRequirements = useCallback((mode: BookingRequirementMode = 'entry'): BookingRequirements => {
    const hasProfilePhoto = !!user?.avatar?.trim();

    const checks: BookingRequirements = {
      isAuthenticated: {
        met: isAuthenticated,
        requirement: 'You must be signed in',
        action: 'Sign In',
        navigateTo: 'SignIn',
      },
      ageConfirmed: {
        met: consents.ageConfirmed,
        requirement: 'You must confirm you are 18 or older',
        action: 'Confirm Age',
      },
      termsAccepted: {
        met: consents.termsAccepted && consents.termsVersion === CURRENT_TERMS_VERSION,
        requirement: 'You must accept the Terms of Service',
        action: 'View Terms',
        navigateTo: 'LegalDocument',
      },
      privacyAccepted: {
        met: consents.privacyAccepted && consents.privacyVersion === CURRENT_PRIVACY_VERSION,
        requirement: 'You must accept the Privacy Policy',
        action: 'View Privacy Policy',
        navigateTo: 'LegalDocument',
      },
      emailVerified: {
        met: emailVerified,
        requirement: 'You must verify your email address',
        action: 'Verify Email',
        navigateTo: 'Verification',
      },
      phoneVerified: {
        met: phoneVerified,
        requirement: 'You must verify your phone number',
        action: 'Verify Phone',
        navigateTo: 'VerifyPhone',
      },
      idVerified: {
        met: idVerified,
        requirement: 'You must verify your identity',
        action: 'Verify ID',
        navigateTo: 'Verification',
      },
      photoVerified: {
        met: hasProfilePhoto,
        requirement: 'You must upload a profile photo',
        action: 'Add Photo',
        navigateTo: 'EditProfile',
      },
      profileComplete: {
        met: profileCompletionData.isComplete,
        requirement: 'You must complete your profile details',
        action: 'Complete Profile',
        navigateTo: 'EditProfile',
      },
      allMet: false,
      unmetRequirements: [],
    };

    const requiredCheckKeys: Array<keyof Omit<BookingRequirements, 'allMet' | 'unmetRequirements'>> =
      mode === 'finalize'
        ? [
            'isAuthenticated',
            'ageConfirmed',
            'termsAccepted',
            'privacyAccepted',
            'emailVerified',
            'phoneVerified',
            'idVerified',
            'photoVerified',
            'profileComplete',
          ]
        : [
            'isAuthenticated',
            'ageConfirmed',
            'termsAccepted',
            'privacyAccepted',
            'emailVerified',
            'phoneVerified',
            'profileComplete',
          ];

    // Calculate unmet requirements
    const unmet = requiredCheckKeys
      .filter((key) => !checks[key].met)
      .map((key) => checks[key]);

    checks.unmetRequirements = unmet;
    checks.allMet = unmet.length === 0;

    return checks;
  }, [
    isAuthenticated,
    consents,
    emailVerified,
    phoneVerified,
    idVerified,
    user?.avatar,
    profileCompletionData,
  ]);

  const checkCompanionRequirements = useCallback((): CompanionRequirements => {
    const bookingReqs = checkBookingRequirements('entry');

    return {
      ...bookingReqs,
      companionAgreementAccepted: {
        met: companionAgreementAccepted,
        requirement: 'You must accept the Wingman Service Agreement',
        action: 'View Agreement',
        navigateTo: 'LegalDocument',
      },
      allMet: bookingReqs.allMet && companionAgreementAccepted,
      unmetRequirements: [
        ...bookingReqs.unmetRequirements,
        ...(companionAgreementAccepted
          ? []
          : [
              {
                met: false,
                requirement: 'You must accept the Wingman Agreement',
                action: 'View Agreement',
                navigateTo: 'LegalDocument',
              },
            ]),
      ],
    };
  }, [checkBookingRequirements, companionAgreementAccepted]);

  const canAccessFeature = useCallback(
    (feature: AppFeature): RequirementCheck => {
      switch (feature) {
        case 'browse_companions':
        case 'view_companion_profile':
          // Requires authentication and age confirmation
          if (!isAuthenticated) {
            return { met: false, requirement: 'Sign in required', action: 'Sign In', navigateTo: 'SignIn' };
          }
          if (!consents.ageConfirmed) {
            return { met: false, requirement: 'Age confirmation required', action: 'Confirm Age' };
          }
          return { met: true, requirement: '' };

        case 'book_companion':
        case 'send_message':
        case 'leave_review':
          const bookingReqs = checkBookingRequirements('entry');
          if (!bookingReqs.allMet) {
            const firstUnmet = bookingReqs.unmetRequirements[0];
            return firstUnmet || { met: false, requirement: 'Requirements not met' };
          }
          return { met: true, requirement: '' };

        case 'become_companion':
          const companionReqs = checkCompanionRequirements();
          if (!companionReqs.allMet) {
            const firstUnmet = companionReqs.unmetRequirements[0];
            return firstUnmet || { met: false, requirement: 'Requirements not met' };
          }
          return { met: true, requirement: '' };

        case 'friends_matching':
          return canUseFriendsFeature('match');

        case 'friends_feed':
          if (!isAuthenticated) {
            return { met: false, requirement: 'Sign in required', navigateTo: 'SignIn' };
          }
          if (friendsLimits.matchesPerMonth === 0) {
            return {
              met: false,
              requirement: 'Upgrade to Plus or higher to access the social feed',
              action: 'Upgrade',
              navigateTo: 'Subscription',
            };
          }
          return { met: true, requirement: '' };

        case 'friends_groups':
          return canUseFriendsFeature('join_group');

        case 'friends_post':
          return canUseFriendsFeature('post');

        case 'friends_events':
          return canUseFriendsFeature('create_event');

        case 'safety_features':
        case 'subscription':
          if (!isAuthenticated) {
            return { met: false, requirement: 'Sign in required', navigateTo: 'SignIn' };
          }
          return { met: true, requirement: '' };

        default:
          return { met: true, requirement: '' };
      }
    },
    [isAuthenticated, consents, checkBookingRequirements, checkCompanionRequirements, canUseFriendsFeature, friendsLimits.matchesPerMonth]
  );

  // ===========================================
  // Context Value
  // ===========================================

  const value: RequirementsContextType = {
    consents,
    acceptTerms,
    acceptPrivacy,
    confirmAge,
    acceptElectronicSignature,
    setMarketingOptIn,
    revokeAllConsents,

    checkBookingRequirements,
    checkCompanionRequirements,
    canAccessFeature,

    companionAgreementAccepted,
    acceptCompanionAgreement,

    isProfileComplete: profileCompletionData.isComplete,
    profileCompletionPercentage: profileCompletionData.percentage,
    missingProfileFields: profileCompletionData.missing,

    friendsLimits,
    friendsUsage,
    canUseFriendsFeature,
    refreshFriendsUsage: refreshFriendsUsageState,
    recordFriendsMatch,
    recordGroupJoin,

    isLoading,
  };

  return (
    <RequirementsContext.Provider value={value}>{children}</RequirementsContext.Provider>
  );
};

// ===========================================
// Hook
// ===========================================

export const useRequirements = () => {
  const context = useContext(RequirementsContext);
  if (context === undefined) {
    throw new Error('useRequirements must be used within a RequirementsProvider');
  }
  return context;
};
