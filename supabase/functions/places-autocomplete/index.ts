/**
 * Supabase Edge Function: places-autocomplete
 * Proxies Google Places Autocomplete API requests
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutocompleteRequest {
  query: string;
  countryCode?: string;
}

interface Prediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, countryCode }: AutocompleteRequest = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ predictions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Build the Google Places Autocomplete URL
    const params = new URLSearchParams({
      input: query,
      types: '(cities)',
      key: apiKey,
    });

    // Add country filter if provided
    if (countryCode) {
      params.append('components', `country:${countryCode.toLowerCase()}`);
    }

    const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;

    const response = await fetch(googleUrl);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status, data.error_message);
      return new Response(
        JSON.stringify({
          error: 'Places search failed',
          status: data.status
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform the response to our format
    const predictions: Prediction[] = (data.predictions || []).map((prediction: any) => ({
      placeId: prediction.place_id,
      mainText: prediction.structured_formatting?.main_text || prediction.description.split(',')[0],
      secondaryText: prediction.structured_formatting?.secondary_text || prediction.description.split(',').slice(1).join(',').trim(),
      description: prediction.description,
    }));

    return new Response(
      JSON.stringify({ predictions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in places-autocomplete:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
