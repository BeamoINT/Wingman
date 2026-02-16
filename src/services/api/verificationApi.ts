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

type QueryError = {
  code?: string | null;
  message?: string | null;
};

type DerivedVerificationSnapshot = {
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  idVerifiedAt: string | null;
  createdAt: string | null;
};

let verificationEventsTableMissing = false;

function isMissingVerificationEventsTableError(error: unknown): boolean {
  const typedError = error as QueryError | null | undefined;
  const code = String(typedError?.code || '');
  const message = String(typedError?.message || '').toLowerCase();

  if (code === '42P01') {
    return true;
  }

  if (code === 'PGRST205') {
    return message.includes('verification_events');
  }

  return false;
}

function sortEventsByCreatedAtDesc(events: VerificationEvent[]): VerificationEvent[] {
  return [...events].sort((a, b) => (
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ));
}

function createDefaultDerivedVerificationSnapshot(): DerivedVerificationSnapshot {
  return {
    emailVerified: false,
    phoneVerified: false,
    idVerified: false,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    idVerifiedAt: null,
    createdAt: null,
  };
}

function isMissingProfileColumnError(error: QueryError | null | undefined): boolean {
  return String(error?.code || '') === '42703';
}

async function getAuthEmailConfirmedAt(userId: string): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.id === userId && typeof session.user.email_confirmed_at === 'string') {
      return session.user.email_confirmed_at;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id === userId && typeof user.email_confirmed_at === 'string') {
      return user.email_confirmed_at;
    }
  } catch (error) {
    console.error('Error loading auth email verification state:', error);
  }

  return null;
}

async function getProfileVerificationTimestamp(
  userId: string,
  column: 'email_verified_at' | 'phone_verified_at' | 'id_verified_at'
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(column)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (
      isMissingProfileColumnError(error)
      || error.code === 'PGRST116'
      || error.code === '42P01'
    ) {
      return null;
    }

    console.error(`Error fetching profile ${column}:`, error);
    return null;
  }

  const profile = (data || {}) as Record<string, unknown>;
  return typeof profile[column] === 'string' ? profile[column] : null;
}

async function getProfileVerificationSnapshot(userId: string): Promise<DerivedVerificationSnapshot> {
  const snapshot = createDefaultDerivedVerificationSnapshot();
  const selectCandidates = [
    'email_verified,phone_verified,id_verified,created_at',
    'phone_verified,id_verified,created_at',
    'email_verified,id_verified,created_at',
    'email_verified,phone_verified,created_at',
    'id_verified,created_at',
    'created_at',
  ];

  for (const columns of selectCandidates) {
    const { data, error } = await supabase
      .from('profiles')
      .select(columns)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      if (isMissingProfileColumnError(error)) {
        continue;
      }

      if (error.code === 'PGRST116' || error.code === '42P01') {
        return snapshot;
      }

      console.error('Error deriving verification history from profile:', error);
      return snapshot;
    }

    const profile = (data || {}) as Record<string, unknown>;
    snapshot.emailVerified = profile.email_verified === true;
    snapshot.phoneVerified = profile.phone_verified === true;
    snapshot.idVerified = profile.id_verified === true;
    snapshot.createdAt = typeof profile.created_at === 'string' ? profile.created_at : null;
    break;
  }

  const [emailVerifiedAt, phoneVerifiedAt, idVerifiedAt] = await Promise.all([
    getProfileVerificationTimestamp(userId, 'email_verified_at'),
    getProfileVerificationTimestamp(userId, 'phone_verified_at'),
    getProfileVerificationTimestamp(userId, 'id_verified_at'),
  ]);

  snapshot.emailVerifiedAt = emailVerifiedAt;
  snapshot.phoneVerifiedAt = phoneVerifiedAt;
  snapshot.idVerifiedAt = idVerifiedAt;

  return snapshot;
}

async function getDerivedVerificationEvents(userId: string): Promise<VerificationEvent[]> {
  try {
    const [authEmailConfirmedAt, profile] = await Promise.all([
      getAuthEmailConfirmedAt(userId),
      getProfileVerificationSnapshot(userId),
    ]);

    const fallbackTimestamp = (
      profile.createdAt
      || authEmailConfirmedAt
      || new Date().toISOString()
    );

    const emailVerified = !!authEmailConfirmedAt || profile.emailVerified;
    const phoneVerified = profile.phoneVerified;
    const idVerified = profile.idVerified;

    const events: VerificationEvent[] = [];

    if (emailVerified) {
      events.push({
        id: `derived-email-${userId}`,
        userId,
        eventType: 'email_verified',
        eventStatus: 'success',
        eventData: { source: 'derived_profile_state' },
        createdAt: (
          profile.emailVerifiedAt
          || authEmailConfirmedAt
          || fallbackTimestamp
        ),
      });
    }

    if (phoneVerified) {
      events.push({
        id: `derived-phone-${userId}`,
        userId,
        eventType: 'phone_verified',
        eventStatus: 'success',
        eventData: { source: 'derived_profile_state' },
        createdAt: (
          profile.phoneVerifiedAt
          || fallbackTimestamp
        ),
      });
    }

    if (idVerified) {
      events.push({
        id: `derived-id-${userId}`,
        userId,
        eventType: 'id_verified',
        eventStatus: 'success',
        eventData: { source: 'derived_profile_state' },
        createdAt: (
          profile.idVerifiedAt
          || fallbackTimestamp
        ),
      });
    }

    return sortEventsByCreatedAtDesc(events);
  } catch (error) {
    console.error('Error deriving verification events:', error);
    return [];
  }
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
  if (verificationEventsTableMissing) {
    return getDerivedVerificationEvents(userId);
  }

  const { data, error } = await supabase
    .from('verification_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingVerificationEventsTableError(error)) {
      verificationEventsTableMissing = true;
      return getDerivedVerificationEvents(userId);
    }

    console.error('Error fetching verification events:', error);
    return getDerivedVerificationEvents(userId);
  }

  verificationEventsTableMissing = false;
  const transformed = (data || []).map(transformVerificationEvent);
  if (transformed.length > 0) {
    return transformed;
  }

  // If table exists but has no rows for this user yet, show a derived timeline.
  return getDerivedVerificationEvents(userId);
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
  if (verificationEventsTableMissing) {
    return null;
  }

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
    if (isMissingVerificationEventsTableError(error)) {
      verificationEventsTableMissing = true;
      return null;
    }

    console.error('Error logging verification event:', error);
    return null;
  }

  verificationEventsTableMissing = false;
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
    const authEmailVerified = !!(await getAuthEmailConfirmedAt(userId));

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
      const storedLevel = (profile.verification_level as VerificationLevel) || 'basic';
      const emailVerified = authEmailVerified || profile.email_verified === true;
      const phoneVerified = profile.phone_verified === true;
      const idVerified = profile.id_verified === true;

      const verificationLevel: VerificationLevel = idVerified
        ? (storedLevel === 'premium' ? 'premium' : 'verified')
        : 'basic';

      return {
        emailVerified,
        phoneVerified,
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
