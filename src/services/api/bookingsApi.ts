/**
 * Bookings API Service
 * Handles booking-related operations with Supabase
 */

import { supabase } from '../supabase';
import type { CompanionData } from './companions';
import type { ProfileData } from './profiles';

type QueryError = {
  code?: string | null;
  message?: string | null;
};

type BookingStatusRaw =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export interface BookingData {
  id: string;
  client_id: string;
  companion_id: string;
  status: BookingStatusRaw;
  date: string;
  start_time: string;
  end_time?: string;
  duration_hours: number;
  hourly_rate: number;
  subtotal: number;
  service_fee: number;
  total_price: number;
  location_name?: string;
  location_address?: string;
  activity_type?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  companion?: CompanionData;
  client?: ProfileData;
}

export interface CreateBookingInput {
  companion_id: string;
  date: string;
  start_time: string;
  duration_hours: number;
  hourly_rate: number;
  location_name?: string;
  location_address?: string;
  activity_type?: string;
  notes?: string;
}

const BOOKING_SELECT_WITH_RELATIONS = `
  *,
  companion:companions(
    *,
    user:profiles!companions_user_id_fkey(*)
  ),
  client:profiles!bookings_client_id_fkey(*)
`;

const BOOKING_SELECT_BASE = `*`;

const BOOKING_OWNER_COLUMNS = [
  'client_id',
  'user_id',
  'booker_id',
  'requester_id',
  'profile_id',
] as const;

const BOOKING_COMPANION_COLUMNS = [
  'companion_id',
  'provider_id',
] as const;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function normalizeStatus(value: unknown): BookingStatusRaw {
  const normalized = String(value || 'pending')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');

  switch (normalized) {
    case 'pending':
    case 'confirmed':
    case 'in_progress':
    case 'completed':
    case 'cancelled':
    case 'disputed':
      return normalized;
    default:
      return 'pending';
  }
}

function isMissingColumnError(error: unknown, table: string, column?: string): boolean {
  const typedError = error as QueryError | null | undefined;
  if (typedError?.code !== '42703') return false;

  const message = String(typedError.message || '').toLowerCase();
  if (column) {
    return (
      message.includes(`column ${table}.${column}`.toLowerCase()) ||
      message.includes(`column ${column}`.toLowerCase())
    );
  }

  return message.includes(`column ${table}.`);
}

function extractMissingColumn(error: unknown): string | null {
  const typedError = error as QueryError | null | undefined;
  if (typedError?.code !== '42703') return null;

  const message = String(typedError.message || '');
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

function isRelationshipError(error: unknown): boolean {
  const typedError = error as QueryError | null | undefined;
  const message = String(typedError?.message || '').toLowerCase();
  return (
    String(typedError?.code || '').startsWith('PGRST') &&
    (message.includes('relationship') || message.includes('foreign key'))
  );
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

function normalizeCompanion(rawCompanion: unknown): CompanionData | undefined {
  const companionObject = Array.isArray(rawCompanion) ? rawCompanion[0] : rawCompanion;
  if (!companionObject || typeof companionObject !== 'object') {
    return undefined;
  }

  const companion = companionObject as Record<string, unknown>;
  const now = new Date().toISOString();

  return {
    id: typeof companion.id === 'string' ? companion.id : '',
    user_id: typeof companion.user_id === 'string' ? companion.user_id : '',
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
      : 'Usually responds within 1 hour',
    created_at: typeof companion.created_at === 'string' ? companion.created_at : now,
    updated_at: typeof companion.updated_at === 'string' ? companion.updated_at : now,
    user: normalizeProfile(companion.user),
  };
}

function normalizeBooking(rawBooking: unknown): BookingData {
  const booking = (rawBooking || {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const hourlyRate = toNumber(booking.hourly_rate, 0);
  const duration = Math.max(0, Math.round(toNumber(booking.duration_hours, 0)));
  const subtotal = toNumber(booking.subtotal, hourlyRate * duration);
  const serviceFee = toNumber(booking.service_fee, 0);
  const totalPrice = toNumber(booking.total_price, subtotal + serviceFee);

  const companionId =
    typeof booking.companion_id === 'string'
      ? booking.companion_id
      : typeof booking.provider_id === 'string'
        ? (booking.provider_id as string)
        : '';

  const clientId =
    typeof booking.client_id === 'string'
      ? booking.client_id
      : typeof booking.user_id === 'string'
        ? (booking.user_id as string)
        : typeof booking.booker_id === 'string'
          ? (booking.booker_id as string)
          : typeof booking.requester_id === 'string'
            ? (booking.requester_id as string)
            : typeof booking.profile_id === 'string'
              ? (booking.profile_id as string)
              : '';

  return {
    id: typeof booking.id === 'string' ? booking.id : '',
    client_id: clientId,
    companion_id: companionId,
    status: normalizeStatus(booking.status),
    date: typeof booking.date === 'string' ? booking.date : now.split('T')[0],
    start_time: typeof booking.start_time === 'string' ? booking.start_time : '00:00:00',
    end_time: typeof booking.end_time === 'string' ? booking.end_time : undefined,
    duration_hours: duration,
    hourly_rate: hourlyRate,
    subtotal,
    service_fee: serviceFee,
    total_price: totalPrice,
    location_name: typeof booking.location_name === 'string' ? booking.location_name : undefined,
    location_address: typeof booking.location_address === 'string' ? booking.location_address : undefined,
    activity_type: typeof booking.activity_type === 'string' ? booking.activity_type : undefined,
    notes: typeof booking.notes === 'string' ? booking.notes : undefined,
    created_at: typeof booking.created_at === 'string' ? booking.created_at : now,
    updated_at: typeof booking.updated_at === 'string' ? booking.updated_at : now,
    companion: normalizeCompanion(booking.companion),
    client: normalizeProfile(booking.client),
  };
}

async function queryBookingsWithOwnerColumn(
  userId: string,
  ownerColumn: string,
  includeRelations: boolean
) {
  let query = supabase
    .from('bookings')
    .select(includeRelations ? BOOKING_SELECT_WITH_RELATIONS : BOOKING_SELECT_BASE)
    .eq(ownerColumn, userId);

  query = query.order('date', { ascending: false });
  return query;
}

async function queryBookingsByCompanionColumn(
  companionId: string,
  companionColumn: string,
  includeRelations: boolean
) {
  let query = supabase
    .from('bookings')
    .select(includeRelations ? BOOKING_SELECT_WITH_RELATIONS : BOOKING_SELECT_BASE)
    .eq(companionColumn, companionId);

  query = query.order('date', { ascending: false });
  return query;
}

/**
 * Create a new booking
 */
export async function createBooking(
  input: CreateBookingInput
): Promise<{ booking: BookingData | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { booking: null, error: new Error('Not authenticated') };
    }

    const subtotal = input.hourly_rate * input.duration_hours;
    const serviceFee = Math.round(subtotal * 0.1 * 100) / 100; // 10% service fee
    const totalPrice = subtotal + serviceFee;

    for (const ownerColumn of BOOKING_OWNER_COLUMNS) {
      for (const companionColumn of BOOKING_COMPANION_COLUMNS) {
        const payload: Record<string, unknown> = {
          [ownerColumn]: user.id,
          [companionColumn]: input.companion_id,
          date: input.date,
          start_time: input.start_time,
          duration_hours: input.duration_hours,
          hourly_rate: input.hourly_rate,
          subtotal,
          service_fee: serviceFee,
          total_price: totalPrice,
          location_name: input.location_name,
          location_address: input.location_address,
          activity_type: input.activity_type,
          notes: input.notes,
          status: 'pending',
        };

        let attempts = 0;
        while (attempts < 12) {
          attempts += 1;

          const { data, error } = await supabase
            .from('bookings')
            .insert(payload)
            .select(BOOKING_SELECT_BASE)
            .maybeSingle();

          if (!error) {
            return { booking: data ? normalizeBooking(data) : null, error: null };
          }

          if (isMissingColumnError(error, 'bookings', ownerColumn)) {
            break;
          }

          if (isMissingColumnError(error, 'bookings', companionColumn)) {
            break;
          }

          const missingColumn = extractMissingColumn(error);
          if (missingColumn && missingColumn in payload) {
            delete payload[missingColumn];
            continue;
          }

          console.error('Error creating booking:', error);
          return { booking: null, error: new Error(error.message || 'Failed to create booking') };
        }
      }
    }

    return { booking: null, error: new Error('Unable to create booking with current schema') };
  } catch (err) {
    console.error('Error in createBooking:', err);
    return {
      booking: null,
      error: err instanceof Error ? err : new Error('Failed to create booking'),
    };
  }
}

/**
 * Fetch bookings for the current user (as client/booker)
 */
export async function fetchUserBookings(): Promise<{ bookings: BookingData[]; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { bookings: [], error: new Error('Not authenticated') };
    }

    for (const includeRelations of [true, false]) {
      for (const ownerColumn of BOOKING_OWNER_COLUMNS) {
        const { data, error } = await queryBookingsWithOwnerColumn(user.id, ownerColumn, includeRelations);

        if (!error) {
          return { bookings: (data || []).map(item => normalizeBooking(item)), error: null };
        }

        if (isMissingColumnError(error, 'bookings', ownerColumn)) {
          continue;
        }

        if (includeRelations && isRelationshipError(error)) {
          break;
        }

        console.error('Error fetching user bookings:', error);
        return { bookings: [], error: new Error(error.message || 'Failed to fetch bookings') };
      }
    }

    return { bookings: [], error: new Error('No supported owner column found for bookings') };
  } catch (err) {
    console.error('Error in fetchUserBookings:', err);
    return {
      bookings: [],
      error: err instanceof Error ? err : new Error('Failed to fetch bookings'),
    };
  }
}

/**
 * Fetch bookings for the current user (as companion)
 */
export async function fetchCompanionBookings(): Promise<{ bookings: BookingData[]; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { bookings: [], error: new Error('Not authenticated') };
    }

    // Get companion id for this user
    const { data: companion, error: companionError } = await supabase
      .from('companions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (companionError || !companion?.id) {
      return {
        bookings: [],
        error: companionError
          ? new Error(companionError.message || 'Failed to fetch companion profile')
          : new Error('Companion profile not found'),
      };
    }

    for (const includeRelations of [true, false]) {
      for (const companionColumn of BOOKING_COMPANION_COLUMNS) {
        const { data, error } = await queryBookingsByCompanionColumn(companion.id, companionColumn, includeRelations);

        if (!error) {
          return { bookings: (data || []).map(item => normalizeBooking(item)), error: null };
        }

        if (isMissingColumnError(error, 'bookings', companionColumn)) {
          continue;
        }

        if (includeRelations && isRelationshipError(error)) {
          break;
        }

        console.error('Error fetching companion bookings:', error);
        return { bookings: [], error: new Error(error.message || 'Failed to fetch bookings') };
      }
    }

    return { bookings: [], error: new Error('No supported companion column found for bookings') };
  } catch (err) {
    console.error('Error in fetchCompanionBookings:', err);
    return {
      bookings: [],
      error: err instanceof Error ? err : new Error('Failed to fetch companion bookings'),
    };
  }
}

/**
 * Get a single booking by ID
 */
export async function fetchBookingById(
  bookingId: string
): Promise<{ booking: BookingData | null; error: Error | null }> {
  try {
    for (const includeRelations of [true, false]) {
      const { data, error } = await supabase
        .from('bookings')
        .select(includeRelations ? BOOKING_SELECT_WITH_RELATIONS : BOOKING_SELECT_BASE)
        .eq('id', bookingId)
        .maybeSingle();

      if (!error) {
        return { booking: data ? normalizeBooking(data) : null, error: null };
      }

      if (includeRelations && isRelationshipError(error)) {
        continue;
      }

      console.error('Error fetching booking:', error);
      return { booking: null, error: new Error(error.message || 'Failed to fetch booking') };
    }

    return { booking: null, error: new Error('Unable to fetch booking details') };
  } catch (err) {
    console.error('Error in fetchBookingById:', err);
    return {
      booking: null,
      error: err instanceof Error ? err : new Error('Failed to fetch booking'),
    };
  }
}

/**
 * Update booking status
 */
export async function updateBookingStatus(
  bookingId: string,
  status: BookingData['status']
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const updates: Array<Record<string, unknown>> = [
      { status, updated_at: new Date().toISOString() },
      { status },
    ];

    for (const payload of updates) {
      const { error } = await supabase
        .from('bookings')
        .update(payload)
        .eq('id', bookingId);

      if (!error) {
        return { success: true, error: null };
      }

      const missingColumn = extractMissingColumn(error);
      if (missingColumn && missingColumn in payload) {
        continue;
      }

      console.error('Error updating booking status:', error);
      return { success: false, error: new Error(error.message || 'Failed to update booking') };
    }

    return { success: false, error: new Error('Unable to update booking with current schema') };
  } catch (err) {
    console.error('Error in updateBookingStatus:', err);
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to update booking'),
    };
  }
}

/**
 * Cancel a booking
 */
export async function cancelBooking(
  bookingId: string,
  reason?: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: new Error('Not authenticated') };
    }

    const now = new Date().toISOString();
    const payloadVariants: Array<Record<string, unknown>> = [
      {
        status: 'cancelled',
        cancelled_at: now,
        cancelled_by: user.id,
        cancellation_reason: reason,
        updated_at: now,
      },
      {
        status: 'cancelled',
        cancellation_reason: reason,
        updated_at: now,
      },
      {
        status: 'cancelled',
        updated_at: now,
      },
      {
        status: 'cancelled',
      },
    ];

    for (const payload of payloadVariants) {
      const { error } = await supabase
        .from('bookings')
        .update(payload)
        .eq('id', bookingId);

      if (!error) {
        return { success: true, error: null };
      }

      const missingColumn = extractMissingColumn(error);
      if (missingColumn && missingColumn in payload) {
        continue;
      }

      console.error('Error cancelling booking:', error);
      return { success: false, error: new Error(error.message || 'Failed to cancel booking') };
    }

    return { success: false, error: new Error('Unable to cancel booking with current schema') };
  } catch (err) {
    console.error('Error in cancelBooking:', err);
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to cancel booking'),
    };
  }
}

/**
 * Calculate companion earnings
 */
export async function fetchCompanionEarnings(): Promise<{
  earnings: { week: number; month: number; year: number; total: number };
  error: Error | null;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { earnings: { week: 0, month: 0, year: 0, total: 0 }, error: new Error('Not authenticated') };
    }

    // Get companion ID
    const { data: companion, error: companionError } = await supabase
      .from('companions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (companionError || !companion?.id) {
      return {
        earnings: { week: 0, month: 0, year: 0, total: 0 },
        error: companionError
          ? new Error(companionError.message || 'Failed to fetch companion')
          : new Error('Companion profile not found'),
      };
    }

    let bookings: Array<{ subtotal?: unknown; created_at?: unknown; status?: unknown }> = [];
    let loaded = false;

    for (const companionColumn of BOOKING_COMPANION_COLUMNS) {
      let missingCompanionColumn = false;

      for (const includeStatus of [true, false]) {
        const { data, error } = includeStatus
          ? await supabase
            .from('bookings')
            .select('subtotal, created_at, status')
            .eq(companionColumn, companion.id)
          : await supabase
            .from('bookings')
            .select('subtotal, created_at')
            .eq(companionColumn, companion.id);

        if (!error) {
          bookings = includeStatus
            ? (data || []).filter(
              (booking) => normalizeStatus((booking as Record<string, unknown>)?.status) === 'completed'
            )
            : (data || []);
          loaded = true;
          break;
        }

        if (isMissingColumnError(error, 'bookings', companionColumn)) {
          missingCompanionColumn = true;
          break;
        }

        if (includeStatus && isMissingColumnError(error, 'bookings', 'status')) {
          continue;
        }

        console.error('Error fetching earnings:', error);
        return {
          earnings: { week: 0, month: 0, year: 0, total: 0 },
          error: new Error(error.message || 'Failed to fetch earnings'),
        };
      }

      if (loaded) {
        break;
      }

      if (missingCompanionColumn) {
        continue;
      }
    }

    if (!loaded) {
      return {
        earnings: { week: 0, month: 0, year: 0, total: 0 },
        error: new Error('No supported companion column found for bookings'),
      };
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    let week = 0;
    let month = 0;
    let year = 0;
    let total = 0;

    bookings.forEach((booking) => {
      const bookingDate = new Date(String(booking.created_at || ''));
      const amount = toNumber(booking.subtotal, 0) * 0.9; // Companion gets 90%

      total += amount;
      if (bookingDate >= yearAgo) year += amount;
      if (bookingDate >= monthAgo) month += amount;
      if (bookingDate >= weekAgo) week += amount;
    });

    return { earnings: { week, month, year, total }, error: null };
  } catch (err) {
    console.error('Error in fetchCompanionEarnings:', err);
    return {
      earnings: { week: 0, month: 0, year: 0, total: 0 },
      error: err instanceof Error ? err : new Error('Failed to fetch earnings'),
    };
  }
}
