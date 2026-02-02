import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, SignupData } from '../types';
import { defaultSignupData } from '../types';
import { safeLog } from '../utils/sanitize';
import { supabase } from '../services/supabase';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

// Storage keys
const AUTH_USER_KEY = '@wingman_user';

/**
 * Signup consents that must be collected during registration
 */
export interface SignupConsents {
  ageConfirmed: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingOptIn: boolean;
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
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string }>;
  resendEmailVerification: () => Promise<{ success: boolean; error?: string }>;
  setEmailVerified: () => void;
  setPhoneVerified: () => void;
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
    } : undefined,
    isVerified: profile?.phone_verified || false,
    isPremium: profile?.subscription_tier !== 'free',
    subscriptionTier: profile?.subscription_tier || 'free',
    createdAt: supabaseUser.created_at || new Date().toISOString(),
    lastActive: new Date().toISOString(),
  };
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

  /**
   * Restore session on app launch using Supabase.
   */
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Get current session from Supabase
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          setIsRestoringSession(false);
          return;
        }

        if (currentSession?.user) {
          setSession(currentSession);
          setSupabaseUser(currentSession.user);

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

          safeLog('Session restored successfully');
        }
      } catch (error) {
        safeLog('Failed to restore session', { error: String(error) });
      } finally {
        setIsRestoringSession(false);
      }
    };

    restoreSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      safeLog('Auth state changed', { event });

      if (newSession?.user) {
        setSession(newSession);
        setSupabaseUser(newSession.user);

        const profile = await fetchUserProfile(newSession.user.id);
        const appUser = transformSupabaseUser(newSession.user, profile);
        setUser(appUser);
        await storeUser(appUser);

        // Check verification status
        const emailVerified = newSession.user.email_confirmed_at !== null;
        setNeedsEmailVerification(!emailVerified);
        setNeedsPhoneVerification(!profile?.phone_verified);
      } else {
        setSession(null);
        setSupabaseUser(null);
        setUser(null);
        await clearAuthStorage();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const updateSignupData = useCallback((data: Partial<SignupData>) => {
    setSignupData(prev => ({ ...prev, ...data }));
  }, []);

  const updateSignupConsents = useCallback((consents: Partial<SignupConsents>) => {
    setSignupConsents(prev => ({ ...prev, ...consents }));
  }, []);

  /**
   * Validates that all required consents have been provided
   */
  const validateSignupConsents = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!signupConsents.ageConfirmed) {
      errors.push('You must confirm that you are 18 years or older');
    }

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

    const dob = new Date(dateOfBirth);
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
          const profile = await fetchUserProfile(data.user.id);
          const appUser = transformSupabaseUser(data.user, profile);
          setUser(appUser);
          await storeUser(appUser);
        }

        return { success: true, needsVerification };
      }

      return { success: false, error: 'Unknown error occurred' };
    } catch (error) {
      safeLog('Signup failed', { error: String(error) });
      return { success: false, error: 'Failed to create account. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  }, [signupData, signupConsents, validateSignupConsents, validateAge, fetchUserProfile]);

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

        return { success: true };
      }

      return { success: false, error: 'Invalid credentials' };
    } catch (error) {
      safeLog('Sign in failed', { error: String(error) });
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

        return { success: true };
      }

      return { success: false, error: 'Authentication failed' };
    } catch (error) {
      safeLog('Apple Sign In failed', { error: String(error) });
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
        setNeedsEmailVerification(false);
        return { success: true };
      }

      return { success: false, error: 'Verification failed' };
    } catch (error) {
      return { success: false, error: 'Failed to verify email' };
    }
  }, [signupData.email, supabaseUser?.email]);

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

  const completeTutorial = useCallback(() => {
    setIsNewUser(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        isAuthenticated: !!user && !!session,
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
        verifyEmail,
        resendEmailVerification,
        setEmailVerified,
        setPhoneVerified,
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
