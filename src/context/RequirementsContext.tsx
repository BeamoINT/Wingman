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

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
    createContext, useCallback, useContext, useEffect, useMemo,
    useRef, useState
} from 'react';
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
  recordFriendsMatch: () => Promise<void>;
  recordGroupJoin: () => Promise<void>;

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

// Storage keys
const STORAGE_KEYS = {
  CONSENTS: 'user_consents',
  COMPANION_AGREEMENT: 'companion_agreement_accepted',
  FRIENDS_MATCHES: 'friends_matches_count',
  FRIENDS_GROUPS: 'friends_groups_count',
  FRIENDS_RESET_DATE: 'friends_reset_date',
};

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

  const loadStoredData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Load consents
      const storedConsents = await AsyncStorage.getItem(`${STORAGE_KEYS.CONSENTS}_${user.id}`);
      if (storedConsents) {
        const parsed = JSON.parse(storedConsents);
        // Check if terms/privacy versions are current
        const updatedConsents = { ...parsed };
        if (parsed.termsVersion !== CURRENT_TERMS_VERSION) {
          updatedConsents.termsAccepted = false;
          updatedConsents.termsAcceptedAt = null;
          updatedConsents.termsVersion = null;
        }
        if (parsed.privacyVersion !== CURRENT_PRIVACY_VERSION) {
          updatedConsents.privacyAccepted = false;
          updatedConsents.privacyAcceptedAt = null;
          updatedConsents.privacyVersion = null;
        }
        setConsents(updatedConsents);
      }

      // Load companion agreement
      const storedCompanionAgreement = await AsyncStorage.getItem(
        `${STORAGE_KEYS.COMPANION_AGREEMENT}_${user.id}`
      );
      setCompanionAgreementAccepted(storedCompanionAgreement === 'true');

      // Load Friends feature usage
      const storedMatches = await AsyncStorage.getItem(`${STORAGE_KEYS.FRIENDS_MATCHES}_${user.id}`);
      const storedGroups = await AsyncStorage.getItem(`${STORAGE_KEYS.FRIENDS_GROUPS}_${user.id}`);
      const storedResetDate = await AsyncStorage.getItem(`${STORAGE_KEYS.FRIENDS_RESET_DATE}_${user.id}`);

      const now = new Date();
      const resetDate = storedResetDate ? new Date(storedResetDate) : null;

      if (!resetDate || now >= resetDate) {
        // Reset count and set new reset date (first of next month)
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        setFriendsUsage({
          matchesThisMonth: 0,
          groupsJoined: parseInt(storedGroups || '0', 10), // Groups don't reset
          nextResetDate: nextMonth.toISOString(),
        });
        await AsyncStorage.setItem(`${STORAGE_KEYS.FRIENDS_MATCHES}_${user.id}`, '0');
        await AsyncStorage.setItem(`${STORAGE_KEYS.FRIENDS_RESET_DATE}_${user.id}`, nextMonth.toISOString());
      } else {
        setFriendsUsage({
          matchesThisMonth: parseInt(storedMatches || '0', 10),
          groupsJoined: parseInt(storedGroups || '0', 10),
          nextResetDate: storedResetDate || '',
        });
      }
    } catch (error) {
      console.error('Error loading requirements data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

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
        await AsyncStorage.setItem(
          `${STORAGE_KEYS.CONSENTS}_${user.id}`,
          JSON.stringify(newConsents)
        );

        hasSyncedNewUserConsents.current = true;
        console.log('Successfully synced signup consents for new user');
      }
    };

    syncNewUserConsents();
  }, [isNewUser, user?.id, signupConsents]);

  // ===========================================
  // Consent Actions
  // ===========================================

  const saveConsents = useCallback(
    async (newConsents: UserConsents) => {
      if (!user?.id) return;
      setConsents(newConsents);
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.CONSENTS}_${user.id}`,
        JSON.stringify(newConsents)
      );
    },
    [user?.id]
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
    setCompanionAgreementAccepted(true);
    await AsyncStorage.setItem(`${STORAGE_KEYS.COMPANION_AGREEMENT}_${user.id}`, 'true');
  }, [user?.id]);

  // ===========================================
  // Friends Feature Limits
  // ===========================================

  const subscriptionTier = user?.subscriptionTier || 'free';
  const friendsLimits = FRIENDS_FEATURE_LIMITS[subscriptionTier];

  const recordFriendsMatch = useCallback(async () => {
    if (!user?.id) return;
    const newCount = friendsUsage.matchesThisMonth + 1;
    setFriendsUsage(prev => ({ ...prev, matchesThisMonth: newCount }));
    await AsyncStorage.setItem(`${STORAGE_KEYS.FRIENDS_MATCHES}_${user.id}`, newCount.toString());
  }, [user?.id, friendsUsage.matchesThisMonth]);

  const recordGroupJoin = useCallback(async () => {
    if (!user?.id) return;
    const newCount = friendsUsage.groupsJoined + 1;
    setFriendsUsage(prev => ({ ...prev, groupsJoined: newCount }));
    await AsyncStorage.setItem(`${STORAGE_KEYS.FRIENDS_GROUPS}_${user.id}`, newCount.toString());
  }, [user?.id, friendsUsage.groupsJoined]);

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
    [isAuthenticated, consents, checkBookingRequirements, checkCompanionRequirements, canUseFriendsFeature]
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
