/**
 * LocationPicker Component
 * Main location selection component combining country picker, city search, and auto-detect
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getCountryByCode } from '../../data/countries';
import { useLocation } from '../../hooks/useLocation';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type {
  Country,
  LocationPickerProps,
  PlaceDetails,
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
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showCitySearch, setShowCitySearch] = useState(false);

  const { isDetecting, detectLocation } = useLocation();

  const selectedCountry = value.countryCode
    ? getCountryByCode(value.countryCode)
    : null;

  const handleDetectLocation = useCallback(async () => {
    await haptics.medium();

    const location = await detectLocation();
    if (location) {
      onChange(location);
    }
  }, [detectLocation, onChange]);

  const handleCountrySelect = useCallback(
    (country: Country) => {
      onChange({
        ...value,
        country: country.name,
        countryCode: country.code,
        city: '',
        state: undefined,
        coordinates: undefined,
      });
    },
    [value, onChange],
  );

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
    [onChange],
  );

  const openCountryPicker = useCallback(async () => {
    if (disabled) return;
    await haptics.light();
    setShowCountryPicker(true);
  }, [disabled]);

  const openCitySearch = useCallback(async () => {
    if (disabled) return;
    await haptics.light();
    setShowCitySearch(true);
  }, [disabled]);

  return (
    <View style={styles.container}>
      <LocationDetectButton
        onPress={handleDetectLocation}
        isLoading={isDetecting}
        disabled={disabled}
      />

      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or enter manually</Text>
        <View style={styles.dividerLine} />
      </View>

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
              <Ionicons name="globe-outline" size={20} color={tokens.colors.text.tertiary} />
              <Text style={styles.selectorPlaceholder}>Select country</Text>
            </>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={tokens.colors.text.tertiary} />
      </TouchableOpacity>

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
              <Ionicons name="location" size={20} color={tokens.colors.primary.blue} />
              <Text style={styles.selectorValue}>{value.city}</Text>
            </>
          ) : (
            <>
              <Ionicons name="location-outline" size={20} color={tokens.colors.text.tertiary} />
              <Text style={styles.selectorPlaceholder}>Search for city</Text>
            </>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={tokens.colors.text.tertiary} />
      </TouchableOpacity>

      {value.state ? (
        <View style={styles.stateDisplay}>
          <Ionicons name="map-outline" size={18} color={tokens.colors.text.tertiary} />
          <Text style={styles.stateText}>
            {value.state}, {value.country}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={14} color={tokens.colors.status.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <CountryPicker
        visible={showCountryPicker}
        selectedCode={value.countryCode}
        onSelect={handleCountrySelect}
        onClose={() => setShowCountryPicker(false)}
      />

      <CitySearch
        visible={showCitySearch}
        countryCode={value.countryCode}
        onSelect={handleCitySelect}
        onClose={() => setShowCitySearch(false)}
      />
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
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
    borderRadius: spacing.radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
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
    flex: 1,
    gap: spacing.sm,
  },
  flag: {
    fontSize: 22,
  },
  selectorValue: {
    ...typography.presets.body,
    color: colors.text.primary,
  },
  selectorPlaceholder: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  stateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  stateText: {
    ...typography.presets.caption,
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
