/**
 * Supabase Edge Function: resolve-metro-area
 * Resolves user-provided city/state/country to canonical metro area labels.
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
  if (normalized.length <= 2) return normalized;
  return normalized.slice(0, 2);
}

function normalizeCountryCode(countryCode: unknown, country: unknown): string {
  const explicit = normalizeText(countryCode).toUpperCase();
  if (explicit.length === 2) return explicit;

  const countryText = normalizeText(country);
  if (countryText === 'usa' || countryText === 'us' || countryText === 'united states') {
    return 'US';
  }

  return '';
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
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
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

  if (!city || city.length < 2) {
    return jsonResponse({ error: 'City is required.' }, 400);
  }

  if (city.length > 120 || state.length > 20) {
    return jsonResponse({ error: 'Invalid location payload.' }, 400);
  }

  if (!countryCode || countryCode !== 'US') {
    return jsonResponse({
      metro: null,
      fallback: {
        city: body.city || null,
        state: body.state || null,
        country: body.country || null,
      },
      resolutionMode: 'non_us_fallback',
    });
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

  const normalizedCity = city;
  const stateForLookup = state || '';

  const byCityAndState = await supabase
    .from('us_city_metro_aliases')
    .select(`
      metro_area_id,
      source_priority,
      metro:us_metro_areas!us_city_metro_aliases_metro_area_id_fkey(
        id,
        cbsa_code,
        metro_name,
        display_city,
        state_code,
        country_code
      )
    `)
    .eq('normalized_city', normalizedCity)
    .eq('country_code', 'US')
    .eq('state_code', stateForLookup)
    .order('source_priority', { ascending: true })
    .limit(1)
    .maybeSingle();

  let resolvedRow = byCityAndState.data as Record<string, unknown> | null;

  if (!resolvedRow && !byCityAndState.error) {
    const byCityOnly = await supabase
      .from('us_city_metro_aliases')
      .select(`
        metro_area_id,
        source_priority,
        metro:us_metro_areas!us_city_metro_aliases_metro_area_id_fkey(
          id,
          cbsa_code,
          metro_name,
          display_city,
          state_code,
          country_code
        )
      `)
      .eq('normalized_city', normalizedCity)
      .eq('country_code', 'US')
      .order('source_priority', { ascending: true })
      .limit(1)
      .maybeSingle();

    resolvedRow = byCityOnly.data as Record<string, unknown> | null;
  }

  if (!resolvedRow) {
    return jsonResponse({
      metro: null,
      fallback: {
        city: body.city || null,
        state: body.state || null,
        country: body.country || null,
      },
      resolutionMode: 'us_city_fallback',
    });
  }

  const metro = (resolvedRow.metro || {}) as Record<string, unknown>;
  const metroPayload = {
    metroAreaId: typeof metro.id === 'string' ? metro.id : null,
    cbsaCode: typeof metro.cbsa_code === 'string' ? metro.cbsa_code : null,
    metroAreaName: typeof metro.display_city === 'string' ? metro.display_city : null,
    metroNameLong: typeof metro.metro_name === 'string' ? metro.metro_name : null,
    metroCity: typeof metro.display_city === 'string' ? metro.display_city : null,
    metroState: typeof metro.state_code === 'string' ? metro.state_code : null,
    metroCountry: typeof metro.country_code === 'string' ? metro.country_code : 'US',
  };

  return jsonResponse({
    metro: metroPayload,
    fallback: null,
    resolutionMode: 'metro_match',
  });
});
