/**
 * Profiles API Service
 * Handles user profile operations with Supabase
 */

import { supabase } from '../supabase';

export interface ProfileData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  date_of_birth?: string;
  gender?: string;
  city?: string;
  state?: string;
  country?: string;
  email_verified: boolean;
  phone_verified: boolean;
  id_verified: boolean;
  verification_level: string;
  terms_accepted: boolean;
  privacy_accepted: boolean;
  age_confirmed: boolean;
  electronic_signature_consent?: boolean;
  electronic_signature_consent_at?: string | null;
  marketing_opt_in?: boolean;
  subscription_tier: 'free' | 'pro' | string;
  pro_status?: 'inactive' | 'active' | 'grace' | 'past_due' | 'canceled' | string;
  pro_platform?: 'ios' | 'android' | 'web' | string | null;
  pro_product_id?: string | null;
  pro_started_at?: string | null;
  pro_renews_at?: string | null;
  pro_expires_at?: string | null;
  pro_entitlement_updated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileInput {
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  date_of_birth?: string;
  gender?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface UpdateLegalConsentsInput {
  terms_accepted?: boolean;
  terms_version?: string;
  privacy_accepted?: boolean;
  privacy_version?: string;
  age_confirmed?: boolean;
}

/**
 * Get the current user's profile
 */
export async function getCurrentProfile(): Promise<{ profile: ProfileData | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { profile: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return { profile: null, error };
    }

    return { profile: data, error: null };
  } catch (err) {
    console.error('Error in getCurrentProfile:', err);
    return { profile: null, error: err as Error };
  }
}

/**
 * Get a profile by user ID
 */
export async function getProfileById(userId: string): Promise<{ profile: ProfileData | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return { profile: null, error };
    }

    return { profile: data, error: null };
  } catch (err) {
    console.error('Error in getProfileById:', err);
    return { profile: null, error: err as Error };
  }
}

/**
 * Update the current user's profile
 */
export async function updateProfile(updates: UpdateProfileInput): Promise<{ profile: ProfileData | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { profile: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return { profile: null, error };
    }

    return { profile: data, error: null };
  } catch (err) {
    console.error('Error in updateProfile:', err);
    return { profile: null, error: err as Error };
  }
}

/**
 * Update legal consents for the current user
 */
export async function updateLegalConsents(consents: UpdateLegalConsentsInput): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: new Error('Not authenticated') };
    }

    const updates: Record<string, unknown> = {};

    if (consents.terms_accepted !== undefined) {
      updates.terms_accepted = consents.terms_accepted;
      updates.terms_accepted_at = consents.terms_accepted ? new Date().toISOString() : null;
      if (consents.terms_version) {
        updates.terms_version = consents.terms_version;
      }
    }

    if (consents.privacy_accepted !== undefined) {
      updates.privacy_accepted = consents.privacy_accepted;
      updates.privacy_accepted_at = consents.privacy_accepted ? new Date().toISOString() : null;
      if (consents.privacy_version) {
        updates.privacy_version = consents.privacy_version;
      }
    }

    if (consents.age_confirmed !== undefined) {
      updates.age_confirmed = consents.age_confirmed;
      updates.age_confirmed_at = consents.age_confirmed ? new Date().toISOString() : null;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating legal consents:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in updateLegalConsents:', err);
    return { success: false, error: err as Error };
  }
}

/**
 * Update phone verification status
 */
export async function updatePhoneVerification(verified: boolean): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: new Error('Not authenticated') };
    }

    const updates = {
      phone_verified: verified,
      phone_verified_at: verified ? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating phone verification:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in updatePhoneVerification:', err);
    return { success: false, error: err as Error };
  }
}

/**
 * Update email verification status
 */
export async function updateEmailVerification(verified: boolean): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        email_verified: verified,
        email_verified_at: verified ? new Date().toISOString() : null,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating email verification:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in updateEmailVerification:', err);
    return { success: false, error: err as Error };
  }
}
