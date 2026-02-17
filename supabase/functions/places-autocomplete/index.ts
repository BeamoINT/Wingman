/**
 * Supabase Edge Function: places-autocomplete
 * Proxies Google Places Autocomplete API requests with request validation,
 * lightweight rate limiting, and sanitized logging.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PlaceSearchMode = 'city' | 'meetup';

interface AutocompleteRequest {
  query: string;
  countryCode?: string;
  mode?: PlaceSearchMode;
  sessionToken?: string;
}

interface Prediction {
  placeId: string;
  placeType: PlaceSearchMode;
  mainText: string;
  secondaryText: string;
  description: string;
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000;
const LIMIT_PER_WINDOW = 80;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getClientIdentifier(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  const firstIp = forwardedFor.split(',')[0]?.trim();
  if (firstIp) return `ip:${firstIp}`;

  const realIp = req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || '';
  if (realIp.trim()) return `ip:${realIp.trim()}`;

  const authHeader = req.headers.get('authorization') || '';
  return authHeader ? `auth:${authHeader.slice(-18)}` : 'anon';
}

function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(clientId);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(clientId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (existing.count >= LIMIT_PER_WINDOW) {
    return true;
  }

  existing.count += 1;
  rateLimitStore.set(clientId, existing);
  return false;
}

function normalizeMode(value: unknown): PlaceSearchMode {
  return value === 'meetup' ? 'meetup' : 'city';
}

function sanitizeCountryCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => null) as AutocompleteRequest | null;
    const query = (body?.query || '').trim();
    const countryCode = sanitizeCountryCode(body?.countryCode);
    const mode = normalizeMode(body?.mode);

    if (!query || query.length < 2) {
      return jsonResponse({ predictions: [] });
    }

    if (query.length > 140) {
      return jsonResponse({ error: 'Query is too long' }, 400);
    }

    const clientId = getClientIdentifier(req);
    if (isRateLimited(clientId)) {
      return jsonResponse({
        error: 'Too many requests. Please wait and try again.',
        code: 'rate_limited',
      }, 429);
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_SERVER_API_KEY') || Deno.env.get('GOOGLE_PLACES_API_KEY');

    if (!apiKey) {
      console.error('places-autocomplete missing server key');
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const params = new URLSearchParams({
      input: query,
      key: apiKey,
    });

    if (mode === 'city') {
      params.append('types', '(cities)');
    }

    if (countryCode) {
      params.append('components', `country:${countryCode.toLowerCase()}`);
    }

    if (body?.sessionToken && body.sessionToken.trim().length <= 128) {
      params.append('sessiontoken', body.sessionToken.trim());
    }

    const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;

    const response = await fetch(googleUrl);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('places-autocomplete provider error', {
        status: data.status,
        mode,
      });
      return jsonResponse({
        error: 'Places search failed',
        status: data.status,
      }, 500);
    }

    const predictions: Prediction[] = (data.predictions || []).map((prediction: any) => ({
      placeId: prediction.place_id,
      placeType: mode,
      mainText: prediction.structured_formatting?.main_text || prediction.description.split(',')[0],
      secondaryText: prediction.structured_formatting?.secondary_text || prediction.description.split(',').slice(1).join(',').trim(),
      description: prediction.description,
    }));

    return jsonResponse({ predictions });
  } catch (error) {
    console.error('places-autocomplete internal error');
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
