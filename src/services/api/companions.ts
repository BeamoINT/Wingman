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

/**
 * Fetch all active companions with optional filters
 */
export async function fetchCompanions(filters?: CompanionFilters): Promise<{ companions: CompanionData[]; error: Error | null }> {
  try {
    let query = supabase
      .from('companions')
      .select(`
        *,
        user:profiles(*)
      `)
      .eq('is_active', true);

    if (filters?.specialty) {
      query = query.contains('specialties', [filters.specialty]);
    }

    if (filters?.minRating) {
      query = query.gte('rating', filters.minRating);
    }

    if (filters?.maxRate) {
      query = query.lte('hourly_rate', filters.maxRate);
    }

    if (filters?.minRate) {
      query = query.gte('hourly_rate', filters.minRate);
    }

    if (filters?.isAvailable !== undefined) {
      query = query.eq('is_available', filters.isAvailable);
    }

    if (filters?.languages && filters.languages.length > 0) {
      query = query.overlaps('languages', filters.languages);
    }

    const { data, error } = await query.order('rating', { ascending: false });

    if (error) {
      console.error('Error fetching companions:', error);
      return { companions: [], error };
    }

    return { companions: data || [], error: null };
  } catch (err) {
    console.error('Error in fetchCompanions:', err);
    return { companions: [], error: err as Error };
  }
}

/**
 * Fetch a single companion by ID
 */
export async function fetchCompanionById(id: string): Promise<{ companion: CompanionData | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('companions')
      .select(`
        *,
        user:profiles(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching companion:', error);
      return { companion: null, error };
    }

    return { companion: data, error: null };
  } catch (err) {
    console.error('Error in fetchCompanionById:', err);
    return { companion: null, error: err as Error };
  }
}

/**
 * Fetch featured companions (top rated, available)
 */
export async function fetchFeaturedCompanions(limit: number = 5): Promise<{ companions: CompanionData[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('companions')
      .select(`
        *,
        user:profiles(*)
      `)
      .eq('is_active', true)
      .eq('is_available', true)
      .gte('rating', 4.5)
      .order('rating', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching featured companions:', error);
      return { companions: [], error };
    }

    return { companions: data || [], error: null };
  } catch (err) {
    console.error('Error in fetchFeaturedCompanions:', err);
    return { companions: [], error: err as Error };
  }
}

/**
 * Fetch nearby companions (by city)
 */
export async function fetchNearbyCompanions(city: string, limit: number = 10): Promise<{ companions: CompanionData[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('companions')
      .select(`
        *,
        user:profiles!inner(*)
      `)
      .eq('is_active', true)
      .eq('user.city', city)
      .order('rating', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching nearby companions:', error);
      return { companions: [], error };
    }

    return { companions: data || [], error: null };
  } catch (err) {
    console.error('Error in fetchNearbyCompanions:', err);
    return { companions: [], error: err as Error };
  }
}

/**
 * Search companions by query
 */
export async function searchCompanions(query: string): Promise<{ companions: CompanionData[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('companions')
      .select(`
        *,
        user:profiles(*)
      `)
      .eq('is_active', true)
      .or(`about.ilike.%${query}%,user.first_name.ilike.%${query}%,user.last_name.ilike.%${query}%`)
      .order('rating', { ascending: false });

    if (error) {
      console.error('Error searching companions:', error);
      return { companions: [], error };
    }

    return { companions: data || [], error: null };
  } catch (err) {
    console.error('Error in searchCompanions:', err);
    return { companions: [], error: err as Error };
  }
}

/**
 * Get companion reviews
 */
export async function fetchCompanionReviews(companionId: string): Promise<{ reviews: any[]; error: Error | null }> {
  try {
    // Get the user_id for this companion
    const { data: companion, error: companionError } = await supabase
      .from('companions')
      .select('user_id')
      .eq('id', companionId)
      .single();

    if (companionError || !companion) {
      return { reviews: [], error: companionError };
    }

    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        reviewer:profiles!reviewer_id(first_name, last_name, avatar_url)
      `)
      .eq('reviewee_id', companion.user_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      return { reviews: [], error };
    }

    return { reviews: data || [], error: null };
  } catch (err) {
    console.error('Error in fetchCompanionReviews:', err);
    return { reviews: [], error: err as Error };
  }
}
