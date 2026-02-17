import type {
  DirectionsLocationInput,
  DirectionsResponse,
  DirectionsTravelMode,
} from '../../types/location';
import { supabase } from '../supabase';

export interface GetDirectionsInput {
  origin: DirectionsLocationInput;
  destination: DirectionsLocationInput;
  mode?: DirectionsTravelMode;
  alternatives?: boolean;
}

export interface GetDirectionsResult {
  directions: DirectionsResponse | null;
  error?: string;
}

function toErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDirectionsResponse(payload: unknown): DirectionsResponse {
  const data = (payload || {}) as Record<string, unknown>;
  const routesRaw = Array.isArray(data.routes) ? data.routes : [];

  return {
    routes: routesRaw
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
      .map((route, index) => {
        const legsRaw = Array.isArray(route.legs) ? route.legs : [];

        return {
          id: typeof route.id === 'string' && route.id.trim()
            ? route.id
            : `route-${index}`,
          summary: typeof route.summary === 'string' && route.summary.trim()
            ? route.summary
            : `Route ${index + 1}`,
          distanceMeters: toFiniteNumber(route.distanceMeters),
          durationSeconds: toFiniteNumber(route.durationSeconds),
          durationInTrafficSeconds: Number.isFinite(Number(route.durationInTrafficSeconds))
            ? Number(route.durationInTrafficSeconds)
            : null,
          polyline: typeof route.polyline === 'string' ? route.polyline : '',
          warnings: Array.isArray(route.warnings)
            ? route.warnings.filter((warning): warning is string => typeof warning === 'string')
            : [],
          legs: legsRaw
            .filter((leg): leg is Record<string, unknown> => !!leg && typeof leg === 'object')
            .map((leg) => ({
              startAddress: typeof leg.startAddress === 'string' ? leg.startAddress : '',
              endAddress: typeof leg.endAddress === 'string' ? leg.endAddress : '',
              distanceMeters: toFiniteNumber(leg.distanceMeters),
              durationSeconds: toFiniteNumber(leg.durationSeconds),
              durationInTrafficSeconds: Number.isFinite(Number(leg.durationInTrafficSeconds))
                ? Number(leg.durationInTrafficSeconds)
                : null,
              startLocation: {
                latitude: Number.isFinite(Number((leg.startLocation as Record<string, unknown> | undefined)?.latitude))
                  ? Number((leg.startLocation as Record<string, unknown>).latitude)
                  : null,
                longitude: Number.isFinite(Number((leg.startLocation as Record<string, unknown> | undefined)?.longitude))
                  ? Number((leg.startLocation as Record<string, unknown>).longitude)
                  : null,
              },
              endLocation: {
                latitude: Number.isFinite(Number((leg.endLocation as Record<string, unknown> | undefined)?.latitude))
                  ? Number((leg.endLocation as Record<string, unknown>).latitude)
                  : null,
                longitude: Number.isFinite(Number((leg.endLocation as Record<string, unknown> | undefined)?.longitude))
                  ? Number((leg.endLocation as Record<string, unknown>).longitude)
                  : null,
              },
            })),
        };
      }),
    recommendedRouteId: typeof data.recommendedRouteId === 'string' && data.recommendedRouteId.trim().length > 0
      ? data.recommendedRouteId
      : null,
  };
}

export async function getDirections(
  input: GetDirectionsInput,
): Promise<GetDirectionsResult> {
  try {
    const { data, error } = await supabase.functions.invoke('get-directions', {
      body: {
        origin: input.origin,
        destination: input.destination,
        mode: input.mode || 'driving',
        alternatives: input.alternatives !== false,
      },
    });

    if (error) {
      return {
        directions: null,
        error: toErrorMessage(error, 'Unable to fetch directions right now.'),
      };
    }

    const body = (data || {}) as Record<string, unknown>;
    if (body.error) {
      return {
        directions: null,
        error: toErrorMessage(body.error, 'Unable to fetch directions right now.'),
      };
    }

    return {
      directions: normalizeDirectionsResponse(data),
    };
  } catch (error) {
    return {
      directions: null,
      error: toErrorMessage(error, 'Unable to fetch directions right now.'),
    };
  }
}
