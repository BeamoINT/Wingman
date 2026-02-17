/**
 * Location API Service
 * Handles location search and geocoding via Supabase Edge Functions
 */

import type { PlaceDetails, PlacePrediction } from '../../types/location';
import { trackEvent } from '../monitoring/events';
import { supabase } from '../supabase';

/**
 * Search result from places autocomplete
 */
export interface SearchPlacesResult {
  predictions: PlacePrediction[];
  error?: string;
}

/**
 * Result from getting place details
 */
export interface GetPlaceDetailsResult {
  details: PlaceDetails | null;
  error?: string;
}

/**
 * Result from reverse geocoding
 */
export interface ReverseGeocodeResult {
  details: {
    city: string;
    state: string;
    country: string;
    countryCode: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    formattedAddress: string;
  } | null;
  error?: string;
}

export interface MetroResolution {
  metroAreaId: string | null;
  cbsaCode?: string | null;
  metroAreaName: string | null;
  metroNameLong?: string | null;
  metroCity: string | null;
  metroState: string | null;
  metroCountry: string | null;
  distanceKm?: number | null;
}

export interface MetroArea {
  id: string;
  metroAreaName: string;
  metroName: string;
  metroCity: string;
  metroState: string;
  metroCountry: string;
  latitude: number | null;
  longitude: number | null;
  population: number | null;
}

export type MetroSelectionMode = 'auto' | 'manual' | 'default';

export interface MetroPreferences {
  mode: MetroSelectionMode;
  autoMetroAreaId: string | null;
  manualMetroAreaId: string | null;
  defaultMetroAreaId: string | null;
  effectiveMetroAreaId: string | null;
  effectiveMetroAreaName: string | null;
  effectiveMetroCity: string | null;
  effectiveMetroState: string | null;
  effectiveMetroCountry: string | null;
  updatedAt: string | null;
}

export interface ResolveMetroAreaResult {
  metro: MetroResolution | null;
  fallback: {
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
  resolutionMode:
    | 'metro_match_alias'
    | 'metro_match_nearest'
    | 'non_metro_city_nearest'
    | 'fallback_no_match'
    | 'rate_limited';
  error?: string;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toOptionalNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMetroPreferences(payload: unknown): MetroPreferences | null {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== 'object') {
    return null;
  }

  const data = row as Record<string, unknown>;
  const modeRaw = typeof data.mode === 'string' ? data.mode : 'auto';
  const mode: MetroSelectionMode = (
    modeRaw === 'manual' || modeRaw === 'default' ? modeRaw : 'auto'
  );

  return {
    mode,
    autoMetroAreaId: toOptionalString(data.auto_metro_area_id),
    manualMetroAreaId: toOptionalString(data.manual_metro_area_id),
    defaultMetroAreaId: toOptionalString(data.default_metro_area_id),
    effectiveMetroAreaId: toOptionalString(data.effective_metro_area_id),
    effectiveMetroAreaName: toOptionalString(data.effective_metro_area_name),
    effectiveMetroCity: toOptionalString(data.effective_metro_city),
    effectiveMetroState: toOptionalString(data.effective_metro_state),
    effectiveMetroCountry: toOptionalString(data.effective_metro_country),
    updatedAt: toOptionalString(data.updated_at),
  };
}

/**
 * Search for cities using Google Places Autocomplete
 */
export async function searchPlaces(
  query: string,
  countryCode?: string
): Promise<SearchPlacesResult> {
  try {
    if (!query || query.trim().length < 2) {
      return { predictions: [] };
    }

    const { data, error } = await supabase.functions.invoke('places-autocomplete', {
      body: { query, countryCode },
    });

    if (error) {
      console.error('Error searching places:', error);
      return { predictions: [], error: error.message || 'Search failed' };
    }

    if (data?.error) {
      return { predictions: [], error: data.error };
    }

    return { predictions: data?.predictions || [] };
  } catch (err) {
    console.error('Error in searchPlaces:', err);
    return { predictions: [], error: 'Search failed. Please try again.' };
  }
}

/**
 * Get full details for a place by its ID
 */
export async function getPlaceDetails(placeId: string): Promise<GetPlaceDetailsResult> {
  try {
    if (!placeId) {
      return { details: null, error: 'Place ID is required' };
    }

    const { data, error } = await supabase.functions.invoke('places-details', {
      body: { placeId },
    });

    if (error) {
      console.error('Error getting place details:', error);
      return { details: null, error: error.message || 'Failed to get place details' };
    }

    if (data?.error) {
      return { details: null, error: data.error };
    }

    return { details: data?.details || null };
  } catch (err) {
    console.error('Error in getPlaceDetails:', err);
    return { details: null, error: 'Failed to get place details. Please try again.' };
  }
}

/**
 * Reverse geocode coordinates to get address details
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return { details: null, error: 'Valid coordinates are required' };
    }

    const { data, error } = await supabase.functions.invoke('reverse-geocode', {
      body: { latitude, longitude },
    });

    if (error) {
      console.error('Error reverse geocoding:', error);
      return { details: null, error: error.message || 'Failed to get location' };
    }

    if (data?.error) {
      return { details: null, error: data.error };
    }

    return { details: data?.details || null };
  } catch (err) {
    console.error('Error in reverseGeocode:', err);
    return { details: null, error: 'Failed to get location. Please try again.' };
  }
}

/**
 * Resolve city/state/country to canonical metro area labels.
 */
export async function resolveMetroArea(input: {
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
}): Promise<ResolveMetroAreaResult> {
  try {
    const { data, error } = await supabase.functions.invoke('resolve-metro-area', {
      body: input,
    });

    if (error) {
      trackEvent('metro_resolve_failed', { reason: error.message || 'invoke_failed' });
      return {
        metro: null,
        fallback: null,
        resolutionMode: 'fallback_no_match',
        error: error.message || 'Failed to resolve metro area',
      };
    }

    const response = (data || {}) as ResolveMetroAreaResult;
    if (response.error) {
      trackEvent('metro_resolve_failed', { reason: response.error });
      return response;
    }

    trackEvent('metro_resolve_success', { mode: response.resolutionMode });
    if (
      response.resolutionMode === 'metro_match_nearest'
      || response.resolutionMode === 'non_metro_city_nearest'
    ) {
      trackEvent('metro_nearest_resolution_used', { mode: response.resolutionMode });
    }
    return {
      metro: response.metro || null,
      fallback: response.fallback || null,
      resolutionMode: response.resolutionMode || 'fallback_no_match',
    };
  } catch (err) {
    trackEvent('metro_resolve_failed', { reason: 'exception' });
    return {
      metro: null,
      fallback: null,
      resolutionMode: 'fallback_no_match',
      error: 'Failed to resolve metro area.',
    };
  }
}

export async function listMetroAreas(input: {
  query?: string;
  countryCode?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ metros: MetroArea[]; error?: string }> {
  const { query, countryCode, limit = 50, offset = 0 } = input;

  try {
    const { data, error } = await supabase.rpc('list_metro_areas_v1', {
      p_query: query ?? null,
      p_country_code: countryCode ?? null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return { metros: [], error: error.message || 'Unable to load metro areas.' };
    }

    const rows = Array.isArray(data) ? data : [];
    return {
      metros: rows.map((row) => {
        const record = row as Record<string, unknown>;
        return {
          id: String(record.id || ''),
          metroAreaName: String(record.metro_area_name || record.metro_city || 'Unknown Metro'),
          metroName: String(record.metro_name || record.metro_area_name || ''),
          metroCity: String(record.metro_city || record.metro_area_name || ''),
          metroState: String(record.metro_state || ''),
          metroCountry: String(record.metro_country || ''),
          latitude: toOptionalNumber(record.latitude),
          longitude: toOptionalNumber(record.longitude),
          population: toOptionalNumber(record.population),
        } satisfies MetroArea;
      }).filter((metro) => metro.id.length > 0),
    };
  } catch (err) {
    return { metros: [], error: 'Unable to load metro areas.' };
  }
}

export async function getMetroPreferences(): Promise<{
  preferences: MetroPreferences | null;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_current_metro_preferences_v1');
    if (error) {
      return { preferences: null, error: error.message || 'Unable to load metro preferences.' };
    }

    return { preferences: normalizeMetroPreferences(data) };
  } catch (err) {
    return { preferences: null, error: 'Unable to load metro preferences.' };
  }
}

export async function updateMetroPreferences(input: {
  mode: MetroSelectionMode;
  manualMetroAreaId?: string | null;
  defaultMetroAreaId?: string | null;
}): Promise<{ preferences: MetroPreferences | null; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('update_metro_preferences_v1', {
      p_mode: input.mode,
      p_manual_metro_area_id: input.manualMetroAreaId ?? null,
      p_default_metro_area_id: input.defaultMetroAreaId ?? null,
    });

    if (error) {
      return { preferences: null, error: error.message || 'Unable to update metro preferences.' };
    }

    const preferences = normalizeMetroPreferences(data);
    return { preferences };
  } catch (err) {
    return { preferences: null, error: 'Unable to update metro preferences.' };
  }
}
