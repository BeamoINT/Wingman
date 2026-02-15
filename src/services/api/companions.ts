/**
 * Companions API Service
 * Handles companion-related operations with Supabase
 */

import { supabase } from '../supabase';
import type { ProfileData } from './profiles';

export interface CompanionData {
  id: string;
  user_id: string;
  hourly_rate: number;
  specialties: string[];
  languages: string[];
  about: string;
  gallery: string[];
  is_active: boolean;
  is_available: boolean;
  rating: number;
  review_count: number;
  completed_bookings: number;
  response_time: string;
  created_at: string;
  updated_at: string;
  user?: ProfileData;
}

export interface CompanionFilters {
  specialty?: string;
  minRating?: number;
  maxRate?: number;
  minRate?: number;
  city?: string;
  isAvailable?: boolean;
  languages?: string[];
}

type QueryError = { code?: string | null; message?: string | null };

const DEFAULT_RESPONSE_TIME = 'Usually responds within 1 hour';

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function isMissingColumnError(error: unknown, column: string): boolean {
  const typedError = error as QueryError | null | undefined;
  if (typedError?.code !== '42703') return false;

  const message = String(typedError.message || '').toLowerCase();
  const tableColumnPattern = `column companions.${column}`.toLowerCase();
  const directColumnPattern = `column ${column}`.toLowerCase();

  return message.includes(tableColumnPattern) || message.includes(directColumnPattern);
}

function normalizeProfile(rawProfile: unknown): ProfileData | undefined {
  const profileObject = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
  if (!profileObject || typeof profileObject !== 'object') {
    return undefined;
  }

  const profile = profileObject as Record<string, unknown>;
  const now = new Date().toISOString();

  return {
    id: typeof profile.id === 'string' ? profile.id : '',
    first_name: typeof profile.first_name === 'string' ? profile.first_name : '',
    last_name: typeof profile.last_name === 'string' ? profile.last_name : '',
    email: typeof profile.email === 'string' ? profile.email : '',
    phone: typeof profile.phone === 'string' ? profile.phone : undefined,
    avatar_url: typeof profile.avatar_url === 'string' ? profile.avatar_url : undefined,
    bio: typeof profile.bio === 'string' ? profile.bio : undefined,
    date_of_birth: typeof profile.date_of_birth === 'string' ? profile.date_of_birth : undefined,
    gender: typeof profile.gender === 'string' ? profile.gender : undefined,
    city: typeof profile.city === 'string' ? profile.city : undefined,
    state: typeof profile.state === 'string' ? profile.state : undefined,
    country: typeof profile.country === 'string' ? profile.country : undefined,
    email_verified: !!profile.email_verified,
    phone_verified: !!profile.phone_verified,
    id_verified: !!profile.id_verified,
    verification_level: typeof profile.verification_level === 'string'
      ? profile.verification_level
      : 'basic',
    terms_accepted: !!profile.terms_accepted,
    privacy_accepted: !!profile.privacy_accepted,
    age_confirmed: !!profile.age_confirmed,
    subscription_tier: typeof profile.subscription_tier === 'string'
      ? profile.subscription_tier
      : 'free',
    created_at: typeof profile.created_at === 'string' ? profile.created_at : now,
    updated_at: typeof profile.updated_at === 'string' ? profile.updated_at : now,
  };
}

function normalizeCompanion(rawCompanion: unknown): CompanionData {
  const companion = (rawCompanion || {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const user = normalizeProfile(companion.user);

  return {
    id: typeof companion.id === 'string' ? companion.id : '',
    user_id: typeof companion.user_id === 'string'
      ? companion.user_id
      : (user?.id || ''),
    hourly_rate: toNumber(companion.hourly_rate, 0),
    specialties: toStringArray(companion.specialties),
    languages: toStringArray(companion.languages),
    about: typeof companion.about === 'string' ? companion.about : '',
    gallery: toStringArray(companion.gallery),
    is_active: typeof companion.is_active === 'boolean' ? companion.is_active : true,
    is_available: typeof companion.is_available === 'boolean' ? companion.is_available : true,
    rating: toNumber(companion.rating, 0),
    review_count: Math.max(0, Math.round(toNumber(companion.review_count, 0))),
    completed_bookings: Math.max(0, Math.round(toNumber(companion.completed_bookings, 0))),
    response_time: typeof companion.response_time === 'string' && companion.response_time.trim()
      ? companion.response_time
      : DEFAULT_RESPONSE_TIME,
    created_at: typeof companion.created_at === 'string' ? companion.created_at : now,
    updated_at: typeof companion.updated_at === 'string' ? companion.updated_at : now,
    user,
  };
}

function isVerifiedCompanion(companion: CompanionData): boolean {
  const verificationLevel = companion.user?.verification_level;
  if (verificationLevel === 'verified' || verificationLevel === 'premium') {
    return true;
  }

  return Boolean(companion.user?.id_verified || companion.user?.phone_verified);
}

function containsCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function hasLanguageOverlap(companionLanguages: string[], requestedLanguages: string[]): boolean {
  if (requestedLanguages.length === 0) return true;

  const requested = requestedLanguages.map(language => language.toLowerCase().trim());
  return companionLanguages.some(language => requested.includes(language.toLowerCase().trim()));
}

function sortByRatingAndReviews(a: CompanionData, b: CompanionData): number {
  if (b.rating !== a.rating) return b.rating - a.rating;
  return b.review_count - a.review_count;
}

function applyCompanionFilters(
  companions: CompanionData[],
  filters?: CompanionFilters
): CompanionData[] {
  if (!filters) return companions;

  let filtered = [...companions];

  if (filters.specialty) {
    filtered = filtered.filter(companion => companion.specialties.includes(filters.specialty as string));
  }

  if (typeof filters.minRating === 'number') {
    filtered = filtered.filter(companion => companion.rating >= filters.minRating!);
  }

  if (typeof filters.maxRate === 'number') {
    filtered = filtered.filter(companion => companion.hourly_rate <= filters.maxRate!);
  }

  if (typeof filters.minRate === 'number') {
    filtered = filtered.filter(companion => companion.hourly_rate >= filters.minRate!);
  }

  if (typeof filters.isAvailable === 'boolean') {
    filtered = filtered.filter(companion => companion.is_available === filters.isAvailable);
  }

  if (filters.languages?.length) {
    filtered = filtered.filter(companion => hasLanguageOverlap(companion.languages, filters.languages!));
  }

  if (filters.city?.trim()) {
    const cityQuery = filters.city.trim();
    filtered = filtered.filter(companion => containsCaseInsensitive(companion.user?.city || '', cityQuery));
  }

  return filtered;
}

/**
 * Fetch all active companions with optional filters.
 * Designed to be resilient across partially migrated production schemas.
 */
export async function fetchCompanions(
  filters?: CompanionFilters
): Promise<{ companions: CompanionData[]; error: Error | null }> {
  try {
    let applyActiveFilter = true;
    let applyRatingOrder = true;

    while (true) {
      let query = supabase
        .from('companions')
        .select(`
          *,
          user:profiles!companions_user_id_fkey(*)
        `);

      if (applyActiveFilter) {
        query = query.eq('is_active', true);
      }

      if (applyRatingOrder) {
        query = query.order('rating', { ascending: false });
      }

      const { data, error } = await query;

      if (!error) {
        const normalized = (data || []).map(item => normalizeCompanion(item));
        const verifiedCompanions = normalized.filter(isVerifiedCompanion);
        const filtered = applyCompanionFilters(verifiedCompanions, filters);

        if (!applyRatingOrder) {
          filtered.sort(sortByRatingAndReviews);
        }

        return { companions: filtered, error: null };
      }

      if (applyActiveFilter && isMissingColumnError(error, 'is_active')) {
        applyActiveFilter = false;
        continue;
      }

      if (applyRatingOrder && isMissingColumnError(error, 'rating')) {
        applyRatingOrder = false;
        continue;
      }

      console.error('Error fetching companions:', error);
      return { companions: [], error: new Error(error.message || 'Failed to fetch companions') };
    }
  } catch (err) {
    console.error('Error in fetchCompanions:', err);
    return {
      companions: [],
      error: err instanceof Error ? err : new Error('Failed to fetch companions'),
    };
  }
}

/**
 * Fetch a single companion by ID
 */
export async function fetchCompanionById(
  id: string
): Promise<{ companion: CompanionData | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('companions')
      .select(`
        *,
        user:profiles!companions_user_id_fkey(*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching companion:', error);
      return { companion: null, error: new Error(error.message || 'Failed to fetch companion') };
    }

    return {
      companion: data ? normalizeCompanion(data) : null,
      error: null,
    };
  } catch (err) {
    console.error('Error in fetchCompanionById:', err);
    return {
      companion: null,
      error: err instanceof Error ? err : new Error('Failed to fetch companion'),
    };
  }
}

/**
 * Fetch featured companions (top rated, available)
 */
export async function fetchFeaturedCompanions(
  limit = 5
): Promise<{ companions: CompanionData[]; error: Error | null }> {
  const { companions, error } = await fetchCompanions({
    isAvailable: true,
    minRating: 4.5,
  });

  if (error) {
    console.error('Error fetching featured companions:', error);
    return { companions: [], error };
  }

  return { companions: companions.slice(0, limit), error: null };
}

/**
 * Fetch nearby companions (by city)
 */
export async function fetchNearbyCompanions(
  city: string,
  limit = 10
): Promise<{ companions: CompanionData[]; error: Error | null }> {
  const { companions, error } = await fetchCompanions({ city });

  if (error) {
    console.error('Error fetching nearby companions:', error);
    return { companions: [], error };
  }

  return { companions: companions.slice(0, limit), error: null };
}

/**
 * Search companions by query.
 * Uses local filtering on normalized companion payload to avoid PostgREST embedded-search quirks.
 */
export async function searchCompanions(
  query: string
): Promise<{ companions: CompanionData[]; error: Error | null }> {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return fetchCompanions();
  }

  const { companions, error } = await fetchCompanions();
  if (error) {
    console.error('Error searching companions:', error);
    return { companions: [], error };
  }

  const filtered = companions.filter(companion => {
    const fullName = `${companion.user?.first_name || ''} ${companion.user?.last_name || ''}`.trim();
    const searchableText = [
      fullName,
      companion.user?.city || '',
      companion.about,
      companion.specialties.join(' '),
      companion.languages.join(' '),
    ].join(' ').toLowerCase();

    return searchableText.includes(trimmedQuery);
  });

  return { companions: filtered, error: null };
}

/**
 * Get companion reviews
 */
export async function fetchCompanionReviews(
  companionId: string
): Promise<{ reviews: any[]; error: Error | null }> {
  try {
    // Get the user_id for this companion
    const { data: companion, error: companionError } = await supabase
      .from('companions')
      .select('user_id')
      .eq('id', companionId)
      .maybeSingle();

    if (companionError || !companion?.user_id) {
      return {
        reviews: [],
        error: companionError ? new Error(companionError.message || 'Failed to fetch companion') : null,
      };
    }

    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        reviewer:profiles!reviews_reviewer_id_fkey(first_name, last_name, avatar_url)
      `)
      .eq('reviewee_id', companion.user_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      return { reviews: [], error: new Error(error.message || 'Failed to fetch reviews') };
    }

    return { reviews: data || [], error: null };
  } catch (err) {
    console.error('Error in fetchCompanionReviews:', err);
    return {
      reviews: [],
      error: err instanceof Error ? err : new Error('Failed to fetch reviews'),
    };
  }
}
