import type {
  LiveLocationPoint,
  LiveLocationShareSession,
} from '../../types/location';
import { trackEvent } from '../monitoring/events';
import { supabase } from '../supabase';

type RawRecord = Record<string, unknown>;
type QueryError = {
  code?: string | null;
  message?: string | null;
};

const LIVE_LOCATION_UNAVAILABLE_ERROR_MESSAGE = 'Live location is temporarily unavailable. Please try again soon.';

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toOptionalNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toErrorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return fallback;
}

function isMissingSchemaError(error: unknown, identifier: string): boolean {
  const typedError = error as QueryError | null | undefined;
  const code = String(typedError?.code || '');
  const message = String(typedError?.message || '').toLowerCase();
  return (
    (code.startsWith('PGRST') || code === '42883')
    && message.includes(identifier.toLowerCase())
    && (
      message.includes('does not exist')
      || message.includes('could not find the function')
      || message.includes('schema cache')
    )
  );
}

function isMissingLiveLocationRpc(error: unknown, rpcName: string): boolean {
  return isMissingSchemaError(error, `function public.${rpcName}`);
}

function normalizeShare(row: RawRecord): LiveLocationShareSession {
  return {
    conversationId: toStringValue(row.conversation_id),
    userId: toStringValue(row.user_id),
    status: (
      ['active', 'stopped', 'expired'].includes(toStringValue(row.status))
        ? toStringValue(row.status)
        : 'stopped'
    ) as LiveLocationShareSession['status'],
    startedAt: toStringValue(row.started_at, new Date().toISOString()),
    expiresAt: toStringValue(row.expires_at, new Date().toISOString()),
    stoppedAt: row.stopped_at ? toStringValue(row.stopped_at) : null,
    lastHeartbeatAt: row.last_heartbeat_at ? toStringValue(row.last_heartbeat_at) : null,
    createdAt: toStringValue(row.created_at, new Date().toISOString()),
    updatedAt: toStringValue(row.updated_at, new Date().toISOString()),
  };
}

function normalizePoint(row: RawRecord): LiveLocationPoint {
  return {
    conversationId: toStringValue(row.conversation_id),
    userId: toStringValue(row.user_id),
    latitude: Number(row.latitude || 0),
    longitude: Number(row.longitude || 0),
    accuracyM: toOptionalNumber(row.accuracy_m),
    headingDeg: toOptionalNumber(row.heading_deg),
    speedMps: toOptionalNumber(row.speed_mps),
    capturedAt: toStringValue(row.captured_at, new Date().toISOString()),
    expiresAt: toStringValue(row.expires_at, new Date().toISOString()),
    updatedAt: toStringValue(row.updated_at, new Date().toISOString()),
  };
}

export async function startLiveLocationShare(
  conversationId: string,
  durationMinutes = 120,
): Promise<{ share: LiveLocationShareSession | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('start_live_location_share_v1', {
      p_conversation_id: conversationId,
      p_duration_minutes: durationMinutes,
    });

    if (error) {
      if (isMissingLiveLocationRpc(error, 'start_live_location_share_v1')) {
        return { share: null, error: new Error(LIVE_LOCATION_UNAVAILABLE_ERROR_MESSAGE) };
      }
      return { share: null, error: new Error(toErrorMessage(error, 'Unable to start location sharing.')) };
    }

    const row = (Array.isArray(data) ? data[0] : data) as RawRecord | null;
    if (!row || typeof row !== 'object') {
      return { share: null, error: new Error('Unable to start location sharing.') };
    }

    return {
      share: normalizeShare(row),
      error: null,
    };
  } catch (error) {
    if (isMissingLiveLocationRpc(error, 'start_live_location_share_v1')) {
      return { share: null, error: new Error(LIVE_LOCATION_UNAVAILABLE_ERROR_MESSAGE) };
    }
    return {
      share: null,
      error: new Error(toErrorMessage(error, 'Unable to start location sharing.')),
    };
  }
}

export async function stopLiveLocationShare(
  conversationId: string,
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('stop_live_location_share_v1', {
      p_conversation_id: conversationId,
    });

    if (error) {
      if (isMissingLiveLocationRpc(error, 'stop_live_location_share_v1')) {
        return { success: false, error: new Error(LIVE_LOCATION_UNAVAILABLE_ERROR_MESSAGE) };
      }
      return { success: false, error: new Error(toErrorMessage(error, 'Unable to stop location sharing.')) };
    }

    return {
      success: data === true || data === null,
      error: null,
    };
  } catch (error) {
    if (isMissingLiveLocationRpc(error, 'stop_live_location_share_v1')) {
      return { success: false, error: new Error(LIVE_LOCATION_UNAVAILABLE_ERROR_MESSAGE) };
    }
    return {
      success: false,
      error: new Error(toErrorMessage(error, 'Unable to stop location sharing.')),
    };
  }
}

export async function upsertLiveLocationPoint(input: {
  conversationId: string;
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  headingDeg?: number | null;
  speedMps?: number | null;
  capturedAt?: string;
}): Promise<{ point: LiveLocationPoint | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('upsert_live_location_point_v1', {
      p_conversation_id: input.conversationId,
      p_lat: input.latitude,
      p_lng: input.longitude,
      p_accuracy_m: input.accuracyM ?? null,
      p_heading_deg: input.headingDeg ?? null,
      p_speed_mps: input.speedMps ?? null,
      p_captured_at: input.capturedAt ?? null,
    });

    if (error) {
      if (isMissingLiveLocationRpc(error, 'upsert_live_location_point_v1')) {
        return { point: null, error: new Error(LIVE_LOCATION_UNAVAILABLE_ERROR_MESSAGE) };
      }
      return { point: null, error: new Error(toErrorMessage(error, 'Unable to update live location.')) };
    }

    const row = (Array.isArray(data) ? data[0] : data) as RawRecord | null;
    if (!row || typeof row !== 'object') {
      return { point: null, error: new Error('Unable to update live location.') };
    }

    return {
      point: normalizePoint(row),
      error: null,
    };
  } catch (error) {
    if (isMissingLiveLocationRpc(error, 'upsert_live_location_point_v1')) {
      return { point: null, error: new Error(LIVE_LOCATION_UNAVAILABLE_ERROR_MESSAGE) };
    }
    return {
      point: null,
      error: new Error(toErrorMessage(error, 'Unable to update live location.')),
    };
  }
}

export async function listLiveLocationPoints(
  conversationId: string,
): Promise<{ points: LiveLocationPoint[]; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('list_live_location_points_v1', {
      p_conversation_id: conversationId,
    });

    if (error) {
      if (isMissingLiveLocationRpc(error, 'list_live_location_points_v1')) {
        return { points: [], error: null };
      }
      return { points: [], error: new Error(toErrorMessage(error, 'Unable to load shared locations.')) };
    }

    const rows = Array.isArray(data) ? data : [];
    return {
      points: rows
        .filter((row): row is RawRecord => !!row && typeof row === 'object')
        .map((row) => normalizePoint(row)),
      error: null,
    };
  } catch (error) {
    if (isMissingLiveLocationRpc(error, 'list_live_location_points_v1')) {
      return { points: [], error: null };
    }
    return {
      points: [],
      error: new Error(toErrorMessage(error, 'Unable to load shared locations.')),
    };
  }
}

export async function listMyActiveLiveLocationShares(): Promise<{
  shares: LiveLocationShareSession[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('list_my_active_live_location_shares_v1');

    if (error) {
      if (isMissingLiveLocationRpc(error, 'list_my_active_live_location_shares_v1')) {
        return { shares: [], error: null };
      }
      return { shares: [], error: new Error(toErrorMessage(error, 'Unable to load location share status.')) };
    }

    const rows = Array.isArray(data) ? data : [];
    return {
      shares: rows
        .filter((row): row is RawRecord => !!row && typeof row === 'object')
        .map((row) => normalizeShare(row)),
      error: null,
    };
  } catch (error) {
    if (isMissingLiveLocationRpc(error, 'list_my_active_live_location_shares_v1')) {
      return { shares: [], error: null };
    }
    return {
      shares: [],
      error: new Error(toErrorMessage(error, 'Unable to load location share status.')),
    };
  }
}

export async function expireLiveLocationState(): Promise<{
  expiredSharesCount: number;
  deletedPointsCount: number;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('expire_live_location_state_v1');

    if (error) {
      if (isMissingLiveLocationRpc(error, 'expire_live_location_state_v1')) {
        return {
          expiredSharesCount: 0,
          deletedPointsCount: 0,
          error: null,
        };
      }
      return {
        expiredSharesCount: 0,
        deletedPointsCount: 0,
        error: new Error(toErrorMessage(error, 'Unable to refresh location share status.')),
      };
    }

    const row = (Array.isArray(data) ? data[0] : data) as RawRecord | null;
    const expiredSharesCount = Number(row?.expired_shares_count || 0);
    const deletedPointsCount = Number(row?.deleted_points_count || 0);

    trackEvent('live_location_cleanup_run', {
      expiredSharesCount,
      deletedPointsCount,
    });

    return {
      expiredSharesCount,
      deletedPointsCount,
      error: null,
    };
  } catch (error) {
    if (isMissingLiveLocationRpc(error, 'expire_live_location_state_v1')) {
      return {
        expiredSharesCount: 0,
        deletedPointsCount: 0,
        error: null,
      };
    }
    return {
      expiredSharesCount: 0,
      deletedPointsCount: 0,
      error: new Error(toErrorMessage(error, 'Unable to refresh location share status.')),
    };
  }
}

export function subscribeToLiveLocationPoints(
  conversationId: string,
  onChange: (points: LiveLocationPoint[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const channel = supabase
    .channel(`live-location-points:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_location_points',
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => {
        void listLiveLocationPoints(conversationId).then((result) => {
          if (result.error) {
            onError?.(result.error);
            return;
          }
          onChange(result.points);
        });
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        onError?.(new Error('Live location stream disconnected.'));
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
