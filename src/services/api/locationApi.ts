/**
 * Location API Service
 * Handles location search and geocoding via Supabase Edge Functions
 */

import type { PlaceDetails, PlacePrediction } from '../../types/location';
import { trackEvent } from '../monitoring/events';
import { supabase } from '../supabase';

type QueryError = {
  code?: string | null;
  message?: string | null;
};

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

export type PlaceSearchMode = 'city' | 'meetup';

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

function isMissingRpc(error: unknown, rpcName: string): boolean {
  const typedError = error as QueryError | null | undefined;
  const code = String(typedError?.code || '').toUpperCase();
  const message = String(typedError?.message || '').toLowerCase();
  return (
    (message.includes(rpcName.toLowerCase()) || message.includes(`function public.${rpcName}`))
    && (
      message.includes('could not find the function')
      || message.includes('does not exist')
      || message.includes('schema cache')
      || code === '42883'
      || code.startsWith('PGRST')
    )
  );
}

function isMissingColumnError(error: unknown): boolean {
  const typedError = error as QueryError | null | undefined;
  return String(typedError?.code || '') === '42703';
}

function extractMissingColumn(error: unknown): string | null {
  const typedError = error as QueryError | null | undefined;
  const message = String(typedError?.message || '');

  const directMatch = message.match(/column\s+([a-zA-Z0-9_]+)\s+does not exist/i);
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  const scopedMatch = message.match(/column\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s+does not exist/i);
  if (scopedMatch?.[2]) {
    return scopedMatch[2];
  }

  return null;
}

function normalizeMetroAreaRecord(record: Record<string, unknown>): MetroArea {
  return {
    id: String(record.id || ''),
    metroAreaName: String(record.metro_area_name || record.display_city || record.metro_city || 'Unknown Metro'),
    metroName: String(record.metro_name || record.metro_area_name || ''),
    metroCity: String(record.metro_city || record.display_city || record.metro_area_name || ''),
    metroState: String(record.metro_state || record.state_code || ''),
    metroCountry: String(record.metro_country || record.country_code || ''),
    latitude: toOptionalNumber(record.latitude),
    longitude: toOptionalNumber(record.longitude),
    population: toOptionalNumber(record.population),
  };
}

const PROFILE_METRO_SELECT_COLUMNS = [
  'metro_selection_mode',
  'auto_metro_area_id',
  'manual_metro_area_id',
  'default_metro_area_id',
  'metro_area_id',
  'metro_area_name',
  'metro_city',
  'metro_state',
  'metro_country',
  'metro_selection_updated_at',
  'updated_at',
];

function normalizeMetroPreferencesFromProfileRow(row: Record<string, unknown>): MetroPreferences {
  const modeRaw = typeof row.metro_selection_mode === 'string' ? row.metro_selection_mode : 'auto';
  const mode: MetroSelectionMode = (
    modeRaw === 'manual' || modeRaw === 'default' ? modeRaw : 'auto'
  );

  return {
    mode,
    autoMetroAreaId: toOptionalString(row.auto_metro_area_id),
    manualMetroAreaId: toOptionalString(row.manual_metro_area_id),
    defaultMetroAreaId: toOptionalString(row.default_metro_area_id),
    effectiveMetroAreaId: toOptionalString(row.metro_area_id),
    effectiveMetroAreaName: toOptionalString(row.metro_area_name),
    effectiveMetroCity: toOptionalString(row.metro_city),
    effectiveMetroState: toOptionalString(row.metro_state),
    effectiveMetroCountry: toOptionalString(row.metro_country),
    updatedAt: toOptionalString(row.metro_selection_updated_at) || toOptionalString(row.updated_at),
  };
}

async function getCurrentProfileMetroRow(): Promise<{
  row: Record<string, unknown> | null;
  error?: string;
}> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { row: null, error: authError?.message || 'Not authenticated' };
  }

  const selectableColumns = [...PROFILE_METRO_SELECT_COLUMNS];

  while (selectableColumns.length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select(selectableColumns.join(','))
      .eq('id', user.id)
      .maybeSingle();

    if (!error) {
      return { row: (data as unknown as Record<string, unknown> | null) || null };
    }

    if (isMissingColumnError(error)) {
      const missingColumn = extractMissingColumn(error);
      if (missingColumn) {
        const idx = selectableColumns.indexOf(missingColumn);
        if (idx !== -1) {
          selectableColumns.splice(idx, 1);
          continue;
        }
      }
    }

    return { row: null, error: error.message || 'Unable to load metro preferences.' };
  }

  return { row: null, error: 'Unable to load metro preferences.' };
}

async function updateCurrentProfileMetroRow(updates: Record<string, unknown>): Promise<{
  row: Record<string, unknown> | null;
  error?: string;
}> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { row: null, error: authError?.message || 'Not authenticated' };
  }

  const mutableUpdates = { ...updates };
  const selectableColumns = [...PROFILE_METRO_SELECT_COLUMNS];

  while (Object.keys(mutableUpdates).length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .update(mutableUpdates)
      .eq('id', user.id)
      .select(selectableColumns.join(','))
      .single();

    if (!error) {
      return { row: (data as unknown as Record<string, unknown> | null) || null };
    }

    if (isMissingColumnError(error)) {
      const missingColumn = extractMissingColumn(error);
      if (missingColumn) {
        delete mutableUpdates[missingColumn];
        const idx = selectableColumns.indexOf(missingColumn);
        if (idx !== -1) {
          selectableColumns.splice(idx, 1);
        }
        continue;
      }
    }

    return { row: null, error: error.message || 'Unable to update metro preferences.' };
  }

  return { row: null, error: 'Unable to update metro preferences.' };
}

async function listMetroAreasFallback(input: {
  query?: string;
  countryCode?: string;
  limit: number;
  offset: number;
}): Promise<{ metros: MetroArea[]; error?: string }> {
  const normalizedCountry = input.countryCode?.trim().toUpperCase();
  const queryText = input.query?.trim();

  let baseQuery = supabase
    .from('us_metro_areas')
    .select('id,display_city,metro_name,state_code,country_code,latitude,longitude,population')
    .eq('is_active', true);

  if (normalizedCountry) {
    baseQuery = baseQuery.eq('country_code', normalizedCountry);
  }

  if (queryText) {
    baseQuery = baseQuery.ilike('display_city', `%${queryText}%`);
  }

  const { data, error } = await baseQuery
    .order('population', { ascending: false })
    .order('display_city', { ascending: true })
    .range(input.offset, input.offset + input.limit - 1);

  if (!error) {
    const rows = Array.isArray(data) ? data : [];
    return {
      metros: rows
        .map((row) => normalizeMetroAreaRecord(row as Record<string, unknown>))
        .filter((metro) => metro.id.length > 0),
    };
  }

  if (queryText) {
    let metroNameQuery = supabase
      .from('us_metro_areas')
      .select('id,display_city,metro_name,state_code,country_code,latitude,longitude,population')
      .eq('is_active', true);

    if (normalizedCountry) {
      metroNameQuery = metroNameQuery.eq('country_code', normalizedCountry);
    }

    const { data: byMetroNameData, error: byMetroNameError } = await metroNameQuery
      .ilike('metro_name', `%${queryText}%`)
      .order('population', { ascending: false })
      .order('display_city', { ascending: true })
      .range(input.offset, input.offset + input.limit - 1);

    if (!byMetroNameError) {
      const rows = Array.isArray(byMetroNameData) ? byMetroNameData : [];
      return {
        metros: rows
          .map((row) => normalizeMetroAreaRecord(row as Record<string, unknown>))
          .filter((metro) => metro.id.length > 0),
      };
    }
  }

  return { metros: [], error: error.message || 'Unable to load metro areas.' };
}

async function updateMetroPreferencesFallback(input: {
  mode: MetroSelectionMode;
  manualMetroAreaId?: string | null;
  defaultMetroAreaId?: string | null;
}): Promise<{ preferences: MetroPreferences | null; error?: string }> {
  const { row: currentRow, error: currentRowError } = await getCurrentProfileMetroRow();
  if (currentRowError) {
    return { preferences: null, error: currentRowError };
  }

  const row = currentRow || {};
  const nowIso = new Date().toISOString();
  const currentAutoMetro = toOptionalString(row.auto_metro_area_id);
  let nextManualMetro = toOptionalString(row.manual_metro_area_id);
  let nextDefaultMetro = toOptionalString(row.default_metro_area_id);

  if (input.manualMetroAreaId !== undefined) {
    nextManualMetro = input.manualMetroAreaId;
  }
  if (input.defaultMetroAreaId !== undefined) {
    nextDefaultMetro = input.defaultMetroAreaId;
  }

  if (input.mode === 'manual' && !nextManualMetro) {
    return { preferences: null, error: 'Manual mode requires selecting a metro area first.' };
  }
  if (input.mode === 'default' && !nextDefaultMetro) {
    return { preferences: null, error: 'Default mode requires selecting a metro area first.' };
  }

  const effectiveMetroAreaId = (() => {
    if (input.mode === 'manual') return nextManualMetro;
    if (input.mode === 'default') return nextDefaultMetro;
    return currentAutoMetro || toOptionalString(row.metro_area_id);
  })();

  const updates: Record<string, unknown> = {
    metro_selection_mode: input.mode,
    metro_selection_updated_at: nowIso,
    updated_at: nowIso,
    manual_metro_area_id: nextManualMetro,
    default_metro_area_id: nextDefaultMetro,
  };

  if (effectiveMetroAreaId) {
    const { data: metroRow } = await supabase
      .from('us_metro_areas')
      .select('id,display_city,state_code,country_code')
      .eq('id', effectiveMetroAreaId)
      .maybeSingle();

    const metroRecord = (metroRow || {}) as Record<string, unknown>;
    updates.metro_area_id = effectiveMetroAreaId;
    updates.metro_area_name = toOptionalString(metroRecord.display_city);
    updates.metro_city = toOptionalString(metroRecord.display_city);
    updates.metro_state = toOptionalString(metroRecord.state_code);
    updates.metro_country = toOptionalString(metroRecord.country_code);
  }

  const { row: updatedRow, error: updateError } = await updateCurrentProfileMetroRow(updates);
  if (updateError) {
    return { preferences: null, error: updateError };
  }

  const normalized = normalizeMetroPreferencesFromProfileRow((updatedRow || row) as Record<string, unknown>);
  return { preferences: normalized };
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
  countryCodeOrOptions?: string | { countryCode?: string; mode?: PlaceSearchMode }
): Promise<SearchPlacesResult> {
  try {
    if (!query || query.trim().length < 2) {
      return { predictions: [] };
    }

    const options = typeof countryCodeOrOptions === 'string'
      ? { countryCode: countryCodeOrOptions, mode: 'city' as const }
      : {
        countryCode: countryCodeOrOptions?.countryCode,
        mode: countryCodeOrOptions?.mode || 'city',
      };

    const { data, error } = await supabase.functions.invoke('places-autocomplete', {
      body: {
        query,
        countryCode: options.countryCode,
        mode: options.mode,
      },
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
  return getPlaceDetailsWithMode(placeId, 'city');
}

export async function getPlaceDetailsWithMode(
  placeId: string,
  mode: PlaceSearchMode,
): Promise<GetPlaceDetailsResult> {
  try {
    if (!placeId) {
      return { details: null, error: 'Place ID is required' };
    }

    const { data, error } = await supabase.functions.invoke('places-details', {
      body: { placeId, mode },
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

export async function searchMeetupPlaces(
  query: string,
  countryCode?: string,
): Promise<SearchPlacesResult> {
  return searchPlaces(query, {
    countryCode,
    mode: 'meetup',
  });
}

export async function getMeetupPlaceDetails(placeId: string): Promise<GetPlaceDetailsResult> {
  return getPlaceDetailsWithMode(placeId, 'meetup');
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
    const rpcVariants: Array<Record<string, unknown>> = [
      {
        p_query: query ?? null,
        p_country_code: countryCode ?? null,
        p_limit: limit,
        p_offset: offset,
      },
      {
        p_search_query: query ?? null,
        p_country_code: countryCode ?? null,
        p_limit: limit,
        p_offset: offset,
      },
      {
        p_query: query ?? null,
        p_country: countryCode ?? null,
        p_limit: limit,
        p_offset: offset,
      },
    ];

    let lastRpcError: QueryError | null = null;
    for (const payload of rpcVariants) {
      const { data, error } = await supabase.rpc('list_metro_areas_v1', payload);
      if (!error) {
        const rows = Array.isArray(data) ? data : [];
        return {
          metros: rows
            .map((row) => normalizeMetroAreaRecord(row as Record<string, unknown>))
            .filter((metro) => metro.id.length > 0),
        };
      }

      lastRpcError = error;
      if (!isMissingRpc(error, 'list_metro_areas_v1')) {
        break;
      }
    }

    const fallback = await listMetroAreasFallback({
      query,
      countryCode,
      limit,
      offset,
    });
    if (!fallback.error || fallback.metros.length > 0) {
      return fallback;
    }

    return { metros: [], error: lastRpcError?.message || fallback.error || 'Unable to load metro areas.' };
  } catch (err) {
    const fallback = await listMetroAreasFallback({
      query,
      countryCode,
      limit,
      offset,
    });
    if (!fallback.error || fallback.metros.length > 0) {
      return fallback;
    }
    return { metros: [], error: fallback.error || 'Unable to load metro areas.' };
  }
}

export async function getMetroPreferences(): Promise<{
  preferences: MetroPreferences | null;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_current_metro_preferences_v1');
    if (error && !isMissingRpc(error, 'get_current_metro_preferences_v1')) {
      return { preferences: null, error: error.message || 'Unable to load metro preferences.' };
    }

    if (!error) {
      return { preferences: normalizeMetroPreferences(data) };
    }

    const { row, error: fallbackError } = await getCurrentProfileMetroRow();
    if (fallbackError) {
      return { preferences: null, error: fallbackError };
    }
    if (!row) {
      return { preferences: null };
    }

    return { preferences: normalizeMetroPreferencesFromProfileRow(row) };
  } catch (err) {
    const { row, error: fallbackError } = await getCurrentProfileMetroRow();
    if (fallbackError) {
      return { preferences: null, error: fallbackError };
    }
    if (!row) {
      return { preferences: null };
    }

    return { preferences: normalizeMetroPreferencesFromProfileRow(row) };
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

    if (error && !isMissingRpc(error, 'update_metro_preferences_v1')) {
      return { preferences: null, error: error.message || 'Unable to update metro preferences.' };
    }

    if (!error) {
      const preferences = normalizeMetroPreferences(data);
      return { preferences };
    }

    return updateMetroPreferencesFallback(input);
  } catch (err) {
    return updateMetroPreferencesFallback(input);
  }
}
