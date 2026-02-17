import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supportsRevenueCatPurchases, supportsSecureMessagingIdentity } from '../config/runtime';
import {
  DeviceIdentityError,
  getOrCreateDeviceIdentity,
  heartbeatDeviceIdentity,
} from '../services/crypto/deviceIdentity';
import { resolveMetroArea } from '../services/api/locationApi';
import { getMessagingIdentity, SecureMessagingError } from '../services/crypto/messagingEncryption';
import { trackEvent } from '../services/monitoring/events';
import { initRevenueCat } from '../services/subscription/revenueCat';
import { supabase } from '../services/supabase';
import type { SignupData, User } from '../types';
import { defaultSignupData } from '../types';
import { isIdVerificationActive, normalizeIdVerificationStatus } from '../utils/idVerification';
import { safeLog } from '../utils/sanitize';

// Storage keys
const AUTH_USER_KEY = '@wingman_user';
const SIGNUP_DRAFT_KEY = '@wingman_signup_draft';
const SIGNUP_PWD_KEY = 'wingman_signup_pwd';
const SIGNUP_CONFIRM_PWD_KEY = 'wingman_signup_cpwd';

/**
 * Signup consents that must be collected during registration
 */
export interface SignupConsents {
  ageConfirmed: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingOptIn: boolean;
}

interface SignupDraft {
  signupData: Omit<SignupData, 'password'>;
  signupConsents: SignupConsents;
  currentStep: number;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isNewUser: boolean;
  isLoading: boolean;
  isRestoringSession: boolean;
  needsEmailVerification: boolean;
  needsPhoneVerification: boolean;
  signupData: SignupData;
  signupConsents: SignupConsents;
  updateSignupData: (data: Partial<SignupData>) => void;
  updateSignupConsents: (consents: Partial<SignupConsents>) => void;
  signUp: () => Promise<{ success: boolean; needsVerification?: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signInWithApple: (identityToken: string, fullName?: { givenName?: string | null; familyName?: string | null }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  completeTutorial: () => void;
  validateSignupConsents: () => { valid: boolean; errors: string[] };
  refreshSession: () => Promise<boolean>;
  refreshUserProfile: () => Promise<boolean>;
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string }>;
  resendEmailVerification: () => Promise<{ success: boolean; error?: string }>;
  setEmailVerified: () => void;
  setPhoneVerified: () => void;
  signupDraftStep: number | null;
  saveSignupDraft: (currentStep: number, confirmPassword: string) => Promise<void>;
  clearSignupDraft: () => Promise<void>;
  loadSignupDraftPassword: () => Promise<{ password: string; confirmPassword: string } | null>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  confirmPasswordReset: (email: string, token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateUserEmail: (newEmail: string) => Promise<{ success: boolean; error?: string }>;
  confirmEmailChange: (newEmail: string, token: string) => Promise<{ success: boolean; error?: string }>;
  signInWithMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyMagicLinkOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
}

const defaultSignupConsents: SignupConsents = {
  ageConfirmed: false,
  termsAccepted: false,
  privacyAccepted: false,
  marketingOptIn: false,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Transform Supabase user to our User type
 */
function transformSupabaseUser(supabaseUser: SupabaseUser, profile?: any): User {
  const metadata = supabaseUser.user_metadata || {};
  const normalizedSubscriptionTier = profile?.subscription_tier === 'pro' ? 'pro' : 'free';
  const normalizedIdVerificationStatus = normalizeIdVerificationStatus(profile?.id_verification_status);
  const hasActiveIdVerification = isIdVerificationActive({
    id_verified: profile?.id_verified === true,
    id_verification_status: normalizedIdVerificationStatus,
    id_verification_expires_at: profile?.id_verification_expires_at,
  });
  const normalizedProStatus = (() => {
    const raw = String(profile?.pro_status || '').trim();
    switch (raw) {
      case 'active':
      case 'grace':
      case 'past_due':
      case 'canceled':
      case 'inactive':
        return raw;
      default:
        return 'inactive';
    }
  })();

  return {
    id: supabaseUser.id,
    firstName: profile?.first_name || metadata.first_name || '',
    lastName: profile?.last_name || metadata.last_name || '',
    email: supabaseUser.email || '',
    phone: profile?.phone || metadata.phone || undefined,
    avatar: profile?.avatar_url || metadata.avatar_url || undefined,
    bio: profile?.bio || metadata.bio || undefined,
    dateOfBirth: profile?.date_of_birth || metadata.date_of_birth || undefined,
    gender: profile?.gender || metadata.gender || undefined,
    location: profile?.city ? {
      city: profile.city,
      state: profile.state || undefined,
      country: profile.country || 'USA',
      metroAreaId: profile.metro_area_id || undefined,
      metroAreaName: profile.metro_area_name || undefined,
      metroCity: profile.metro_city || undefined,
      metroState: profile.metro_state || undefined,
      metroCountry: profile.metro_country || undefined,
      autoMetroAreaId: profile.auto_metro_area_id || undefined,
      manualMetroAreaId: profile.manual_metro_area_id || undefined,
      defaultMetroAreaId: profile.default_metro_area_id || undefined,
      metroSelectionMode: profile.metro_selection_mode || 'auto',
    } : undefined,
    isVerified: hasActiveIdVerification,
    isPremium: normalizedSubscriptionTier === 'pro',
    subscriptionTier: normalizedSubscriptionTier,
    proStatus: normalizedProStatus,
    profilePhotoIdMatchAttested: profile?.profile_photo_id_match_attested === true,
    profilePhotoIdMatchAttestedAt: profile?.profile_photo_id_match_attested_at || null,
    idVerificationStatus: normalizedIdVerificationStatus,
    idVerificationExpiresAt: profile?.id_verification_expires_at || null,
    idVerifiedAt: profile?.id_verified_at || null,
    idVerificationFailureCode: profile?.id_verification_failure_code || null,
    idVerificationFailureMessage: profile?.id_verification_failure_message || null,
    createdAt: supabaseUser.created_at || new Date().toISOString(),
    lastActive: new Date().toISOString(),
  };
}

function buildMetroUpdatePayload(resolution: Awaited<ReturnType<typeof resolveMetroArea>>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    metro_resolved_at: new Date().toISOString(),
  };

  if (resolution.metro) {
    payload.auto_metro_area_id = resolution.metro.metroAreaId;
    payload.metro_area_id = resolution.metro.metroAreaId;
    payload.metro_area_name = resolution.metro.metroAreaName;
    payload.metro_city = resolution.metro.metroCity;
    payload.metro_state = resolution.metro.metroState;
    payload.metro_country = resolution.metro.metroCountry;
    return payload;
  }

  payload.auto_metro_area_id = null;
  payload.metro_area_id = null;
  payload.metro_area_name = null;
  payload.metro_city = null;
  payload.metro_state = null;
  payload.metro_country = null;
  return payload;
}

/**
 * Store user data in AsyncStorage (non-sensitive data only).
 */
async function storeUser(user: User): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch (error) {
    safeLog('Failed to store user data', { error: String(error) });
  }
}

/**
 * Retrieve user data from AsyncStorage.
 */
async function getStoredUser(): Promise<User | null> {
  try {
    const userData = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (userData) {
      return JSON.parse(userData);
    }
  } catch (error) {
    safeLog('Failed to get stored user data', { error: String(error) });
  }
  return null;
}

/**
 * Clear all auth data from storage.
 */
async function clearAuthStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_USER_KEY);
  } catch (error) {
    safeLog('Failed to clear auth storage', { error: String(error) });
  }
}

function toFallbackAppUser(sessionUser: SupabaseUser, existingUser?: User | null): User {
  if (existingUser && existingUser.id === sessionUser.id) {
    return existingUser;
  }

  return transformSupabaseUser(sessionUser);
}

let messagingSchemaCapability: 'unknown' | 'available' | 'unavailable' = 'unknown';

async function primeSecureMessagingIdentity(userId: string): Promise<void> {
  if (!supportsSecureMessagingIdentity) {
    return;
  }

  if (messagingSchemaCapability === 'unavailable') {
    return;
  }

  try {
    await Promise.all([
      getMessagingIdentity(userId),
      getOrCreateDeviceIdentity(userId),
    ]);
    messagingSchemaCapability = 'available';
  } catch (error) {
    if (
      (error instanceof DeviceIdentityError && error.code === 'schema_unavailable')
      || (error instanceof SecureMessagingError && error.code === 'schema_unavailable')
    ) {
      messagingSchemaCapability = 'unavailable';
      return;
    }
    safeLog('Secure messaging identity setup failed', { error: String(error) });
  }
}

async function primeSubscriptionIdentity(userId: string): Promise<void> {
  if (!supportsRevenueCatPurchases) {
    return;
  }

  const result = await initRevenueCat(userId);
  if (!result.success && result.error && !result.error.toLowerCase().includes('unavailable')) {
    safeLog('RevenueCat initialization skipped', { error: result.error });
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [needsPhoneVerification, setNeedsPhoneVerification] = useState(false);
  const [signupData, setSignupData] = useState<SignupData>(defaultSignupData);
  const [signupConsents, setSignupConsents] = useState<SignupConsents>(defaultSignupConsents);
  const [signupDraftStep, setSignupDraftStep] = useState<number | null>(null);
  const isAuthenticated = !!session && !!supabaseUser;

  /**
   * Fetch user profile from Supabase
   */
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned - profile might not exist yet
        console.error('Error fetching profile:', error);
      }

      return profile;
    } catch (err) {
      console.error('Error in fetchUserProfile:', err);
      return null;
    }
  }, []);

  const resolveAndPersistMetroForUser = useCallback(async (
    userId: string,
    profile: Record<string, unknown> | null | undefined
  ): Promise<Record<string, unknown> | null> => {
    if (!profile) return null;

    const city = typeof profile.city === 'string' ? profile.city : '';
    const country = typeof profile.country === 'string' ? profile.country : '';
    if (!city.trim() || !country.trim()) {
      return profile;
    }

    const metroAlreadyResolved = typeof profile.metro_area_id === 'string'
      || typeof profile.auto_metro_area_id === 'string'
      || typeof profile.metro_resolved_at === 'string';
    if (metroAlreadyResolved) {
      return profile;
    }

    const resolution = await resolveMetroArea({
      city,
      state: typeof profile.state === 'string' ? profile.state : undefined,
      country,
      countryCode: typeof signupData.countryCode === 'string' ? signupData.countryCode : undefined,
    });

    const metroPayload = buildMetroUpdatePayload(resolution);
    let { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update(metroPayload)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      const message = String(error.message || '').toLowerCase();
      if (message.includes('auto_metro_area_id')) {
        const fallbackPayload = { ...metroPayload };
        delete fallbackPayload.auto_metro_area_id;
        const fallbackResult = await supabase
          .from('profiles')
          .update(fallbackPayload)
          .eq('id', userId)
          .select('*')
          .single();
        updatedProfile = fallbackResult.data;
        error = fallbackResult.error;
      }
    }

    if (error) {
      safeLog('Metro resolution persistence failed', { error: error.message || 'unknown' });
      return profile;
    }

    return (updatedProfile || profile) as Record<string, unknown>;
  }, [signupData.countryCode]);

  const upsertFriendProfileFromSignup = useCallback(async (
    userId: string,
    aboutValue: string | null | undefined
  ): Promise<void> => {
    const payload = {
      user_id: userId,
      headline: null,
      about: aboutValue || null,
      interests: signupData.interests,
      languages: signupData.languages,
      friendship_goals: signupData.lookingFor,
      discoverable: true,
    };

    const { error } = await supabase
      .from('friend_profiles')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      safeLog('Friend profile upsert during signup failed', { error: error.message || 'unknown' });
    }
  }, [signupData.interests, signupData.languages, signupData.lookingFor]);

  /**
   * Restore session on app launch using Supabase.
   */
  useEffect(() => {
    let sessionRestored = false;
    let isCancelled = false;
    let authChangeSequence = 0;

    const finishRestoring = () => {
      if (!sessionRestored) {
        sessionRestored = true;
        setIsRestoringSession(false);
      }
    };

    const restoreSession = async () => {
      try {
        // Get current session from Supabase
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          finishRestoring();
          return;
        }

        if (currentSession?.user) {
          setSession(currentSession);
          setSupabaseUser(currentSession.user);
          void primeSecureMessagingIdentity(currentSession.user.id);
          void primeSubscriptionIdentity(currentSession.user.id);

          const storedUser = await getStoredUser();
          setUser(toFallbackAppUser(currentSession.user, storedUser));

          // Fetch profile from database
          const profile = await fetchUserProfile(currentSession.user.id);

          // Check if email is verified
          const emailVerified = currentSession.user.email_confirmed_at !== null;
          setNeedsEmailVerification(!emailVerified);

          // Check if phone is verified
          const phoneVerified = profile?.phone_verified || false;
          setNeedsPhoneVerification(!phoneVerified);

          // Transform to our User type
          const appUser = transformSupabaseUser(currentSession.user, profile);
          setUser(appUser);
          await storeUser(appUser);

        } else {
          // No active session — check for a saved signup draft
          try {
            const draftJson = await AsyncStorage.getItem(SIGNUP_DRAFT_KEY);
            if (draftJson) {
              const draft: SignupDraft = JSON.parse(draftJson);
              setSignupData(prev => ({
                ...prev,
                ...draft.signupData,
                password: '', // loaded separately from SecureStore in SignupScreen
              }));
              setSignupConsents(draft.signupConsents);
              setSignupDraftStep(draft.currentStep);
            }
          } catch (draftError) {
            safeLog('Failed to restore signup draft', { error: String(draftError) });
          }
        }
      } catch (error) {
        safeLog('Failed to restore session', { error: String(error) });
      } finally {
        finishRestoring();
      }
    };

    restoreSession();

    // Safety timeout: never leave the user stuck on the loading screen
    const safetyTimeout = setTimeout(() => {
      if (!sessionRestored) {
        safeLog('Session restore timed out — proceeding');
        finishRestoring();
      }
    }, 6000);

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      authChangeSequence += 1;
      const currentSequence = authChangeSequence;

      // INITIAL_SESSION from onAuthStateChange also means session loading is done
      if (event === 'INITIAL_SESSION') {
        finishRestoring();
      }

      if (newSession?.user) {
        setSession(newSession);
        setSupabaseUser(newSession.user);
        setIsNewUser(false);
        setUser((prevUser) => toFallbackAppUser(newSession.user, prevUser));
        void primeSecureMessagingIdentity(newSession.user.id);
        void primeSubscriptionIdentity(newSession.user.id);

        // Supabase auth callbacks should not await async work, or OTP flows can stall.
        void (async () => {
          const profile = await fetchUserProfile(newSession.user.id);
          if (isCancelled || currentSequence !== authChangeSequence) return;

          const appUser = transformSupabaseUser(newSession.user, profile);
          setUser(appUser);
          await storeUser(appUser);
          if (isCancelled || currentSequence !== authChangeSequence) return;

          // Check verification status
          const emailVerified = newSession.user.email_confirmed_at !== null;
          setNeedsEmailVerification(!emailVerified);
          setNeedsPhoneVerification(!profile?.phone_verified);
        })();
      } else if (event === 'SIGNED_OUT') {
        // Only clear state on explicit sign-out, not on INITIAL_SESSION with null
        // (which can happen before AsyncStorage session is fully loaded)
        setSession(null);
        setSupabaseUser(null);
        setUser(null);
        setIsNewUser(false);
        setNeedsEmailVerification(false);
        setNeedsPhoneVerification(false);
        void clearAuthStorage();
      }
    });

    return () => {
      isCancelled = true;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  useEffect(() => {
    if (!supabaseUser?.id) {
      return;
    }

    if (!supportsSecureMessagingIdentity) {
      return;
    }

    if (messagingSchemaCapability === 'unavailable') {
      return;
    }

    const heartbeat = () => {
      void heartbeatDeviceIdentity(supabaseUser.id).catch((error) => {
        if (
          (error instanceof DeviceIdentityError && error.code === 'schema_unavailable')
          || (error instanceof SecureMessagingError && error.code === 'schema_unavailable')
        ) {
          messagingSchemaCapability = 'unavailable';
          return;
        }
        safeLog('Secure messaging device heartbeat failed', { error: String(error) });
      });
    };

    heartbeat();
    const interval = setInterval(heartbeat, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [supabaseUser?.id]);

  const updateSignupData = useCallback((data: Partial<SignupData>) => {
    setSignupData(prev => ({ ...prev, ...data }));
  }, []);

  const updateSignupConsents = useCallback((consents: Partial<SignupConsents>) => {
    setSignupConsents(prev => ({ ...prev, ...consents }));
  }, []);

  /**
   * Save signup draft to AsyncStorage (non-sensitive) and SecureStore (password)
   */
  const saveSignupDraft = useCallback(async (currentStep: number, confirmPassword: string) => {
    try {
      const { password: _pwd, ...dataWithoutPassword } = signupData;
      const draft: SignupDraft = {
        signupData: dataWithoutPassword,
        signupConsents,
        currentStep,
      };
      await AsyncStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));

      if (signupData.password) {
        await SecureStore.setItemAsync(SIGNUP_PWD_KEY, signupData.password);
      }
      if (confirmPassword) {
        await SecureStore.setItemAsync(SIGNUP_CONFIRM_PWD_KEY, confirmPassword);
      }

      setSignupDraftStep(currentStep);
    } catch (error) {
      safeLog('Failed to save signup draft', { error: String(error) });
    }
  }, [signupData, signupConsents]);

  /**
   * Clear signup draft from all storage
   */
  const clearSignupDraft = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(SIGNUP_DRAFT_KEY);
      await SecureStore.deleteItemAsync(SIGNUP_PWD_KEY);
      await SecureStore.deleteItemAsync(SIGNUP_CONFIRM_PWD_KEY);
      setSignupDraftStep(null);
    } catch (error) {
      safeLog('Failed to clear signup draft', { error: String(error) });
    }
  }, []);

  /**
   * Load password and confirmPassword from SecureStore for draft resume
   */
  const loadSignupDraftPassword = useCallback(async (): Promise<{ password: string; confirmPassword: string } | null> => {
    try {
      const password = await SecureStore.getItemAsync(SIGNUP_PWD_KEY);
      const confirmPassword = await SecureStore.getItemAsync(SIGNUP_CONFIRM_PWD_KEY);
      if (password) {
        return { password, confirmPassword: confirmPassword || '' };
      }
      return null;
    } catch (error) {
      safeLog('Failed to load signup draft password', { error: String(error) });
      return null;
    }
  }, []);

  /**
   * Validates that all required consents have been provided
   */
  const validateSignupConsents = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!signupConsents.termsAccepted) {
      errors.push('You must accept the Terms of Service');
    }

    if (!signupConsents.privacyAccepted) {
      errors.push('You must accept the Privacy Policy');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }, [signupConsents]);

  /**
   * Validates date of birth to ensure user is 18+
   */
  const validateAge = useCallback((dateOfBirth: string): boolean => {
    if (!dateOfBirth) return false;

    // Parse MM/DD/YYYY format explicitly to avoid Date constructor inconsistencies
    const parts = dateOfBirth.split('/');
    if (parts.length !== 3) return false;

    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (isNaN(month) || isNaN(day) || isNaN(year)) return false;

    const dob = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    return age >= 18;
  }, []);

  /**
   * Sign up with Supabase Auth
   */
  const signUp = useCallback(async (): Promise<{ success: boolean; needsVerification?: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      // Validate consents
      const consentValidation = validateSignupConsents();
      if (!consentValidation.valid) {
        return { success: false, error: consentValidation.errors[0] };
      }

      // Validate age
      if (signupData.dateOfBirth && !validateAge(signupData.dateOfBirth)) {
        return { success: false, error: 'You must be 18 or older to use this service' };
      }

      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            first_name: signupData.firstName,
            last_name: signupData.lastName,
            phone: signupData.phone,
            date_of_birth: signupData.dateOfBirth,
            gender: signupData.gender,
            city: signupData.city,
            state: signupData.state,
            country: signupData.country,
            bio: signupData.bio,
            interests: signupData.interests,
            languages: signupData.languages,
            looking_for: signupData.lookingFor,
            terms_accepted: signupConsents.termsAccepted,
            privacy_accepted: signupConsents.privacyAccepted,
            age_confirmed: signupConsents.ageConfirmed,
            marketing_opt_in: signupConsents.marketingOptIn,
          },
        },
      });

      if (error) {
        console.error('Signup error:', error);
        return { success: false, error: error.message };
      }

      if (data.user) {
        setSupabaseUser(data.user);
        setIsNewUser(true);

        // Check if email confirmation is required
        const needsVerification = !data.user.email_confirmed_at;
        setNeedsEmailVerification(needsVerification);
        setNeedsPhoneVerification(true); // Phone verification always needed

        if (data.session) {
          setSession(data.session);
          let profile = await fetchUserProfile(data.user.id);

          // If trigger didn't create a full profile, ensure it exists with all data
          if (!profile || !profile.city) {
            try {
              const profileData: Record<string, unknown> = {
                id: data.user.id,
                first_name: signupData.firstName || '',
                last_name: signupData.lastName || '',
                email: signupData.email,
                phone: signupData.phone || null,
                bio: signupData.bio || null,
                gender: signupData.gender || null,
                city: signupData.city || null,
                state: signupData.state || null,
                country: signupData.country || null,
                terms_accepted: signupConsents.termsAccepted,
                terms_accepted_at: signupConsents.termsAccepted ? new Date().toISOString() : null,
                privacy_accepted: signupConsents.privacyAccepted,
                privacy_accepted_at: signupConsents.privacyAccepted ? new Date().toISOString() : null,
                age_confirmed: signupConsents.ageConfirmed,
                age_confirmed_at: signupConsents.ageConfirmed ? new Date().toISOString() : null,
                marketing_opt_in: signupConsents.marketingOptIn,
              };

              // Parse date of birth
              if (signupData.dateOfBirth) {
                const parts = signupData.dateOfBirth.split('/');
                if (parts.length === 3) {
                  const [month, day, year] = parts;
                  profileData.date_of_birth = `${year}-${month}-${day}`;
                }
              }

              const { data: upsertedProfile } = await supabase
                .from('profiles')
                .upsert(profileData)
                .select()
                .single();

              if (upsertedProfile) {
                profile = upsertedProfile;
              }
            } catch (profileErr) {
              safeLog('Profile upsert fallback failed', { error: String(profileErr) });
            }
          }

          profile = await resolveAndPersistMetroForUser(
            data.user.id,
            (profile || null) as Record<string, unknown> | null,
          );

          await upsertFriendProfileFromSignup(
            data.user.id,
            typeof (profile as Record<string, unknown> | null)?.bio === 'string'
              ? ((profile as Record<string, unknown>).bio as string)
              : signupData.bio,
          );

          const appUser = transformSupabaseUser(data.user, profile);
          setUser(appUser);
          await storeUser(appUser);
        }

        // Clear signup draft after successful registration
        await clearSignupDraft();

        return { success: true, needsVerification };
      }

      return { success: false, error: 'Unknown error occurred' };
    } catch (error) {
      safeLog('Signup failed', { error: String(error) });
      return { success: false, error: 'Failed to create account. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  }, [
    signupData,
    signupConsents,
    validateSignupConsents,
    validateAge,
    fetchUserProfile,
    resolveAndPersistMetroForUser,
    upsertFriendProfileFromSignup,
  ]);

  /**
   * Sign in with Supabase Auth
   */
  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        trackEvent('auth_signin_fail', { source: 'password', reason: error.message || 'unknown' });
        return { success: false, error: error.message };
      }

      if (data.user && data.session) {
        setSession(data.session);
        setSupabaseUser(data.user);
        setIsNewUser(false);

        // Fetch profile and set user
        const profile = await fetchUserProfile(data.user.id);
        const appUser = transformSupabaseUser(data.user, profile);
        setUser(appUser);
        await storeUser(appUser);

        // Check verification status
        setNeedsEmailVerification(!data.user.email_confirmed_at);
        setNeedsPhoneVerification(!profile?.phone_verified);

        trackEvent('auth_signin_success', { source: 'password' });
        return { success: true };
      }

      trackEvent('auth_signin_fail', { source: 'password', reason: 'invalid_credentials' });
      return { success: false, error: 'Invalid credentials' };
    } catch (error) {
      safeLog('Sign in failed', { error: String(error) });
      trackEvent('auth_signin_fail', { source: 'password', reason: 'exception' });
      return { success: false, error: 'Failed to sign in. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserProfile]);

  /**
   * Sign in with Apple using identity token
   */
  const signInWithApple = useCallback(async (
    identityToken: string,
    fullName?: { givenName?: string | null; familyName?: string | null }
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      });

      if (error) {
        console.error('Apple Sign In error:', error);
        trackEvent('auth_signin_fail', { source: 'apple', reason: error.message || 'unknown' });
        return { success: false, error: error.message };
      }

      if (data.user && data.session) {
        setSession(data.session);
        setSupabaseUser(data.user);
        setIsNewUser(false);

        // Fetch or create profile
        let profile = await fetchUserProfile(data.user.id);

        // If profile doesn't exist or name is missing, update it with Apple data
        if (!profile || (!profile.first_name && fullName?.givenName)) {
          const updates: Record<string, any> = {};
          if (fullName?.givenName) updates.first_name = fullName.givenName;
          if (fullName?.familyName) updates.last_name = fullName.familyName;

          if (Object.keys(updates).length > 0) {
            const { data: updatedProfile } = await supabase
              .from('profiles')
              .upsert({
                id: data.user.id,
                email: data.user.email,
                ...updates,
              })
              .select()
              .single();

            if (updatedProfile) {
              profile = updatedProfile;
            }
          }
        }

        const appUser = transformSupabaseUser(data.user, profile);
        setUser(appUser);
        await storeUser(appUser);

        // Check verification status
        setNeedsEmailVerification(!data.user.email_confirmed_at);
        setNeedsPhoneVerification(!profile?.phone_verified);

        trackEvent('auth_signin_success', { source: 'apple' });
        return { success: true };
      }

      trackEvent('auth_signin_fail', { source: 'apple', reason: 'authentication_failed' });
      return { success: false, error: 'Authentication failed' };
    } catch (error) {
      safeLog('Apple Sign In failed', { error: String(error) });
      trackEvent('auth_signin_fail', { source: 'apple', reason: 'exception' });
      return { success: false, error: 'Failed to sign in with Apple. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserProfile]);

  /**
   * Sign out with Supabase Auth
   */
  const signOut = useCallback(async () => {
    setIsLoading(true);

    try {
      await supabase.auth.signOut();
      await clearAuthStorage();
      await clearSignupDraft();

      setUser(null);
      setSupabaseUser(null);
      setSession(null);
      setIsNewUser(false);
      setNeedsEmailVerification(false);
      setNeedsPhoneVerification(false);
      setSignupData(defaultSignupData);
      setSignupConsents(defaultSignupConsents);
    } catch (error) {
      safeLog('Sign out failed', { error: String(error) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Verify email with OTP token
   */
  const verifyEmail = useCallback(async (token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token,
        type: 'email',
        email: signupData.email || supabaseUser?.email || '',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        setSupabaseUser(data.user);
        if (data.session) {
          setSession(data.session);
        }

        const profile = await fetchUserProfile(data.user.id);
        const appUser = transformSupabaseUser(data.user, profile);
        setUser(appUser);
        await storeUser(appUser);

        setNeedsEmailVerification(false);
        setNeedsPhoneVerification(!profile?.phone_verified);
        return { success: true };
      }

      return { success: false, error: 'Verification failed' };
    } catch (error) {
      return { success: false, error: 'Failed to verify email' };
    }
  }, [signupData.email, supabaseUser?.email, fetchUserProfile]);

  /**
   * Resend email verification
   */
  const resendEmailVerification = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const email = signupData.email || supabaseUser?.email;
      if (!email) {
        return { success: false, error: 'No email address found' };
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to resend verification email' };
    }
  }, [signupData.email, supabaseUser?.email]);

  /**
   * Mark email as verified (called after verification)
   */
  const setEmailVerified = useCallback(() => {
    setNeedsEmailVerification(false);
  }, []);

  /**
   * Mark phone as verified (called after verification)
   */
  const setPhoneVerified = useCallback(() => {
    setNeedsPhoneVerification(false);
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      const updatedUser = {
        ...currentUser,
        isVerified: true,
      };

      void storeUser(updatedUser);
      return updatedUser;
    });
  }, []);

  /**
   * Refresh the session token
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data.session) {
        return false;
      }

      setSession(data.session);
      return true;
    } catch (error) {
      safeLog('Session refresh failed', { error: String(error) });
      return false;
    }
  }, []);

  /**
   * Refresh the current user's profile row and update in-memory auth state.
   */
  const refreshUserProfile = useCallback(async (): Promise<boolean> => {
    if (!supabaseUser) {
      return false;
    }

    try {
      const profile = await fetchUserProfile(supabaseUser.id);
      const refreshedUser = transformSupabaseUser(supabaseUser, profile);
      setUser(refreshedUser);
      await storeUser(refreshedUser);
      setNeedsEmailVerification(!supabaseUser.email_confirmed_at);
      setNeedsPhoneVerification(!profile?.phone_verified);
      return true;
    } catch (error) {
      safeLog('Failed to refresh user profile', { error: String(error) });
      return false;
    }
  }, [fetchUserProfile, supabaseUser]);

  /**
   * Request a password reset OTP for the given email
   */
  const requestPasswordReset = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to send reset code. Please try again.' };
    }
  }, []);

  /**
   * Verify password reset OTP and set new password
   */
  const confirmPasswordReset = useCallback(async (
    email: string,
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery',
      });

      if (otpError) {
        return { success: false, error: otpError.message };
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Sign out so user can sign in fresh with new password
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseUser(null);
      setSession(null);

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to reset password. Please try again.' };
    }
  }, []);

  /**
   * Change password for an authenticated user (verifies current password first)
   */
  const updateUserPassword = useCallback(async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const userEmail = user?.email || supabaseUser?.email;
      if (!userEmail) {
        return { success: false, error: 'No email address found' };
      }

      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        return { success: false, error: 'Current password is incorrect' };
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to update password. Please try again.' };
    }
  }, [user?.email, supabaseUser?.email]);

  /**
   * Request email change (sends OTP to new email)
   */
  const updateUserEmail = useCallback(async (newEmail: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to send verification code. Please try again.' };
    }
  }, []);

  /**
   * Confirm email change with OTP
   */
  const confirmEmailChange = useCallback(async (
    newEmail: string,
    token: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: newEmail,
        token,
        type: 'email_change',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to verify email. Please try again.' };
    }
  }, []);

  /**
   * Send magic link OTP for passwordless sign in
   */
  const signInWithMagicLink = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to send login code. Please try again.' };
    }
  }, []);

  /**
   * Verify magic link OTP to complete sign in
   */
  const verifyMagicLinkOtp = useCallback(async (
    email: string,
    token: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: 'Could not complete sign in. Please request a new code and try again.',
        };
      }

      setSession(data.session);
      setSupabaseUser(data.user);
      setIsNewUser(false);

      const profile = await fetchUserProfile(data.user.id);
      const appUser = transformSupabaseUser(data.user, profile);
      setUser(appUser);
      await storeUser(appUser);
      setNeedsEmailVerification(!data.user.email_confirmed_at);
      setNeedsPhoneVerification(!profile?.phone_verified);

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to verify code. Please try again.' };
    }
  }, [fetchUserProfile]);

  const completeTutorial = useCallback(() => {
    setIsNewUser(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        isAuthenticated,
        isNewUser,
        isLoading,
        isRestoringSession,
        needsEmailVerification,
        needsPhoneVerification,
        signupData,
        signupConsents,
        updateSignupData,
        updateSignupConsents,
        signUp,
        signIn,
        signInWithApple,
        signOut,
        completeTutorial,
        validateSignupConsents,
        refreshSession,
        refreshUserProfile,
        verifyEmail,
        resendEmailVerification,
        setEmailVerified,
        setPhoneVerified,
        signupDraftStep,
        saveSignupDraft,
        clearSignupDraft,
        loadSignupDraftPassword,
        requestPasswordReset,
        confirmPasswordReset,
        updateUserPassword,
        updateUserEmail,
        confirmEmailChange,
        signInWithMagicLink,
        verifyMagicLinkOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
