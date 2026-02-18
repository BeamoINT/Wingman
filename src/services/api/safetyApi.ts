import { getAuthToken, supabase } from '../supabase';

type QueryError = {
  code?: string | null;
  message?: string | null;
};

export interface SafetyPreferences {
  user_id: string;
  checkins_enabled: boolean;
  checkin_interval_minutes: number;
  checkin_response_window_minutes: number;
  sos_enabled: boolean;
  auto_share_live_location: boolean;
  auto_record_safety_audio_on_visit: boolean;
  cloud_audio_retention_action: 'auto_delete' | 'auto_download';
  cloud_audio_wifi_only_upload: boolean;
  safety_audio_policy_ack_version: string | null;
  safety_audio_policy_ack_at: string | null;
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

function isMissingSafetyPreferencesRpc(error: unknown, rpcName: string): boolean {
  const typedError = error as QueryError | null | undefined;
  const code = String(typedError?.code || '');
  const message = String(typedError?.message || '').toLowerCase();
  return (
    (code.startsWith('PGRST') || code === '42883')
    && message.includes(`function public.${rpcName}`)
    && (
      message.includes('does not exist')
      || message.includes('could not find the function')
      || message.includes('schema cache')
    )
  );
}

function normalizeSafetyPreferences(value: unknown): SafetyPreferences | null {
  const row = normalizeSingleRow<Record<string, unknown>>(value);
  if (!row) {
    return null;
  }

  return {
    user_id: String(row.user_id || ''),
    checkins_enabled: row.checkins_enabled !== false,
    checkin_interval_minutes: Number(row.checkin_interval_minutes || 30),
    checkin_response_window_minutes: Number(row.checkin_response_window_minutes || 10),
    sos_enabled: row.sos_enabled !== false,
    auto_share_live_location: row.auto_share_live_location === true,
    auto_record_safety_audio_on_visit: row.auto_record_safety_audio_on_visit === true,
    cloud_audio_retention_action: row.cloud_audio_retention_action === 'auto_download'
      ? 'auto_download'
      : 'auto_delete',
    cloud_audio_wifi_only_upload: row.cloud_audio_wifi_only_upload === true,
    safety_audio_policy_ack_version: typeof row.safety_audio_policy_ack_version === 'string'
      ? row.safety_audio_policy_ack_version
      : null,
    safety_audio_policy_ack_at: typeof row.safety_audio_policy_ack_at === 'string'
      ? row.safety_audio_policy_ack_at
      : null,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

async function getSafetyPreferencesV1Fallback(): Promise<{
  preferences: SafetyPreferences | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc('get_safety_preferences_v1');

  if (error) {
    return {
      preferences: null,
      error: toError(error, 'Unable to load safety preferences.'),
    };
  }

  return {
    preferences: normalizeSafetyPreferences(data),
    error: null,
  };
}

export async function getSafetyPreferences(): Promise<{
  preferences: SafetyPreferences | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('get_safety_preferences_v2');

    if (error) {
      if (isMissingSafetyPreferencesRpc(error, 'get_safety_preferences_v2')) {
        return await getSafetyPreferencesV1Fallback();
      }

      return { preferences: null, error: toError(error, 'Unable to load safety preferences.') };
    }

    return {
      preferences: normalizeSafetyPreferences(data),
      error: null,
    };
  } catch (error) {
    if (isMissingSafetyPreferencesRpc(error, 'get_safety_preferences_v2')) {
      return await getSafetyPreferencesV1Fallback();
    }

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
  autoRecordSafetyAudioOnVisit?: boolean;
  cloudAudioRetentionAction?: 'auto_delete' | 'auto_download';
  cloudAudioWifiOnlyUpload?: boolean;
  safetyAudioPolicyAckVersion?: string | null;
  acknowledgeSafetyAudioPolicy?: boolean;
}): Promise<{
  preferences: SafetyPreferences | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('update_safety_preferences_v3', {
      p_checkins_enabled: input.checkinsEnabled ?? null,
      p_checkin_interval_minutes: input.checkinIntervalMinutes ?? null,
      p_checkin_response_window_minutes: input.checkinResponseWindowMinutes ?? null,
      p_sos_enabled: input.sosEnabled ?? null,
      p_auto_share_live_location: input.autoShareLiveLocation ?? null,
      p_auto_record_safety_audio_on_visit: input.autoRecordSafetyAudioOnVisit ?? null,
      p_safety_audio_policy_ack_version: input.safetyAudioPolicyAckVersion ?? null,
      p_acknowledge_safety_audio_policy: input.acknowledgeSafetyAudioPolicy ?? false,
      p_cloud_audio_retention_action: input.cloudAudioRetentionAction ?? null,
      p_cloud_audio_wifi_only_upload: input.cloudAudioWifiOnlyUpload ?? null,
    });

    if (error) {
      if (isMissingSafetyPreferencesRpc(error, 'update_safety_preferences_v3')) {
        const v2Result = await supabase.rpc('update_safety_preferences_v2', {
          p_checkins_enabled: input.checkinsEnabled ?? null,
          p_checkin_interval_minutes: input.checkinIntervalMinutes ?? null,
          p_checkin_response_window_minutes: input.checkinResponseWindowMinutes ?? null,
          p_sos_enabled: input.sosEnabled ?? null,
          p_auto_share_live_location: input.autoShareLiveLocation ?? null,
          p_auto_record_safety_audio_on_visit: input.autoRecordSafetyAudioOnVisit ?? null,
          p_safety_audio_policy_ack_version: input.safetyAudioPolicyAckVersion ?? null,
          p_acknowledge_safety_audio_policy: input.acknowledgeSafetyAudioPolicy ?? false,
        });

        if (!v2Result.error) {
          return {
            preferences: normalizeSafetyPreferences(v2Result.data),
            error: null,
          };
        }

        if (!isMissingSafetyPreferencesRpc(v2Result.error, 'update_safety_preferences_v2')) {
          return {
            preferences: null,
            error: toError(v2Result.error, 'Unable to update safety preferences.'),
          };
        }

        const fallback = await supabase.rpc('update_safety_preferences_v1', {
          p_checkins_enabled: input.checkinsEnabled ?? null,
          p_checkin_interval_minutes: input.checkinIntervalMinutes ?? null,
          p_checkin_response_window_minutes: input.checkinResponseWindowMinutes ?? null,
          p_sos_enabled: input.sosEnabled ?? null,
          p_auto_share_live_location: input.autoShareLiveLocation ?? null,
        });

        if (fallback.error) {
          return {
            preferences: null,
            error: toError(fallback.error, 'Unable to update safety preferences.'),
          };
        }

        return {
          preferences: normalizeSafetyPreferences(fallback.data),
          error: null,
        };
      }

      return { preferences: null, error: toError(error, 'Unable to update safety preferences.') };
    }

    return {
      preferences: normalizeSafetyPreferences(data),
      error: null,
    };
  } catch (error) {
    if (isMissingSafetyPreferencesRpc(error, 'update_safety_preferences_v3')) {
      try {
        const v2Result = await supabase.rpc('update_safety_preferences_v2', {
          p_checkins_enabled: input.checkinsEnabled ?? null,
          p_checkin_interval_minutes: input.checkinIntervalMinutes ?? null,
          p_checkin_response_window_minutes: input.checkinResponseWindowMinutes ?? null,
          p_sos_enabled: input.sosEnabled ?? null,
          p_auto_share_live_location: input.autoShareLiveLocation ?? null,
          p_auto_record_safety_audio_on_visit: input.autoRecordSafetyAudioOnVisit ?? null,
          p_safety_audio_policy_ack_version: input.safetyAudioPolicyAckVersion ?? null,
          p_acknowledge_safety_audio_policy: input.acknowledgeSafetyAudioPolicy ?? false,
        });

        if (!v2Result.error) {
          return {
            preferences: normalizeSafetyPreferences(v2Result.data),
            error: null,
          };
        }

        if (!isMissingSafetyPreferencesRpc(v2Result.error, 'update_safety_preferences_v2')) {
          return {
            preferences: null,
            error: toError(v2Result.error, 'Unable to update safety preferences.'),
          };
        }

        const fallback = await supabase.rpc('update_safety_preferences_v1', {
          p_checkins_enabled: input.checkinsEnabled ?? null,
          p_checkin_interval_minutes: input.checkinIntervalMinutes ?? null,
          p_checkin_response_window_minutes: input.checkinResponseWindowMinutes ?? null,
          p_sos_enabled: input.sosEnabled ?? null,
          p_auto_share_live_location: input.autoShareLiveLocation ?? null,
        });

        if (fallback.error) {
          return {
            preferences: null,
            error: toError(fallback.error, 'Unable to update safety preferences.'),
          };
        }

        return {
          preferences: normalizeSafetyPreferences(fallback.data),
          error: null,
        };
      } catch (fallbackError) {
        return {
          preferences: null,
          error: toError(fallbackError, 'Unable to update safety preferences.'),
        };
      }
    }

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
