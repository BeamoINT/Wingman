import { getAuthToken, supabase } from '../supabase';

export interface SafetyPreferences {
  user_id: string;
  checkins_enabled: boolean;
  checkin_interval_minutes: number;
  checkin_response_window_minutes: number;
  sos_enabled: boolean;
  auto_share_live_location: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingSafetySettings {
  booking_id: string;
  user_id: string;
  checkins_enabled_override: boolean | null;
  checkin_interval_minutes_override: number | null;
  checkin_response_window_minutes_override: number | null;
  live_share_enabled_override: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface SafetySessionSummary {
  session_id: string;
  booking_id: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled' | 'expired';
  checkin_interval_minutes: number;
  response_window_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  next_checkin_at: string | null;
  pending_checkin_id: string | null;
  pending_checkin_respond_by: string | null;
  booking_status: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
}

export interface SafetyAcknowledgementState {
  has_acknowledged: boolean;
  disclaimer_version: string | null;
  acknowledged_at: string | null;
}

interface EmergencyAlertPayload {
  bookingId?: string;
  source?: 'sos_button' | 'checkin_unsafe' | 'checkin_timeout' | 'live_location_started' | 'manual';
  message?: string;
  includeLiveLocationLink?: boolean;
  location?: {
    latitude?: number;
    longitude?: number;
    accuracyM?: number;
    capturedAt?: string;
  };
  metadata?: Record<string, unknown>;
}

function toError(error: unknown, fallback: string): Error {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return new Error(message);
    }
  }

  if (typeof error === 'string' && error.trim()) {
    return new Error(error);
  }

  return new Error(fallback);
}

function normalizeSingleRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) {
    return (value[0] || null) as T | null;
  }

  if (value && typeof value === 'object') {
    return value as T;
  }

  return null;
}

export async function getSafetyPreferences(): Promise<{
  preferences: SafetyPreferences | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('get_safety_preferences_v1');

    if (error) {
      return { preferences: null, error: toError(error, 'Unable to load safety preferences.') };
    }

    return {
      preferences: normalizeSingleRow<SafetyPreferences>(data),
      error: null,
    };
  } catch (error) {
    return {
      preferences: null,
      error: toError(error, 'Unable to load safety preferences.'),
    };
  }
}

export async function getSafetyAcknowledgement(): Promise<{
  acknowledgement: SafetyAcknowledgementState | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('get_safety_acknowledgement_v1');

    if (error) {
      return {
        acknowledgement: null,
        error: toError(error, 'Unable to load safety acknowledgement status.'),
      };
    }

    return {
      acknowledgement: normalizeSingleRow<SafetyAcknowledgementState>(data),
      error: null,
    };
  } catch (error) {
    return {
      acknowledgement: null,
      error: toError(error, 'Unable to load safety acknowledgement status.'),
    };
  }
}

export async function acknowledgeSafetyDisclaimer(disclaimerVersion: string): Promise<{
  acknowledged: boolean;
  error: Error | null;
}> {
  try {
    const { error } = await supabase.rpc('acknowledge_safety_disclaimer_v1', {
      p_disclaimer_version: disclaimerVersion,
      p_source: 'safety_center',
    });

    if (error) {
      return {
        acknowledged: false,
        error: toError(error, 'Unable to save safety acknowledgement.'),
      };
    }

    return {
      acknowledged: true,
      error: null,
    };
  } catch (error) {
    return {
      acknowledged: false,
      error: toError(error, 'Unable to save safety acknowledgement.'),
    };
  }
}

export async function updateSafetyPreferences(input: {
  checkinsEnabled?: boolean;
  checkinIntervalMinutes?: number;
  checkinResponseWindowMinutes?: number;
  sosEnabled?: boolean;
  autoShareLiveLocation?: boolean;
}): Promise<{
  preferences: SafetyPreferences | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('update_safety_preferences_v1', {
      p_checkins_enabled: input.checkinsEnabled ?? null,
      p_checkin_interval_minutes: input.checkinIntervalMinutes ?? null,
      p_checkin_response_window_minutes: input.checkinResponseWindowMinutes ?? null,
      p_sos_enabled: input.sosEnabled ?? null,
      p_auto_share_live_location: input.autoShareLiveLocation ?? null,
    });

    if (error) {
      return { preferences: null, error: toError(error, 'Unable to update safety preferences.') };
    }

    return {
      preferences: normalizeSingleRow<SafetyPreferences>(data),
      error: null,
    };
  } catch (error) {
    return {
      preferences: null,
      error: toError(error, 'Unable to update safety preferences.'),
    };
  }
}

export async function upsertBookingSafetySettings(input: {
  bookingId: string;
  checkinsEnabledOverride?: boolean | null;
  checkinIntervalMinutesOverride?: number | null;
  checkinResponseWindowMinutesOverride?: number | null;
  liveShareEnabledOverride?: boolean | null;
}): Promise<{
  settings: BookingSafetySettings | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('upsert_booking_safety_settings_v1', {
      p_booking_id: input.bookingId,
      p_checkins_enabled_override: input.checkinsEnabledOverride ?? null,
      p_checkin_interval_minutes_override: input.checkinIntervalMinutesOverride ?? null,
      p_checkin_response_window_minutes_override: input.checkinResponseWindowMinutesOverride ?? null,
      p_live_share_enabled_override: input.liveShareEnabledOverride ?? null,
    });

    if (error) {
      return { settings: null, error: toError(error, 'Unable to save booking safety settings.') };
    }

    return {
      settings: normalizeSingleRow<BookingSafetySettings>(data),
      error: null,
    };
  } catch (error) {
    return {
      settings: null,
      error: toError(error, 'Unable to save booking safety settings.'),
    };
  }
}

export async function getBookingSafetySettings(bookingId: string): Promise<{
  settings: BookingSafetySettings | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('booking_safety_settings')
      .select('*')
      .eq('booking_id', bookingId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return {
        settings: null,
        error: toError(error, 'Unable to load booking safety settings.'),
      };
    }

    return {
      settings: (data || null) as BookingSafetySettings | null,
      error: null,
    };
  } catch (error) {
    return {
      settings: null,
      error: toError(error, 'Unable to load booking safety settings.'),
    };
  }
}

export async function listMyActiveSafetySessions(): Promise<{
  sessions: SafetySessionSummary[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('list_my_active_safety_sessions_v1');

    if (error) {
      return { sessions: [], error: toError(error, 'Unable to load safety sessions.') };
    }

    return {
      sessions: Array.isArray(data) ? (data as SafetySessionSummary[]) : [],
      error: null,
    };
  } catch (error) {
    return {
      sessions: [],
      error: toError(error, 'Unable to load safety sessions.'),
    };
  }
}

export async function respondToSafetyCheckin(checkinId: string, response: 'safe' | 'unsafe'): Promise<{
  success: boolean;
  error: Error | null;
}> {
  try {
    const { error } = await supabase.rpc('respond_safety_checkin_v1', {
      p_checkin_id: checkinId,
      p_response: response,
    });

    if (error) {
      return {
        success: false,
        error: toError(error, 'Unable to submit safety check-in response.'),
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: toError(error, 'Unable to submit safety check-in response.'),
    };
  }
}

export async function triggerEmergencyAlert(payload: EmergencyAlertPayload): Promise<{
  success: boolean;
  sentCount: number;
  failedCount: number;
  emergencyDialNumber: string;
  error: Error | null;
}> {
  try {
    const accessToken = await getAuthToken();

    const { data, error } = await supabase.functions.invoke('trigger-emergency-alert', {
      body: payload,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });

    if (error) {
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        emergencyDialNumber: '911',
        error: toError(error, 'Unable to send emergency alert.'),
      };
    }

    const record = (data || {}) as Record<string, unknown>;
    if (record.error) {
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        emergencyDialNumber: '911',
        error: toError(record.error, 'Unable to send emergency alert.'),
      };
    }

    return {
      success: record.success === true,
      sentCount: Number(record.sentCount || 0),
      failedCount: Number(record.failedCount || 0),
      emergencyDialNumber: typeof record.emergencyDialNumber === 'string'
        ? record.emergencyDialNumber
        : '911',
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      sentCount: 0,
      failedCount: 0,
      emergencyDialNumber: '911',
      error: toError(error, 'Unable to send emergency alert.'),
    };
  }
}
