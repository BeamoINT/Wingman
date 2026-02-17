/**
 * Supabase Edge Function: resolve-metro-area
 * Resolves user-provided city/state/country into canonical metro labels.
 * Supports alias match first, then nearest-metro fallback globally.
 * Never logs raw location payloads.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ResolveRequest = {
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
};

type MetroRecord = {
  id: string;
  cbsa_code?: string | null;
  metro_name?: string | null;
  display_city?: string | null;
  state_code?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type AliasRecord = {
  state_code?: string | null;
  normalized_state?: string | null;
  source_priority?: number | null;
  metro?: MetroRecord | MetroRecord[] | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeState(value: unknown): string {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) return '';
  return normalized.slice(0, 16);
}

function normalizeCountryCode(countryCode: unknown, country: unknown): string {
  const explicit = normalizeText(countryCode).toUpperCase();
  if (explicit.length === 2) {
    return explicit;
  }

  const countryText = normalizeText(country);
  if (!countryText) return '';

  const COUNTRY_MAP: Record<string, string> = {
    usa: 'US',
    us: 'US',
    'united states': 'US',
    uk: 'GB',
    'united kingdom': 'GB',
  };

  return COUNTRY_MAP[countryText] || '';
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function toMetroPayload(metro: MetroRecord | null, distanceKm?: number | null) {
  if (!metro) return null;

  return {
    metroAreaId: metro.id || null,
    cbsaCode: typeof metro.cbsa_code === 'string' ? metro.cbsa_code : null,
    metroAreaName: typeof metro.display_city === 'string' ? metro.display_city : null,
    metroNameLong: typeof metro.metro_name === 'string' ? metro.metro_name : null,
    metroCity: typeof metro.display_city === 'string' ? metro.display_city : null,
    metroState: typeof metro.state_code === 'string' ? metro.state_code : null,
    metroCountry: typeof metro.country_code === 'string' ? metro.country_code : null,
    distanceKm: typeof distanceKm === 'number' ? Number(distanceKm.toFixed(2)) : null,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = (
    Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180)
    * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLon / 2) ** 2
  );
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeLocation(
  body: ResolveRequest,
): Promise<{ latitude: number; longitude: number } | null> {
  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) return null;

  const segments = [body.city, body.state, body.country]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);

  if (segments.length === 0) return null;

  const address = segments.join(', ');
  const params = new URLSearchParams({
    address,
    key: apiKey,
  });

  const geocodeResponse = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
  if (!geocodeResponse.ok) {
    return null;
  }

  const geocodeData = await geocodeResponse.json().catch(() => null) as Record<string, unknown> | null;
  if (!geocodeData || geocodeData.status !== 'OK') {
    return null;
  }

  const firstResult = Array.isArray(geocodeData.results) ? geocodeData.results[0] : null;
  const location = firstResult && typeof firstResult === 'object'
    ? (firstResult as Record<string, unknown>).geometry as Record<string, unknown> | undefined
    : undefined;
  const point = location && typeof location === 'object'
    ? (location.location as Record<string, unknown> | undefined)
    : undefined;

  const latitude = typeof point?.lat === 'number' ? point.lat : null;
  const longitude = typeof point?.lng === 'number' ? point.lng : null;

  if (latitude == null || longitude == null) {
    return null;
  }

  return { latitude, longitude };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\\s+/i, '').trim();
  if (!token) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.id) {
    return jsonResponse({ error: 'Invalid auth token' }, 401);
  }

  const body = await req.json().catch(() => ({})) as ResolveRequest;
  const city = normalizeText(body.city);
  const state = normalizeState(body.state);
  const countryCode = normalizeCountryCode(body.countryCode, body.country);
  const latitudeInput = toFiniteNumber(body.latitude);
  const longitudeInput = toFiniteNumber(body.longitude);

  if (!city || city.length < 2) {
    return jsonResponse({ error: 'City is required.' }, 400);
  }

  if (city.length > 120 || state.length > 24) {
    return jsonResponse({ error: 'Invalid location payload.' }, 400);
  }

  const { data: me, error: meError } = await supabase
    .from('profiles')
    .select('metro_resolved_at')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (!meError && me?.metro_resolved_at) {
    const lastResolvedAt = Date.parse(String(me.metro_resolved_at));
    if (!Number.isNaN(lastResolvedAt) && Date.now() - lastResolvedAt < 2000) {
      return jsonResponse({
        metro: null,
        fallback: {
          city: body.city || null,
          state: body.state || null,
          country: body.country || null,
        },
        resolutionMode: 'rate_limited',
      }, 429);
    }
  }

  if (countryCode) {
    const aliasQuery = supabase
      .from('us_city_metro_aliases')
      .select(`
        state_code,
        normalized_state,
        source_priority,
        metro:us_metro_areas!us_city_metro_aliases_metro_area_id_fkey(
          id,
          cbsa_code,
          metro_name,
          display_city,
          state_code,
          country_code,
          latitude,
          longitude
        )
      `)
      .eq('normalized_city', city)
      .eq('country_code', countryCode)
      .order('source_priority', { ascending: true })
      .limit(50);

    const { data: aliasRows, error: aliasError } = await aliasQuery;
    if (!aliasError && Array.isArray(aliasRows) && aliasRows.length > 0) {
      const normalizedState = state.toUpperCase();
      const bestAlias = aliasRows.find((row) => {
        if (!normalizedState) return false;
        const rowRecord = row as AliasRecord;
        const rowState = String(rowRecord.state_code || '').toUpperCase();
        const rowNormalizedState = String(rowRecord.normalized_state || '').toUpperCase();
        return rowState === normalizedState || rowNormalizedState === normalizedState;
      }) || aliasRows[0];

      const bestAliasRecord = bestAlias as AliasRecord;
      const metroRaw = Array.isArray(bestAliasRecord.metro)
        ? bestAliasRecord.metro[0]
        : bestAliasRecord.metro;
      const metro = metroRaw && typeof metroRaw === 'object' ? metroRaw as MetroRecord : null;

      if (metro?.id) {
        return jsonResponse({
          metro: toMetroPayload(metro),
          fallback: null,
          resolutionMode: 'metro_match_alias',
        });
      }
    }
  }

  let latitude = latitudeInput;
  let longitude = longitudeInput;
  let usedGeocodeFallback = false;

  if (latitude == null || longitude == null) {
    const geocoded = await geocodeLocation(body);
    if (geocoded) {
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      usedGeocodeFallback = true;
    }
  }

  if (latitude == null || longitude == null) {
    return jsonResponse({
      metro: null,
      fallback: {
        city: body.city || null,
        state: body.state || null,
        country: body.country || null,
      },
      resolutionMode: 'fallback_no_match',
    });
  }

  const metroLookup = supabase
    .from('us_metro_areas')
    .select('id,cbsa_code,metro_name,display_city,state_code,country_code,latitude,longitude')
    .eq('is_active', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(1500);

  if (countryCode) {
    metroLookup.eq('country_code', countryCode);
  }

  const { data: metros, error: metroError } = await metroLookup;
  if (metroError || !Array.isArray(metros) || metros.length === 0) {
    return jsonResponse({
      metro: null,
      fallback: {
        city: body.city || null,
        state: body.state || null,
        country: body.country || null,
      },
      resolutionMode: 'fallback_no_match',
    });
  }

  let nearest: { metro: MetroRecord; distanceKm: number } | null = null;
  for (const entry of metros) {
    const metro = entry as MetroRecord;
    if (typeof metro.latitude !== 'number' || typeof metro.longitude !== 'number') {
      continue;
    }

    const distanceKm = haversineKm(latitude, longitude, metro.latitude, metro.longitude);
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { metro, distanceKm };
    }
  }

  if (!nearest || !nearest.metro.id) {
    return jsonResponse({
      metro: null,
      fallback: {
        city: body.city || null,
        state: body.state || null,
        country: body.country || null,
      },
      resolutionMode: 'fallback_no_match',
    });
  }

  return jsonResponse({
    metro: toMetroPayload(nearest.metro, nearest.distanceKm),
    fallback: null,
    resolutionMode: usedGeocodeFallback ? 'non_metro_city_nearest' : 'metro_match_nearest',
  });
});
