/**
 * useLocation Hook
 * Handles device location detection and permission management
 */

import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { Linking, Platform, Alert } from 'react-native';
import type { LocationData, LocationPermissionStatus } from '../types/location';

interface UseLocationState {
  isDetecting: boolean;
  permissionStatus: LocationPermissionStatus;
  error: string | null;
}

interface UseLocationReturn extends UseLocationState {
  detectLocation: () => Promise<LocationData | null>;
  checkPermission: () => Promise<LocationPermissionStatus>;
  requestPermission: () => Promise<LocationPermissionStatus>;
  openSettings: () => void;
}

/**
 * Hook for managing device location detection
 */
export function useLocation(): UseLocationReturn {
  const [state, setState] = useState<UseLocationState>({
    isDetecting: false,
    permissionStatus: 'undetermined',
    error: null,
  });

  /**
   * Check current location permission status
   */
  const checkPermission = useCallback(async (): Promise<LocationPermissionStatus> => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const permissionStatus = mapPermissionStatus(status);
      setState((prev) => ({ ...prev, permissionStatus }));
      return permissionStatus;
    } catch (err) {
      console.error('Error checking location permission:', err);
      return 'undetermined';
    }
  }, []);

  /**
   * Request location permission
   */
  const requestPermission = useCallback(async (): Promise<LocationPermissionStatus> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const permissionStatus = mapPermissionStatus(status);
      setState((prev) => ({ ...prev, permissionStatus }));
      return permissionStatus;
    } catch (err) {
      console.error('Error requesting location permission:', err);
      return 'denied';
    }
  }, []);

  /**
   * Open device settings for location permissions
   */
  const openSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  /**
   * Detect current location and reverse geocode to get address
   */
  const detectLocation = useCallback(async (): Promise<LocationData | null> => {
    setState((prev) => ({ ...prev, isDetecting: true, error: null }));

    try {
      // Check/request permission
      let permission = await checkPermission();

      if (permission === 'undetermined') {
        permission = await requestPermission();
      }

      if (permission === 'denied') {
        setState((prev) => ({
          ...prev,
          isDetecting: false,
          error: 'Location permission denied',
        }));

        Alert.alert(
          'Location Permission Required',
          'Please enable location access in your device settings to use this feature.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openSettings },
          ]
        );

        return null;
      }

      // Get current position
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode using device's native geocoder (no API keys needed)
      const geocodeResults = await Location.reverseGeocodeAsync({ latitude, longitude });

      if (!geocodeResults || geocodeResults.length === 0) {
        setState((prev) => ({
          ...prev,
          isDetecting: false,
          error: 'Could not determine your location',
        }));
        return null;
      }

      const result = geocodeResults[0];

      const locationData: LocationData = {
        city: result.city || result.subregion || '',
        state: result.region || undefined,
        country: result.country || '',
        countryCode: result.isoCountryCode || '',
        coordinates: {
          latitude,
          longitude,
        },
      };

      setState((prev) => ({
        ...prev,
        isDetecting: false,
        error: null,
      }));

      return locationData;
    } catch (err) {
      console.error('Error detecting location:', err);

      let errorMessage = 'Failed to detect location';

      if (err instanceof Error) {
        if (err.message.includes('Location services are disabled')) {
          errorMessage = 'Please enable location services on your device';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'Location detection timed out. Please try again.';
        }
      }

      setState((prev) => ({
        ...prev,
        isDetecting: false,
        error: errorMessage,
      }));

      return null;
    }
  }, [checkPermission, requestPermission, openSettings]);

  return {
    ...state,
    detectLocation,
    checkPermission,
    requestPermission,
    openSettings,
  };
}

/**
 * Map expo-location permission status to our type
 */
function mapPermissionStatus(
  status: Location.PermissionStatus
): LocationPermissionStatus {
  switch (status) {
    case Location.PermissionStatus.GRANTED:
      return 'granted';
    case Location.PermissionStatus.DENIED:
      return 'denied';
    default:
      return 'undetermined';
  }
}
