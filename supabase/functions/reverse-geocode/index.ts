/**
 * Supabase Edge Function: reverse-geocode
 * Proxies Google Geocoding API for reverse geocoding (coordinates to address)
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { latitude, longitude }: ReverseGeocodeRequest = await req.json();

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Valid latitude and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

    if (!apiKey) {
      console.error('Missing GOOGLE_PLACES_API_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the Google Geocoding URL
    const params = new URLSearchParams({
      latlng: `${latitude},${longitude}`,
      result_type: 'locality|administrative_area_level_1|country',
      key: apiKey,
    });

    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;

    const response = await fetch(googleUrl);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Geocoding API error:', data.status, data.error_message);
      return new Response(
        JSON.stringify({
          error: 'Reverse geocoding failed',
          status: data.status
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data.results || data.results.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No address found for this location' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all address components from results
    const allComponents: any[] = [];
    for (const result of data.results) {
      if (result.address_components) {
        allComponents.push(...result.address_components);
      }
    }

    // Extract address components (deduplicated by type)
    let city = '';
    let state = '';
    let country = '';
    let countryCode = '';
    let formattedAddress = data.results[0]?.formatted_address || '';

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

      // Fallbacks for city
      if (!city && types.includes('sublocality_level_1')) {
        city = component.long_name;
      }
      if (!city && types.includes('administrative_area_level_2')) {
        city = component.long_name;
      }
    }

    const details: LocationDetails = {
      city: city || state, // Use state as fallback
      state,
      country,
      countryCode,
      coordinates: {
        latitude,
        longitude,
      },
      formattedAddress,
    };

    return new Response(
      JSON.stringify({ details }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reverse-geocode:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
