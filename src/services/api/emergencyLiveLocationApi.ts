import { supabase } from '../supabase';

export type EmergencyLiveShareStatus = 'active' | 'stopped' | 'expired';

export interface EmergencyLiveLocationShare {
  id: string;
  booking_id: string;
  user_id: string;
  status: EmergencyLiveShareStatus;
  started_at: string;
  expires_at: string;
  stopped_at: string | null;
  last_heartbeat_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmergencyLiveLocationPoint {
  share_id: string;
  booking_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  heading_deg: number | null;
  speed_mps: number | null;
  captured_at: string;
  expires_at: string;
  updated_at: string;
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

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) {
    return (value[0] || null) as T | null;
  }

  if (value && typeof value === 'object') {
    return value as T;
  }

  return null;
}

export async function startEmergencyLiveLocationShare(
  bookingId: string,
  durationMinutes = 120,
): Promise<{ share: EmergencyLiveLocationShare | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('start_emergency_live_location_share_v1', {
      p_booking_id: bookingId,
      p_duration_minutes: durationMinutes,
    });

    if (error) {
      return { share: null, error: toError(error, 'Unable to start emergency live location sharing.') };
    }

    return {
      share: firstRow<EmergencyLiveLocationShare>(data),
      error: null,
    };
  } catch (error) {
    return {
      share: null,
      error: toError(error, 'Unable to start emergency live location sharing.'),
    };
  }
}

export async function stopEmergencyLiveLocationShare(
  bookingId: string,
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('stop_emergency_live_location_share_v1', {
      p_booking_id: bookingId,
    });

    if (error) {
      return { success: false, error: toError(error, 'Unable to stop emergency live location sharing.') };
    }

    return {
      success: data === true,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: toError(error, 'Unable to stop emergency live location sharing.'),
    };
  }
}

export async function extendEmergencyLiveLocationShare(
  bookingId: string,
  extensionMinutes = 30,
): Promise<{ share: EmergencyLiveLocationShare | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('extend_emergency_live_location_share_v1', {
      p_booking_id: bookingId,
      p_extension_minutes: extensionMinutes,
    });

    if (error) {
      return { share: null, error: toError(error, 'Unable to extend emergency live location sharing.') };
    }

    return {
      share: firstRow<EmergencyLiveLocationShare>(data),
      error: null,
    };
  } catch (error) {
    return {
      share: null,
      error: toError(error, 'Unable to extend emergency live location sharing.'),
    };
  }
}

export async function upsertEmergencyLiveLocationPoint(input: {
  bookingId: string;
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  headingDeg?: number | null;
  speedMps?: number | null;
  capturedAt?: string;
}): Promise<{ point: EmergencyLiveLocationPoint | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('upsert_emergency_live_location_point_v1', {
      p_booking_id: input.bookingId,
      p_lat: input.latitude,
      p_lng: input.longitude,
      p_accuracy_m: input.accuracyM ?? null,
      p_heading_deg: input.headingDeg ?? null,
      p_speed_mps: input.speedMps ?? null,
      p_captured_at: input.capturedAt ?? null,
    });

    if (error) {
      return {
        point: null,
        error: toError(error, 'Unable to update emergency live location.'),
      };
    }

    return {
      point: firstRow<EmergencyLiveLocationPoint>(data),
      error: null,
    };
  } catch (error) {
    return {
      point: null,
      error: toError(error, 'Unable to update emergency live location.'),
    };
  }
}

export async function listMyEmergencyLiveLocationShares(): Promise<{
  shares: EmergencyLiveLocationShare[];
  error: Error | null;
}> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('emergency_live_location_shares')
      .select('*')
      .eq('status', 'active')
      .gt('expires_at', nowIso)
      .order('expires_at', { ascending: true });

    if (error) {
      return {
        shares: [],
        error: toError(error, 'Unable to load emergency live location share status.'),
      };
    }

    return {
      shares: (data || []) as EmergencyLiveLocationShare[],
      error: null,
    };
  } catch (error) {
    return {
      shares: [],
      error: toError(error, 'Unable to load emergency live location share status.'),
    };
  }
}

export function subscribeToEmergencyLiveLocationPoints(
  bookingId: string,
  onChange: (points: EmergencyLiveLocationPoint[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const channel = supabase
    .channel(`emergency-live-location:${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'emergency_live_location_points',
        filter: `booking_id=eq.${bookingId}`,
      },
      async () => {
        const { data, error } = await supabase
          .from('emergency_live_location_points')
          .select('*')
          .eq('booking_id', bookingId)
          .gt('expires_at', new Date().toISOString())
          .order('updated_at', { ascending: false });

        if (error) {
          onError?.(toError(error, 'Unable to refresh emergency live location points.'));
          return;
        }

        onChange((data || []) as EmergencyLiveLocationPoint[]);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
