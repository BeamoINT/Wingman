/**
 * Profiles API Service
 * Handles user profile operations with Supabase
 */

import { supabase } from '../supabase';
import { resolveMetroArea } from './locationApi';

const PROFILE_AVATARS_BUCKET = 'profile-avatars';

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
  metro_area_id?: string | null;
  auto_metro_area_id?: string | null;
  manual_metro_area_id?: string | null;
  default_metro_area_id?: string | null;
  metro_selection_mode?: 'auto' | 'manual' | 'default' | string | null;
  metro_selection_updated_at?: string | null;
  metro_area_name?: string | null;
  metro_city?: string | null;
  metro_state?: string | null;
  metro_country?: string | null;
  metro_resolved_at?: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  id_verified: boolean;
  id_verified_at?: string | null;
  id_verification_status?: 'unverified' | 'pending' | 'verified' | 'expired' | 'failed_name_mismatch' | 'failed' | string;
  id_verification_expires_at?: string | null;
  id_verification_failure_code?: string | null;
  id_verification_failure_message?: string | null;
  id_verification_last_failed_at?: string | null;
  id_verification_provider?: string | null;
  id_verification_provider_ref?: string | null;
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
  profile_photo_id_match_attested?: boolean;
  profile_photo_id_match_attested_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileInput {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  profile_photo_id_match_attested?: boolean;
  profile_photo_id_match_attested_at?: string | null;
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

    const sanitizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...sanitizedUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return { profile: null, error };
    }

    let profile = data as ProfileData;
    const locationUpdated = (
      updates.city !== undefined
      || updates.state !== undefined
      || updates.country !== undefined
    );

    if (locationUpdated) {
      const metroResolution = await resolveMetroArea({
        city: profile.city,
        state: profile.state,
        country: profile.country,
      });

      const metroUpdates: Record<string, unknown> = {
        metro_resolved_at: new Date().toISOString(),
      };

      if (metroResolution.metro) {
        metroUpdates.auto_metro_area_id = metroResolution.metro.metroAreaId;
        metroUpdates.metro_area_name = metroResolution.metro.metroAreaName;
        metroUpdates.metro_city = metroResolution.metro.metroCity;
        metroUpdates.metro_state = metroResolution.metro.metroState;
        metroUpdates.metro_country = metroResolution.metro.metroCountry;
      } else {
        metroUpdates.auto_metro_area_id = null;
        metroUpdates.metro_area_id = null;
        metroUpdates.metro_area_name = null;
        metroUpdates.metro_city = null;
        metroUpdates.metro_state = null;
        metroUpdates.metro_country = null;
      }

      const { data: metroProfile, error: metroError } = await supabase
        .from('profiles')
        .update(metroUpdates)
        .eq('id', user.id)
        .select()
        .single();

      if (!metroError && metroProfile) {
        profile = metroProfile as ProfileData;
      } else if (metroError) {
        const message = String((metroError as { message?: string })?.message || '').toLowerCase();
        if (message.includes('auto_metro_area_id')) {
          const fallbackMetroUpdates = { ...metroUpdates };
          delete fallbackMetroUpdates.auto_metro_area_id;
          if (metroResolution.metro) {
            fallbackMetroUpdates.metro_area_id = metroResolution.metro.metroAreaId;
          }

          const { data: legacyMetroProfile, error: legacyMetroError } = await supabase
            .from('profiles')
            .update(fallbackMetroUpdates)
            .eq('id', user.id)
            .select()
            .single();

          if (!legacyMetroError && legacyMetroProfile) {
            profile = legacyMetroProfile as ProfileData;
          }
        }
      }
    }

    return { profile, error: null };
  } catch (err) {
    console.error('Error in updateProfile:', err);
    return { profile: null, error: err as Error };
  }
}

/**
 * Upload and persist the current user's profile avatar.
 * Resets photo-ID attestation so users must reconfirm after changing photo.
 */
export async function uploadProfileAvatar(fileUri: string): Promise<{ profile: ProfileData | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { profile: null, error: new Error('Not authenticated') };
    }

    const response = await fetch(fileUri);
    const blob = await response.blob();

    const extension = (() => {
      const filename = fileUri.split('?')[0] || '';
      const raw = filename.split('.').pop()?.toLowerCase();
      if (!raw) return 'jpg';
      if (raw === 'jpeg' || raw === 'jpg' || raw === 'png' || raw === 'webp' || raw === 'heic') {
        return raw;
      }
      return 'jpg';
    })();

    const contentType = (() => {
      if (extension === 'png') return 'image/png';
      if (extension === 'webp') return 'image/webp';
      if (extension === 'heic') return 'image/heic';
      return 'image/jpeg';
    })();

    const objectPath = `${user.id}/avatar-${Date.now()}.${extension}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PROFILE_AVATARS_BUCKET)
      .upload(objectPath, blob, {
        contentType,
        upsert: true,
      });

    if (uploadError || !uploadData?.path) {
      return { profile: null, error: uploadError || new Error('Failed to upload profile photo') };
    }

    const { data: publicUrlData } = supabase.storage
      .from(PROFILE_AVATARS_BUCKET)
      .getPublicUrl(uploadData.path);

    const avatarUrl = publicUrlData?.publicUrl;
    if (!avatarUrl) {
      return { profile: null, error: new Error('Unable to generate profile photo URL') };
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update({
        avatar_url: avatarUrl,
        profile_photo_id_match_attested: false,
        profile_photo_id_match_attested_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('*')
      .single();

    if (profileError) {
      return { profile: null, error: profileError };
    }

    return { profile: updatedProfile as ProfileData, error: null };
  } catch (err) {
    console.error('Error uploading profile avatar:', err);
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
