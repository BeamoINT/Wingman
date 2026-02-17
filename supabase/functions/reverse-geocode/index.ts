/**
 * Supabase Edge Function: reverse-geocode
 * Proxies Google Geocoding API with validation and basic rate limiting.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReverseGeocodeRequest {
  latitude: number;
  longitude: number;
}

interface LocationDetails {
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
    const { latitude, longitude }: ReverseGeocodeRequest = await req.json().catch(() => ({ latitude: NaN, longitude: NaN }));

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return jsonResponse({ error: 'Valid latitude and longitude are required' }, 400);
    }

    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return jsonResponse({ error: 'Coordinates out of range' }, 400);
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
      console.error('reverse-geocode missing server key');
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const params = new URLSearchParams({
      latlng: `${latitude},${longitude}`,
      result_type: 'locality|administrative_area_level_1|country',
      key: apiKey,
    });

    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;

    const response = await fetch(googleUrl);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('reverse-geocode provider error', { status: data.status });
      return jsonResponse({
        error: 'Reverse geocoding failed',
        status: data.status,
      }, 500);
    }

    if (!data.results || data.results.length === 0) {
      return jsonResponse({ error: 'No address found for this location' }, 404);
    }

    const allComponents: any[] = [];
    for (const result of data.results) {
      if (result.address_components) {
        allComponents.push(...result.address_components);
      }
    }

    let city = '';
    let state = '';
    let country = '';
    let countryCode = '';
    const formattedAddress = data.results[0]?.formatted_address || '';

    for (const component of allComponents) {
      const types = component.types || [];

      if (!city && types.includes('locality')) {
        city = component.long_name;
      }
      if (!state && types.includes('administrative_area_level_1')) {
        state = component.long_name;
      }
      if (!country && types.includes('country')) {
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

    const details: LocationDetails = {
      city: city || state,
      state,
      country,
      countryCode,
      coordinates: {
        latitude,
        longitude,
      },
      formattedAddress,
    };

    return jsonResponse({ details });
  } catch {
    console.error('reverse-geocode internal error');
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
