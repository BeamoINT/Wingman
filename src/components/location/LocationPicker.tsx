/**
 * LocationPicker Component
 * Main location selection component combining country picker, city search, and auto-detect
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
    StyleSheet, Text,
    TouchableOpacity, View
} from 'react-native';
import { getCountryByCode } from '../../data/countries';
import { useLocation } from '../../hooks/useLocation';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type {
    Country, LocationPickerProps, PlaceDetails
} from '../../types/location';
import { haptics } from '../../utils/haptics';
import { CitySearch } from './CitySearch';
import { CountryPicker } from './CountryPicker';
import { LocationDetectButton } from './LocationDetectButton';

export const LocationPicker: React.FC<LocationPickerProps> = ({
  value,
  onChange,
  error,
  disabled = false,
}) => {
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showCitySearch, setShowCitySearch] = useState(false);

  const { isDetecting, detectLocation } = useLocation();

  // Get the selected country data
  const selectedCountry = value.countryCode
    ? getCountryByCode(value.countryCode)
    : null;

  /**
   * Handle auto-detect location
   */
  const handleDetectLocation = useCallback(async () => {
    await haptics.medium();

    const location = await detectLocation();

    if (location) {
      onChange(location);
    }
  }, [detectLocation, onChange]);

  /**
   * Handle country selection
   */
  const handleCountrySelect = useCallback(
    (country: Country) => {
      onChange({
        ...value,
        country: country.name,
        countryCode: country.code,
        // Clear city when country changes
        city: '',
        state: undefined,
        coordinates: undefined,
      });
    },
    [value, onChange]
  );

  /**
   * Handle city selection
   */
  const handleCitySelect = useCallback(
    (details: PlaceDetails) => {
      onChange({
        city: details.city,
        state: details.state,
        country: details.country,
        countryCode: details.countryCode,
        coordinates: details.coordinates,
      });
    },
    [onChange]
  );

  /**
   * Open country picker
   */
  const openCountryPicker = useCallback(async () => {
    if (disabled) return;
    await haptics.light();
    setShowCountryPicker(true);
  }, [disabled]);

  /**
   * Open city search
   */
  const openCitySearch = useCallback(async () => {
    if (disabled) return;
    await haptics.light();
    setShowCitySearch(true);
  }, [disabled]);

  return (
    <View style={styles.container}>
      {/* Auto-detect Button */}
      <LocationDetectButton
        onPress={handleDetectLocation}
        isLoading={isDetecting}
        disabled={disabled}
      />

      {/* Divider */}
      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or enter manually</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Country Selector */}
      <TouchableOpacity
        style={[
          styles.selectorButton,
          disabled && styles.selectorDisabled,
          error && styles.selectorError,
        ]}
        onPress={openCountryPicker}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <View style={styles.selectorContent}>
          {selectedCountry ? (
            <>
              <Text style={styles.flag}>{selectedCountry.flag}</Text>
              <Text style={styles.selectorValue}>{selectedCountry.name}</Text>
            </>
          ) : (
            <>
              <Ionicons
                name="globe-outline"
                size={20}
                color={colors.text.tertiary}
              />
              <Text style={styles.selectorPlaceholder}>Select country</Text>
            </>
          )}
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.text.tertiary}
        />
      </TouchableOpacity>

      {/* City Selector */}
      <TouchableOpacity
        style={[
          styles.selectorButton,
          disabled && styles.selectorDisabled,
          error && styles.selectorError,
        ]}
        onPress={openCitySearch}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <View style={styles.selectorContent}>
          {value.city ? (
            <>
              <Ionicons
                name="location"
                size={20}
                color={colors.primary.blue}
              />
              <Text style={styles.selectorValue}>{value.city}</Text>
            </>
          ) : (
            <>
              <Ionicons
                name="location-outline"
                size={20}
                color={colors.text.tertiary}
              />
              <Text style={styles.selectorPlaceholder}>Search for city</Text>
            </>
          )}
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.text.tertiary}
        />
      </TouchableOpacity>

      {/* State/Region Display (read-only) */}
      {value.state && (
        <View style={styles.stateDisplay}>
          <Ionicons
            name="map-outline"
            size={18}
            color={colors.text.tertiary}
          />
          <Text style={styles.stateText}>
            {value.state}, {value.country}
          </Text>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={14} color={colors.status.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Country Picker Modal */}
      <CountryPicker
        visible={showCountryPicker}
        selectedCode={value.countryCode}
        onSelect={handleCountrySelect}
        onClose={() => setShowCountryPicker(false)}
      />

      {/* City Search Modal */}
      <CitySearch
        visible={showCitySearch}
        countryCode={value.countryCode}
        onSelect={handleCitySelect}
        onClose={() => setShowCitySearch(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  dividerText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    paddingHorizontal: spacing.md,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.inputPadding,
    marginBottom: spacing.md,
  },
  selectorDisabled: {
    opacity: 0.5,
  },
  selectorError: {
    borderColor: colors.status.error,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  flag: {
    fontSize: 24,
  },
  selectorValue: {
    ...typography.presets.body,
    color: colors.text.primary,
    flex: 1,
  },
  selectorPlaceholder: {
    ...typography.presets.body,
    color: colors.text.tertiary,
    flex: 1,
  },
  stateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.inputPadding,
    backgroundColor: colors.primary.blueSoft,
    borderRadius: spacing.radius.md,
    marginBottom: spacing.md,
  },
  stateText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.presets.caption,
    color: colors.status.error,
  },
});
