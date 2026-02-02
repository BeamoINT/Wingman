/**
 * Verification API Service
 *
 * Handles all verification-related database operations including:
 * - Verification preferences
 * - Verification events (history)
 *
 * NOTE: Background checks have been removed from the platform.
 */

import { supabase } from '../supabase';
import type {
  VerificationPreferences,
  VerificationEvent,
  VerificationLevel,
  VerificationStatusResponse,
} from '../../types/verification';

// ===========================================
// Verification Preferences Operations
// ===========================================

/**
 * Get verification preferences for a user
 * Returns default values if table doesn't exist (for development)
 */
export async function getVerificationPreferences(userId: string): Promise<VerificationPreferences | null> {
  try {
    const { data, error } = await supabase
      .from('verification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Handle missing table or no row found
    if (error) {
      if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.code === '42P01') {
        // Table doesn't exist or no row - return defaults
        return getDefaultVerificationPreferences(userId);
      }
      console.error('Error fetching verification preferences:', error);
      return getDefaultVerificationPreferences(userId);
    }

    if (!data) return getDefaultVerificationPreferences(userId);

    return transformVerificationPreferences(data);
  } catch (err) {
    console.error('Error fetching verification preferences:', err);
    return getDefaultVerificationPreferences(userId);
  }
}

/**
 * Get default verification preferences (used when DB not available)
 */
function getDefaultVerificationPreferences(userId: string): VerificationPreferences {
  return {
    id: 'default',
    userId,
    requireIdVerified: false,
    requirePremiumVerified: false,
    showVerificationBadges: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create or update verification preferences for a user
 */
export async function upsertVerificationPreferences(
  userId: string,
  preferences: Partial<Omit<VerificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<VerificationPreferences | null> {
  const { data, error } = await supabase
    .from('verification_preferences')
    .upsert({
      user_id: userId,
      require_id_verified: preferences.requireIdVerified,
      require_premium_verified: preferences.requirePremiumVerified,
      show_verification_badges: preferences.showVerificationBadges,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting verification preferences:', error);
    return null;
  }

  return transformVerificationPreferences(data);
}

// ===========================================
// Verification Events Operations
// ===========================================

/**
 * Get verification events (history) for a user
 */
export async function getVerificationEvents(
  userId: string,
  limit = 50
): Promise<VerificationEvent[]> {
  const { data, error } = await supabase
    .from('verification_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching verification events:', error);
    return [];
  }

  return (data || []).map(transformVerificationEvent);
}

/**
 * Log a new verification event
 */
export async function logVerificationEvent(
  userId: string,
  eventType: string,
  eventStatus: 'success' | 'failed' | 'pending',
  eventData?: Record<string, unknown>
): Promise<VerificationEvent | null> {
  const { data, error } = await supabase
    .from('verification_events')
    .insert({
      user_id: userId,
      event_type: eventType,
      event_status: eventStatus,
      event_data: eventData,
    })
    .select()
    .single();

  if (error) {
    console.error('Error logging verification event:', error);
    return null;
  }

  return transformVerificationEvent(data);
}

// ===========================================
// Profile Verification Status
// ===========================================

/**
 * Get verification status from user profile
 * Returns default values if columns don't exist (for development)
 */
export async function getVerificationStatus(userId: string): Promise<VerificationStatusResponse | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        verification_level
      `)
      .eq('id', userId)
      .single();

    // Handle missing table/columns - return defaults
    if (error) {
      if (error.code === '42703' || error.code === '42P01' || error.code === 'PGRST116') {
        return getDefaultVerificationStatus();
      }
      console.error('Error fetching verification status:', error);
      return getDefaultVerificationStatus();
    }

    return {
      emailVerified: false, // Will be determined by auth provider
      phoneVerified: false,
      idVerified: false,
      verificationLevel: (data?.verification_level as VerificationLevel) || 'basic',
    };
  } catch (err) {
    console.error('Error fetching verification status:', err);
    return getDefaultVerificationStatus();
  }
}

/**
 * Get default verification status (used when DB not available)
 */
function getDefaultVerificationStatus(): VerificationStatusResponse {
  return {
    emailVerified: false,
    phoneVerified: false,
    idVerified: false,
    verificationLevel: 'basic',
  };
}

// ===========================================
// Realtime Subscriptions
// ===========================================

/**
 * Subscribe to profile verification updates
 */
export function subscribeToVerificationUpdates(
  userId: string,
  callback: (data: { verificationLevel: VerificationLevel }) => void
) {
  const channel = supabase
    .channel(`verification:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload: { new: Record<string, unknown> }) => {
        const newData = payload.new;
        callback({
          verificationLevel: (newData.verification_level as VerificationLevel) || 'basic',
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ===========================================
// Transform Functions (DB -> TypeScript)
// ===========================================

function transformVerificationPreferences(data: Record<string, unknown>): VerificationPreferences {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    requireIdVerified: data.require_id_verified as boolean,
    requirePremiumVerified: data.require_premium_verified as boolean,
    showVerificationBadges: data.show_verification_badges as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

function transformVerificationEvent(data: Record<string, unknown>): VerificationEvent {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    eventType: data.event_type as VerificationEvent['eventType'],
    eventStatus: data.event_status as VerificationEvent['eventStatus'],
    eventData: data.event_data as Record<string, unknown> | undefined,
    createdAt: data.created_at as string,
  };
}
