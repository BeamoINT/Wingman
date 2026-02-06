/**
 * Supabase Edge Function: places-details
 * Proxies Google Places Details API requests to get full place information
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DetailsRequest {
  placeId: string;
}

interface PlaceDetails {
  placeId: string;
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
    const { placeId }: DetailsRequest = await req.json();

    if (!placeId) {
      return new Response(
        JSON.stringify({ error: 'Place ID is required' }),
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

    // Build the Google Places Details URL
    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'address_components,geometry,formatted_address',
      key: apiKey,
    });

    const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;

    const response = await fetch(googleUrl);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Places Details API error:', data.status, data.error_message);
      return new Response(
        JSON.stringify({
          error: 'Failed to get place details',
          status: data.status
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = data.result;
    const addressComponents = result.address_components || [];

    // Extract address components
    let city = '';
    let state = '';
    let country = '';
    let countryCode = '';

    for (const component of addressComponents) {
      const types = component.types || [];

      if (types.includes('locality')) {
        city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        state = component.long_name;
      } else if (types.includes('country')) {
        country = component.long_name;
        countryCode = component.short_name;
      }

      // Fallback for city if locality is not found
      if (!city && types.includes('sublocality_level_1')) {
        city = component.long_name;
      }
      if (!city && types.includes('administrative_area_level_2')) {
        city = component.long_name;
      }
    }

    const details: PlaceDetails = {
      placeId,
      city: city || state, // Use state as fallback if no city found
      state,
      country,
      countryCode,
      coordinates: {
        latitude: result.geometry?.location?.lat || 0,
        longitude: result.geometry?.location?.lng || 0,
      },
      formattedAddress: result.formatted_address || '',
    };

    return new Response(
      JSON.stringify({ details }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in places-details:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
