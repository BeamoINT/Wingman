/**
 * Location API Service
 * Handles location search and geocoding via Supabase Edge Functions
 */

import type { PlaceDetails, PlacePrediction } from '../../types/location';
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
