/**
 * Verification API Service
 *
 * Handles all verification-related database operations including:
 * - Verification events (history)
 *
 * NOTE: Background checks have been removed from the platform.
 */

import type {
    VerificationEvent,
    VerificationLevel, VerificationStatusResponse
} from '../../types/verification';
import { supabase } from '../supabase';

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
 * Returns default values if columns don't exist (for development).
 */
export async function getVerificationStatus(userId: string): Promise<VerificationStatusResponse | null> {
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const authEmailVerified = !!authUser?.email_confirmed_at;

    const selectCandidates = [
      'verification_level,email_verified,phone_verified,id_verified',
      'verification_level,phone_verified,id_verified',
      'verification_level,email_verified,id_verified',
      'verification_level,email_verified,phone_verified',
      'verification_level,id_verified',
      'verification_level',
    ];

    for (const columns of selectCandidates) {
      const { data, error } = await supabase
        .from('profiles')
        .select(columns)
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === '42703') {
          continue;
        }

        if (error.code === '42P01' || error.code === 'PGRST116') {
          return getDefaultVerificationStatus(authEmailVerified);
        }

        console.error('Error fetching verification status:', error);
        return getDefaultVerificationStatus(authEmailVerified);
      }

      const profile = (data || {}) as unknown as Record<string, unknown>;
      const verificationLevel = (profile.verification_level as VerificationLevel) || 'basic';
      const idVerified =
        verificationLevel === 'verified'
        || verificationLevel === 'premium'
        || !!profile.id_verified;

      return {
        emailVerified: authEmailVerified || !!profile.email_verified,
        phoneVerified: !!profile.phone_verified,
        idVerified,
        verificationLevel,
      };
    }

    return getDefaultVerificationStatus(authEmailVerified);
  } catch (err) {
    console.error('Error fetching verification status:', err);
    return getDefaultVerificationStatus();
  }
}

/**
 * Get default verification status (used when DB not available)
 */
function getDefaultVerificationStatus(emailVerified = false): VerificationStatusResponse {
  return {
    emailVerified,
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
  callback: (data: {
    verificationLevel: VerificationLevel;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    idVerified?: boolean;
  }) => void
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
          emailVerified: typeof newData.email_verified === 'boolean' ? newData.email_verified : undefined,
          phoneVerified: typeof newData.phone_verified === 'boolean' ? newData.phone_verified : undefined,
          idVerified: typeof newData.id_verified === 'boolean' ? newData.id_verified : undefined,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
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
