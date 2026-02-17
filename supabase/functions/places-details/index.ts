/**
 * Supabase Edge Function: places-details
 * Proxies Google Place Details requests with validation and sanitized logs.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PlaceSearchMode = 'city' | 'meetup';

interface DetailsRequest {
  placeId: string;
  mode?: PlaceSearchMode;
  sessionToken?: string;
}

interface PlaceDetails {
  placeId: string;
  name: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  formattedAddress: string;
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

function normalizeMode(value: unknown): PlaceSearchMode {
  return value === 'meetup' ? 'meetup' : 'city';
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => null) as DetailsRequest | null;
    const placeId = (body?.placeId || '').trim();
    const mode = normalizeMode(body?.mode);

    if (!placeId) {
      return jsonResponse({ error: 'Place ID is required' }, 400);
    }

    if (placeId.length > 256) {
      return jsonResponse({ error: 'Invalid place ID' }, 400);
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
      console.error('places-details missing server key');
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const fields = mode === 'meetup'
      ? 'name,address_components,geometry,formatted_address,place_id'
      : 'name,address_components,geometry,formatted_address,place_id';

    const params = new URLSearchParams({
      place_id: placeId,
      fields,
      key: apiKey,
    });

    if (body?.sessionToken && body.sessionToken.trim().length <= 128) {
      params.append('sessiontoken', body.sessionToken.trim());
    }

    const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;

    const response = await fetch(googleUrl);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('places-details provider error', {
        status: data.status,
        mode,
      });
      return jsonResponse({
        error: 'Failed to get place details',
        status: data.status,
      }, 500);
    }

    const result = data.result || {};
    const addressComponents = result.address_components || [];

    let city = '';
    let state = '';
    let country = '';
    let countryCode = '';

    for (const component of addressComponents) {
      const types = component.types || [];

      if (!city && types.includes('locality')) {
        city = component.long_name;
      } else if (!state && types.includes('administrative_area_level_1')) {
        state = component.long_name;
      } else if (!country && types.includes('country')) {
        country = component.long_name;
        countryCode = component.short_name;
      }

      if (!city && types.includes('sublocality_level_1')) {
        city = component.long_name;
      }

      if (!city && types.includes('administrative_area_level_2')) {
        city = component.long_name;
      }
    }

    const details: PlaceDetails = {
      placeId,
      name: result.name || result.formatted_address || city || state || 'Selected place',
      city: city || state || '',
      state,
      country,
      countryCode,
      coordinates: {
        latitude: result.geometry?.location?.lat || 0,
        longitude: result.geometry?.location?.lng || 0,
      },
      formattedAddress: result.formatted_address || '',
    };

    return jsonResponse({ details });
  } catch {
    console.error('places-details internal error');
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
