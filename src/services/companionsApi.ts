/**
 * Companions API Service
 *
 * Fetches companion data from Supabase.
 */

import { supabase } from './supabase';
import type { Companion } from '../types';

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

  return data.map((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      user: {
        id: profile?.id || row.user_id || row.id,
        firstName: profile?.first_name || '',
        lastName: profile?.last_name || '',
        email: profile?.email || '',
        avatar: profile?.avatar_url || undefined,
        isVerified: profile?.phone_verified || false,
        isPremium: (profile?.subscription_tier || 'free') !== 'free',
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
      verificationLevel: profile?.phone_verified ? 'verified' : 'basic',
    } as Companion;
  });
}
