/**
 * Profiles API Service
 * Handles user profile operations with Supabase
 */

import { supabase } from '../supabase';
import { resolveMetroArea } from './locationApi';
import { trackEvent } from '../monitoring/events';

const PROFILE_AVATAR_BUCKET_CANDIDATES = [
  'profile-avatars',
  'profile-photos',
] as const;
const PROFILE_AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

const isBucketMissingError = (error: unknown): boolean => {
  const message = String((error as { message?: string } | null)?.message || '').toLowerCase();
  return message.includes('bucket') && message.includes('not found');
};

const MIN_PROFILE_PHOTO_BYTES = 45_000;
const MAX_PROFILE_PHOTO_BYTES = 10_485_760;
const MIN_PROFILE_PHOTO_DIMENSION = 512;

type AvatarStorageReference = {
  bucket: string;
  objectPath: string;
};

function parseAvatarStorageReference(url: string): AvatarStorageReference | null {
  try {
    const parsed = new URL(url);
    const publicPrefix = '/storage/v1/object/public/';
    const signedPrefix = '/storage/v1/object/sign/';
    const path = parsed.pathname;

    let withoutPrefix: string | null = null;
    if (path.startsWith(publicPrefix)) {
      withoutPrefix = path.slice(publicPrefix.length);
    } else if (path.startsWith(signedPrefix)) {
      withoutPrefix = path.slice(signedPrefix.length);
    }

    if (!withoutPrefix) {
      return null;
    }

    const firstSlash = withoutPrefix.indexOf('/');
    if (firstSlash <= 0 || firstSlash === withoutPrefix.length - 1) {
      return null;
    }

    const bucket = withoutPrefix.slice(0, firstSlash).trim();
    const objectPath = decodeURIComponent(withoutPrefix.slice(firstSlash + 1)).trim();
    if (!bucket || !objectPath) {
      return null;
    }

    return { bucket, objectPath };
  } catch {
    return null;
  }
}

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
  profile_photo_source?: 'in_app_camera' | 'legacy_import' | 'unknown' | string | null;
  profile_photo_captured_at?: string | null;
  profile_photo_capture_verified?: boolean;
  profile_photo_last_changed_at?: string | null;
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
}

export interface UpdateLegalConsentsInput {
  terms_accepted?: boolean;
  terms_version?: string;
  privacy_accepted?: boolean;
  privacy_version?: string;
  age_confirmed?: boolean;
}

type ProfilePhotoCaptureMetadata = {
  width?: number;
  height?: number;
  fileSizeBytes?: number;
};

type CaptureVerificationResultRow = {
  success?: boolean;
  reason_code?: string | null;
  reason_message?: string | null;
};

function normalizeCaptureVerificationResult(raw: unknown): CaptureVerificationResultRow {
  if (Array.isArray(raw) && raw.length > 0) {
    return (raw[0] || {}) as CaptureVerificationResultRow;
  }
  if (raw && typeof raw === 'object') {
    return raw as CaptureVerificationResultRow;
  }
  return {};
}

function isMissingCaptureVerificationRpcError(error: unknown): boolean {
  const typedError = error as { code?: string | null; message?: string | null } | null | undefined;
  const code = String(typedError?.code || '');
  const message = String(typedError?.message || '').toLowerCase();
  return (
    code === '42883'
    || (code.startsWith('PGRST') && message.includes('mark_profile_photo_capture_verified_v1'))
    || message.includes('mark_profile_photo_capture_verified_v1')
  );
}

async function isReadablePublicImageUrl(url: string): Promise<boolean> {
  try {
    const headResponse = await fetch(url, { method: 'HEAD' });
    if (headResponse.ok) {
      return true;
    }

    // Some storage/CDN stacks reject HEAD; fallback to a lightweight GET check.
    if (headResponse.status === 405 || headResponse.status === 403 || headResponse.status === 401) {
      const getResponse = await fetch(url, { method: 'GET' });
      return getResponse.ok;
    }

    return false;
  } catch {
    return false;
  }
}

async function buildAccessibleAvatarUrl(bucket: string, objectPath: string): Promise<string | null> {
  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(objectPath);
  const publicUrl = publicUrlData?.publicUrl || null;

  if (publicUrl) {
    const publicReadable = await isReadablePublicImageUrl(publicUrl);
    if (publicReadable) {
      return publicUrl;
    }
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, PROFILE_AVATAR_SIGNED_URL_TTL_SECONDS);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return publicUrl;
  }

  return signedUrlData.signedUrl;
}

export async function resolveProfileAvatarUrl(rawAvatarUrl?: string | null): Promise<string | null> {
  const avatarUrl = typeof rawAvatarUrl === 'string' ? rawAvatarUrl.trim() : '';
  if (!avatarUrl) {
    return null;
  }

  const storageRef = parseAvatarStorageReference(avatarUrl);
  if (!storageRef) {
    return avatarUrl;
  }

  const resolvedUrl = await buildAccessibleAvatarUrl(storageRef.bucket, storageRef.objectPath);
  return resolvedUrl || avatarUrl;
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
        metroUpdates.metro_area_id = metroResolution.metro.metroAreaId;
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
        if (message.includes('auto_metro_area_id') || message.includes('metro_area_id')) {
          const fallbackMetroUpdates = { ...metroUpdates };
          delete fallbackMetroUpdates.auto_metro_area_id;
          delete fallbackMetroUpdates.metro_area_id;

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
export async function uploadProfileAvatar(
  fileUri: string,
  captureMetadata?: ProfilePhotoCaptureMetadata,
): Promise<{ profile: ProfileData | null; error: Error | null }> {
  try {
    trackEvent('profile_photo_capture_started', { source: 'edit_profile' });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { profile: null, error: new Error('Not authenticated') };
    }

    const response = await fetch(fileUri);
    const blob = await response.blob();
    const blobSizeBytes = Math.max(0, Math.floor(
      Number.isFinite(captureMetadata?.fileSizeBytes)
        ? Number(captureMetadata?.fileSizeBytes)
        : blob.size
    ));

    if (blobSizeBytes < MIN_PROFILE_PHOTO_BYTES) {
      trackEvent('profile_photo_capture_failed_quality', {
        reason: 'file_too_small',
        file_size_bytes: blobSizeBytes,
      });
      return {
        profile: null,
        error: new Error('Photo quality is too low. Retake with better lighting and your full face visible.'),
      };
    }

    if (blobSizeBytes > MAX_PROFILE_PHOTO_BYTES) {
      trackEvent('profile_photo_capture_failed_quality', {
        reason: 'file_too_large',
        file_size_bytes: blobSizeBytes,
      });
      return {
        profile: null,
        error: new Error('Photo file is too large. Retake your photo and try again.'),
      };
    }

    const captureWidth = Number.isFinite(captureMetadata?.width) ? Number(captureMetadata?.width) : null;
    const captureHeight = Number.isFinite(captureMetadata?.height) ? Number(captureMetadata?.height) : null;

    if (
      (captureWidth !== null && captureWidth < MIN_PROFILE_PHOTO_DIMENSION)
      || (captureHeight !== null && captureHeight < MIN_PROFILE_PHOTO_DIMENSION)
    ) {
      trackEvent('profile_photo_capture_failed_quality', {
        reason: 'resolution_too_low',
        width: captureWidth ?? 0,
        height: captureHeight ?? 0,
      });
      return {
        profile: null,
        error: new Error('Photo resolution is too low. Retake your photo with your face centered and clearly visible.'),
      };
    }

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

    let uploadPath: string | null = null;
    let activeBucket: string = PROFILE_AVATAR_BUCKET_CANDIDATES[0];
    let lastBucketMissingError: Error | null = null;

    for (const bucket of PROFILE_AVATAR_BUCKET_CANDIDATES) {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(objectPath, blob, {
          contentType,
          upsert: true,
        });

      if (!uploadError && uploadData?.path) {
        uploadPath = uploadData.path;
        activeBucket = bucket;
        break;
      }

      if (uploadError && isBucketMissingError(uploadError)) {
        lastBucketMissingError = uploadError as Error;
        continue;
      }

      return { profile: null, error: uploadError || new Error('Failed to upload profile photo') };
    }

    if (!uploadPath) {
      return {
        profile: null,
        error: lastBucketMissingError || new Error('Profile photo uploads are temporarily unavailable'),
      };
    }

    const avatarUrl = await buildAccessibleAvatarUrl(activeBucket, uploadPath);
    if (!avatarUrl) {
      return { profile: null, error: new Error('Unable to generate profile photo URL') };
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('*')
      .single();

    if (profileError) {
      return { profile: null, error: profileError };
    }

    trackEvent('profile_photo_trust_revoked', { reason: 'avatar_changed' });

    const { data: captureVerificationData, error: captureVerificationError } = await supabase
      .rpc('mark_profile_photo_capture_verified_v1', {
        p_blob_size_bytes: blobSizeBytes,
        p_capture_width: captureWidth,
        p_capture_height: captureHeight,
      });

    if (captureVerificationError) {
      if (isMissingCaptureVerificationRpcError(captureVerificationError)) {
        // Backward compatibility while migration/function rollout completes.
        return { profile: updatedProfile as ProfileData, error: null };
      }

      const captureErrorMessage = String(captureVerificationError.message || 'Unable to validate profile photo capture.');
      if (captureErrorMessage.toLowerCase().includes('rate')) {
        trackEvent('profile_photo_capture_failed_spoof_risk', { reason: 'capture_rate_limited' });
      } else {
        trackEvent('profile_photo_capture_failed_quality', { reason: 'capture_validation_failed' });
      }

      return {
        profile: null,
        error: new Error(captureErrorMessage),
      };
    }

    const captureResult = normalizeCaptureVerificationResult(captureVerificationData);
    if (captureResult.success !== true) {
      const reasonCode = String(captureResult.reason_code || '').toLowerCase();
      const reasonMessage = captureResult.reason_message || 'Retake your profile photo and try again.';
      if (reasonCode.includes('rate')) {
        trackEvent('profile_photo_capture_failed_spoof_risk', { reason: reasonCode || 'capture_rate_limited' });
      } else {
        trackEvent('profile_photo_capture_failed_quality', { reason: reasonCode || 'capture_validation_failed' });
      }
      return {
        profile: null,
        error: new Error(reasonMessage),
      };
    }

    const { data: refreshedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return {
      profile: ((refreshedProfile || updatedProfile) as ProfileData),
      error: null,
    };
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
