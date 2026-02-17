/**
 * Companions API Service
 *
 * Fetches companion data from Supabase.
 */

import type { Companion } from '../types';
import { supabase } from './supabase';
import { isIdVerificationActive } from '../utils/idVerification';

/**
 * Fetch active companions from the database, joined with their profile data.
 * Returns an empty array on error.
 */
export async function fetchCompanions(): Promise<Companion[]> {
  const { data, error } = await supabase
    .from('companions')
    .select(`
      *,
      profiles!companions_user_id_fkey (*)
    `)
    .eq('is_active', true)
    .order('rating', { ascending: false });

  if (error || !data) {
    if (error) console.error('Error fetching companions:', error);
    return [];
  }

  return data
    .map((row: any) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const hasActiveIdVerification = isIdVerificationActive({
        id_verified: profile?.id_verified,
        id_verification_status: profile?.id_verification_status,
        id_verification_expires_at: profile?.id_verification_expires_at,
      });
      const verificationLevel = (
        hasActiveIdVerification
        && profile?.verification_level === 'premium'
      )
        ? 'premium'
        : (hasActiveIdVerification ? 'verified' : 'basic');
      const idVerified = hasActiveIdVerification;
      const hasProfilePhoto = typeof profile?.avatar_url === 'string' && profile.avatar_url.trim().length > 0;

      const companion: Companion = {
        id: row.id,
        user: {
          id: profile?.id || row.user_id || row.id,
          firstName: profile?.first_name || '',
          lastName: profile?.last_name || '',
          email: profile?.email || '',
          avatar: profile?.avatar_url || undefined,
          isVerified: idVerified,
          isPremium: (profile?.subscription_tier || 'free') !== 'free',
          idVerificationStatus: typeof profile?.id_verification_status === 'string'
            ? profile.id_verification_status
            : 'unverified',
          idVerificationExpiresAt: typeof profile?.id_verification_expires_at === 'string'
            ? profile.id_verification_expires_at
            : null,
          idVerifiedAt: typeof profile?.id_verified_at === 'string'
            ? profile.id_verified_at
            : null,
          createdAt: profile?.created_at || row.created_at || new Date().toISOString(),
        },
        rating: Number(row.rating) || 0,
        reviewCount: row.review_count || 0,
        hourlyRate: Number(row.hourly_rate),
        specialties: row.specialties || [],
        languages: Array.isArray(row.languages) ? row.languages : [],
        availability: [],
        isOnline: typeof row.is_available === 'boolean' ? row.is_available : true,
        responseTime: row.response_time || 'Usually responds within 1 hour',
        completedBookings: row.completed_bookings || 0,
        badges: [],
        gallery: row.gallery || [],
        about: row.about || '',
        interests: [],
        verificationLevel,
      };

      return {
        companion,
        idVerified,
        hasProfilePhoto,
      };
    })
    .filter((item) => item.idVerified && item.hasProfilePhoto)
    .map((item) => item.companion);
}
