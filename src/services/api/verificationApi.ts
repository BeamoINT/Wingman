/**
 * Verification API Service
 *
 * Handles all verification-related database operations including:
 * - Verification events (history)
 *
 * NOTE: Background checks have been removed from the platform.
 */

import type {
    IdVerificationStatus,
    VerificationEvent,
    VerificationLevel,
    VerificationStatusResponse
} from '../../types/verification';
import { supabase } from '../supabase';
import {
  getDaysUntilIdVerificationExpiry,
  isIdVerificationActive,
  normalizeIdVerificationStatus,
} from '../../utils/idVerification';

type QueryError = {
  code?: string | null;
  message?: string | null;
};

type FunctionsErrorLike = {
  message?: string;
  context?: Response;
};

type CreateIdVerificationSessionResponse = {
  sessionId?: string;
  url?: string;
  status?: string;
  error?: string;
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

function extractMissingProfileColumn(error: QueryError | null | undefined): string | null {
  const message = String(error?.message || '');

  const directColumnMatch = message.match(/column\s+([a-zA-Z0-9_]+)\s+does not exist/i);
  if (directColumnMatch?.[1]) {
    return directColumnMatch[1];
  }

  const scopedColumnMatch = message.match(/column\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s+does not exist/i);
  if (scopedColumnMatch?.[2]) {
    return scopedColumnMatch[2];
  }

  return null;
}

async function extractFunctionError(
  error: FunctionsErrorLike | null
): Promise<{ status: number | null; message: string | null }> {
  if (!error) {
    return { status: null, message: null };
  }

  const response = error.context;
  if (!response) {
    return { status: null, message: error.message || null };
  }

  const status = typeof response.status === 'number' ? response.status : null;

  try {
    const payload = await response.clone().json() as Record<string, unknown>;
    const payloadMessage = typeof payload.message === 'string'
      ? payload.message
      : typeof payload.error === 'string'
        ? payload.error
        : null;
    return { status, message: payloadMessage || error.message || null };
  } catch {
    return { status, message: error.message || null };
  }
}

async function getCurrentAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      return null;
    }
    return data.session?.access_token || null;
  } catch {
    return null;
  }
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

export async function createIdVerificationSession(): Promise<{
  sessionId: string | null;
  url: string | null;
  status: IdVerificationStatus | null;
  error: string | null;
}> {
  const invoke = async (accessToken: string | null) => {
    const headers = accessToken
      ? {
        'x-session-token': accessToken,
        Authorization: `Bearer ${accessToken}`,
      }
      : undefined;
    return supabase.functions.invoke<CreateIdVerificationSessionResponse>(
      'create-id-verification-session',
      {
        body: accessToken ? { accessToken } : {},
        headers,
      }
    );
  };

  let accessToken = await getCurrentAccessToken();
  if (!accessToken) {
    accessToken = await refreshAccessToken();
  }

  let { data, error } = await invoke(accessToken);

  if (!error && data?.url && data?.sessionId) {
    return {
      sessionId: data.sessionId,
      url: data.url,
      status: normalizeIdVerificationStatus(data.status),
      error: null,
    };
  }

  if (data?.error) {
    return { sessionId: null, url: null, status: null, error: data.error };
  }

  let parsedError = await extractFunctionError(error as FunctionsErrorLike | null);

  if (parsedError.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      const retryResult = await invoke(refreshedToken);
      data = retryResult.data;
      error = retryResult.error;

      if (!error && data?.url && data?.sessionId) {
        return {
          sessionId: data.sessionId,
          url: data.url,
          status: normalizeIdVerificationStatus(data.status),
          error: null,
        };
      }

      if (data?.error) {
        return { sessionId: null, url: null, status: null, error: data.error };
      }

      parsedError = await extractFunctionError(error as FunctionsErrorLike | null);
    }
  }

  if (parsedError.status === 404) {
    return {
      sessionId: null,
      url: null,
      status: null,
      error: 'ID verification service is not deployed yet. Please deploy create-id-verification-session.',
    };
  }

  if (parsedError.status === 401) {
    const parsedMessage = String(parsedError.message || '').toLowerCase();
    if (
      parsedMessage.includes('missing authorization header')
      || parsedMessage.includes('invalid jwt')
      || parsedMessage.includes('authentication required')
    ) {
      return {
        sessionId: null,
        url: null,
        status: null,
        error: 'Unable to authenticate verification request. Please wait a moment and try again.',
      };
    }

    return {
      sessionId: null,
      url: null,
      status: null,
      error: 'Your session expired. Please sign in again and retry verification.',
    };
  }

  return {
    sessionId: null,
    url: null,
    status: null,
    error: parsedError.message || 'Unable to start ID verification right now.',
  };
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
    const selectableColumns = [
      'verification_level',
      'email_verified',
      'phone_verified',
      'id_verified',
      'id_verified_at',
      'id_verification_status',
      'id_verification_expires_at',
      'id_verification_failure_code',
      'id_verification_failure_message',
    ];

    while (selectableColumns.length > 0) {
      const { data, error } = await supabase
        .from('profiles')
        .select(selectableColumns.join(','))
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116') {
          return getDefaultVerificationStatus(authEmailVerified);
        }

        if (isMissingProfileColumnError(error)) {
          const missingColumn = extractMissingProfileColumn(error);
          if (missingColumn) {
            const index = selectableColumns.indexOf(missingColumn);
            if (index !== -1) {
              selectableColumns.splice(index, 1);
              continue;
            }
          }
        }

        console.error('Error fetching verification status:', error);
        return getDefaultVerificationStatus(authEmailVerified);
      }

      const profile = (data || {}) as unknown as Record<string, unknown>;
      const storedLevel = (profile.verification_level as VerificationLevel) || 'basic';
      const emailVerified = authEmailVerified || profile.email_verified === true;
      const phoneVerified = profile.phone_verified === true;
      const profileIdVerified = profile.id_verified === true;
      const hasExpiryColumn = Object.prototype.hasOwnProperty.call(profile, 'id_verification_expires_at');
      const idVerificationExpiresAt = typeof profile.id_verification_expires_at === 'string'
        ? profile.id_verification_expires_at
        : null;
      const daysUntilExpiry = getDaysUntilIdVerificationExpiry(idVerificationExpiresAt);

      const normalizedStatus = normalizeIdVerificationStatus(
        profile.id_verification_status || (profileIdVerified ? 'verified' : 'unverified')
      );

      const idVerified = hasExpiryColumn
        ? isIdVerificationActive({
          id_verified: profileIdVerified,
          id_verification_status: normalizedStatus,
          id_verification_expires_at: idVerificationExpiresAt,
        })
        : profileIdVerified;

      const idVerificationStatus: IdVerificationStatus = (
        !idVerified
        && normalizedStatus === 'verified'
        && typeof daysUntilExpiry === 'number'
        && daysUntilExpiry < 0
      )
        ? 'expired'
        : normalizedStatus;

      const verificationLevel: VerificationLevel = idVerified
        ? (storedLevel === 'premium' ? 'premium' : 'verified')
        : 'basic';

      return {
        emailVerified,
        phoneVerified,
        idVerified,
        idVerificationStatus,
        idVerificationFailureCode: typeof profile.id_verification_failure_code === 'string'
          ? profile.id_verification_failure_code
          : null,
        idVerificationFailureMessage: typeof profile.id_verification_failure_message === 'string'
          ? profile.id_verification_failure_message
          : null,
        idVerificationExpiresAt,
        idVerifiedAt: typeof profile.id_verified_at === 'string' ? profile.id_verified_at : null,
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
    idVerificationStatus: 'unverified',
    idVerificationFailureCode: null,
    idVerificationFailureMessage: null,
    idVerificationExpiresAt: null,
    idVerifiedAt: null,
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
    idVerificationStatus?: IdVerificationStatus;
    idVerificationFailureCode?: string | null;
    idVerificationFailureMessage?: string | null;
    idVerificationExpiresAt?: string | null;
    idVerifiedAt?: string | null;
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
          idVerificationStatus: normalizeIdVerificationStatus(newData.id_verification_status),
          idVerificationFailureCode: typeof newData.id_verification_failure_code === 'string'
            ? newData.id_verification_failure_code
            : null,
          idVerificationFailureMessage: typeof newData.id_verification_failure_message === 'string'
            ? newData.id_verification_failure_message
            : null,
          idVerificationExpiresAt: typeof newData.id_verification_expires_at === 'string'
            ? newData.id_verification_expires_at
            : null,
          idVerifiedAt: typeof newData.id_verified_at === 'string' ? newData.id_verified_at : null,
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
