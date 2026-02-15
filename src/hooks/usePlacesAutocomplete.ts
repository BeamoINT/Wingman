/**
 * usePlacesAutocomplete Hook
 * Handles city search with Google Places Autocomplete via Supabase Edge Functions
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getPlaceDetails, searchPlaces } from '../services/api/locationApi';
import type { PlaceDetails, PlacePrediction } from '../types/location';

interface UsePlacesAutocompleteState {
  predictions: PlacePrediction[];
  isSearching: boolean;
  isLoadingDetails: boolean;
  error: string | null;
}

interface UsePlacesAutocompleteReturn extends UsePlacesAutocompleteState {
  search: (query: string) => void;
  selectPlace: (placeId: string) => Promise<PlaceDetails | null>;
  clearPredictions: () => void;
}

interface UsePlacesAutocompleteOptions {
  /** Country code to restrict search results (e.g., "US") */
  countryCode?: string;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
}

/**
 * Hook for searching cities with Google Places Autocomplete
 */
export function usePlacesAutocomplete(
  options: UsePlacesAutocompleteOptions = {}
): UsePlacesAutocompleteReturn {
  const { countryCode, debounceMs = 300 } = options;

  const [state, setState] = useState<UsePlacesAutocompleteState>({
    predictions: [],
    isSearching: false,
    isLoadingDetails: false,
    error: null,
  });

  // Track current search to cancel stale requests
  const searchIdRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Search for places with debouncing
   */
  const search = useCallback(
    (query: string) => {
      // Clear any existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // If query is empty or too short, clear results
      if (!query || query.trim().length < 2) {
        setState((prev) => ({
          ...prev,
          predictions: [],
          isSearching: false,
          error: null,
        }));
        return;
      }

      // Set searching state immediately for UI feedback
      setState((prev) => ({ ...prev, isSearching: true, error: null }));

      // Debounce the actual search
      debounceTimerRef.current = setTimeout(async () => {
        const currentSearchId = ++searchIdRef.current;

        try {
          const { predictions, error } = await searchPlaces(query, countryCode);

          // Only update if this is still the current search
          if (currentSearchId === searchIdRef.current) {
            setState((prev) => ({
              ...prev,
              predictions: error ? [] : predictions,
              isSearching: false,
              error: error || null,
            }));
          }
        } catch (err) {
          if (currentSearchId === searchIdRef.current) {
            setState((prev) => ({
              ...prev,
              predictions: [],
              isSearching: false,
              error: 'Search failed',
            }));
          }
        }
      }, debounceMs);
    },
    [countryCode, debounceMs]
  );

  /**
   * Get full details for a selected place
   */
  const selectPlace = useCallback(
    async (placeId: string): Promise<PlaceDetails | null> => {
      if (!placeId) {
        return null;
      }

      setState((prev) => ({ ...prev, isLoadingDetails: true, error: null }));

      try {
        const { details, error } = await getPlaceDetails(placeId);

        setState((prev) => ({
          ...prev,
          isLoadingDetails: false,
          predictions: [], // Clear predictions after selection
          error: error || null,
        }));

        return details;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isLoadingDetails: false,
          error: 'Failed to get place details',
        }));
        return null;
      }
    },
    []
  );

  /**
   * Clear all predictions
   */
  const clearPredictions = useCallback(() => {
    setState((prev) => ({
      ...prev,
      predictions: [],
      error: null,
    }));
  }, []);

  return {
    ...state,
    search,
    selectPlace,
    clearPredictions,
  };
}
