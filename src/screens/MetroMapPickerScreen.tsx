import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Header,
  InlineBanner,
  Input,
  ScreenScaffold,
  SectionHeader,
} from '../components';
import { runtimeEnv } from '../config/env';
import { friendsFeatureFlags } from '../config/featureFlags';
import { supportsNativeGoogleMaps } from '../config/runtime';
import { useTheme } from '../context/ThemeContext';
import {
  listMetroAreas,
  type MetroArea,
  updateMetroPreferences,
} from '../services/api/locationApi';
import { trackEvent } from '../services/monitoring/events';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MapModule = {
  MapView: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
};

const SEARCH_DEBOUNCE_MS = 220;

function loadNativeMapModule(): MapModule | null {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const maps = require('react-native-maps');
    return {
      MapView: maps.default,
      Marker: maps.Marker,
    };
  } catch {
    return null;
  }
}

export const MetroMapPickerScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  const [query, setQuery] = useState('');
  const [metros, setMetros] = useState<MetroArea[]>([]);
  const [selectedMetroId, setSelectedMetroId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapModule = useMemo(loadNativeMapModule, []);
  const hasGoogleMapsKey = (
    runtimeEnv.googleMapsApiKey.trim().length > 0
    || runtimeEnv.googleMapsApiKeyIos.trim().length > 0
    || runtimeEnv.googleMapsApiKeyAndroid.trim().length > 0
  );

  const isGoogleMapAvailable = (
    friendsFeatureFlags.friendsGoogleMapPickerEnabled
    && supportsNativeGoogleMaps
    && hasGoogleMapsKey
    && !!mapModule
  );

  const loadMetros = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    setError(null);
    const { metros: rows, error: loadError } = await listMetroAreas({
      query: searchQuery.trim() || undefined,
      limit: 160,
      offset: 0,
    });

    if (loadError) {
      setError(loadError);
      setMetros([]);
      setSelectedMetroId(null);
    } else {
      setMetros(rows);
      setSelectedMetroId((previous) => previous || rows[0]?.id || null);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadMetros(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [loadMetros, query]);

  const onBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const applyManualMetro = async (metro: MetroArea) => {
    setIsSaving(`manual-${metro.id}`);
    const { error: updateError } = await updateMetroPreferences({
      mode: 'manual',
      manualMetroAreaId: metro.id,
    });
    setIsSaving(null);

    if (updateError) {
      setError(updateError);
      return;
    }

    trackEvent('metro_override_set', { metroAreaId: metro.id });
    navigation.goBack();
  };

  const applyDefaultMetro = async (metro: MetroArea) => {
    setIsSaving(`default-${metro.id}`);
    const { error: updateError } = await updateMetroPreferences({
      mode: 'default',
      defaultMetroAreaId: metro.id,
    });
    setIsSaving(null);

    if (updateError) {
      setError(updateError);
      return;
    }

    trackEvent('metro_default_set', { metroAreaId: metro.id });
    navigation.goBack();
  };

  const mapBanner = useMemo(() => {
    if (!friendsFeatureFlags.friendsGoogleMapPickerEnabled) {
      return {
        title: 'Map selection disabled',
        message: 'Google map marker selection is disabled by feature flag. Metro list selection is still available.',
      };
    }

    if (!supportsNativeGoogleMaps) {
      return {
        title: 'List fallback in this runtime',
        message: 'Google map marker selection needs a Wingman native build. Metro list selection remains fully available.',
      };
    }

    if (!hasGoogleMapsKey) {
      return {
        title: 'Google Maps key not configured',
        message: 'Metro list fallback is active. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS and EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID to enable map markers.',
      };
    }

    if (!mapModule) {
      return {
        title: 'Map module unavailable',
        message: 'Metro list fallback is active because native map rendering is unavailable on this platform.',
      };
    }

    return {
      title: 'Map marker mode',
      message: 'Google map marker selection is active. List selection remains available as a reliable fallback.',
    };
  }, [hasGoogleMapsKey, mapModule]);

  const selectedMetro = useMemo(
    () => metros.find((metro) => metro.id === selectedMetroId) || null,
    [metros, selectedMetroId],
  );
  const MapViewComponent = mapModule?.MapView;
  const MarkerComponent = mapModule?.Marker;

  const markerMetros = useMemo(
    () => metros.filter((metro) => metro.latitude != null && metro.longitude != null).slice(0, 500),
    [metros],
  );

  const mapRegion = useMemo(() => {
    const baseMetro = selectedMetro || markerMetros[0] || null;
    if (!baseMetro || baseMetro.latitude == null || baseMetro.longitude == null) {
      return null;
    }

    return {
      latitude: baseMetro.latitude,
      longitude: baseMetro.longitude,
      latitudeDelta: 12,
      longitudeDelta: 12,
    };
  }, [markerMetros, selectedMetro]);

  return (
    <ScreenScaffold scrollable={false} withBottomPadding={false} style={styles.container}>
      <Header title="Select Metro Area" showBack onBackPress={onBackPress} />

      <View style={styles.content}>
        <InlineBanner title={mapBanner.title} message={mapBanner.message} variant="info" />
        <SectionHeader
          title="Global metro directory"
          subtitle="Choose a metro for matching now, or save one as your default."
        />

        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search metros (city or country)"
          leftIcon="search"
        />

        {isGoogleMapAvailable && mapRegion && MapViewComponent && MarkerComponent ? (
          <View style={styles.mapWrap}>
            <MapViewComponent
              style={styles.map}
              initialRegion={mapRegion}
              region={mapRegion}
              moveOnMarkerPress
              showsCompass={false}
              showsUserLocation={false}
              toolbarEnabled={false}
            >
              {markerMetros.map((metro) => (
                <MarkerComponent
                  key={`marker-${metro.id}`}
                  coordinate={{
                    latitude: metro.latitude as number,
                    longitude: metro.longitude as number,
                  }}
                  title={metro.metroAreaName}
                  description={[metro.metroState, metro.metroCountry].filter(Boolean).join(', ')}
                  pinColor={selectedMetroId === metro.id ? colors.accent.primary : colors.text.secondary}
                  onPress={() => setSelectedMetroId(metro.id)}
                />
              ))}
            </MapViewComponent>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.accent.primary} />
            <Text style={styles.loadingText}>Loading metro areas...</Text>
          </View>
        ) : (
          <FlatList
            data={metros}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const subtitle = [item.metroState, item.metroCountry].filter(Boolean).join(', ');
              const isManualSaving = isSaving === `manual-${item.id}`;
              const isDefaultSaving = isSaving === `default-${item.id}`;
              const isSelected = selectedMetroId === item.id;

              return (
                <View style={[styles.metroCard, isSelected && styles.metroCardSelected]}>
                  <View style={styles.metroHeader}>
                    <View style={styles.markerIconWrap}>
                      <Ionicons name="location" size={15} color={colors.accent.primary} />
                    </View>
                    <View style={styles.metroTextWrap}>
                      <Text style={styles.metroTitle}>{item.metroAreaName}</Text>
                      <Text style={styles.metroSubtitle}>{subtitle || 'Global metro'}</Text>
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.primaryAction]}
                      onPress={() => {
                        void applyManualMetro(item);
                      }}
                      disabled={isManualSaving || isDefaultSaving}
                    >
                      {isManualSaving ? (
                        <ActivityIndicator color={colors.text.onAccent} size="small" />
                      ) : (
                        <>
                          <Ionicons name="flash-outline" size={14} color={colors.text.onAccent} />
                          <Text style={styles.primaryActionText}>Use for matching now</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.secondaryAction]}
                      onPress={() => {
                        void applyDefaultMetro(item);
                      }}
                      disabled={isManualSaving || isDefaultSaving}
                    >
                      {isDefaultSaving ? (
                        <ActivityIndicator color={colors.text.primary} size="small" />
                      ) : (
                        <>
                          <Ionicons name="bookmark-outline" size={14} color={colors.text.secondary} />
                          <Text style={styles.secondaryActionText}>Set as default</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={(
              <View style={styles.emptyState}>
                <Ionicons name="globe-outline" size={40} color={colors.text.tertiary} />
                <Text style={styles.emptyTitle}>No metros found</Text>
                <Text style={styles.emptySubtitle}>
                  Try a different search term.
                </Text>
              </View>
            )}
          />
        )}

        {error ? (
          <InlineBanner title="Unable to update metro preferences" message={error} variant="error" />
        ) : null}
      </View>
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface.level0,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  mapWrap: {
    overflow: 'hidden',
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    height: 220,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  loadingText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  separator: {
    height: spacing.sm,
  },
  metroCard: {
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  metroCardSelected: {
    borderColor: colors.accent.primary,
  },
  metroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  markerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.surface.level2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metroTextWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  metroTitle: {
    ...typography.presets.bodyMedium,
    color: colors.text.primary,
  },
  metroSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  primaryAction: {
    backgroundColor: colors.accent.primary,
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level2,
  },
  primaryActionText: {
    ...typography.presets.caption,
    color: colors.text.onAccent,
  },
  secondaryActionText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  emptySubtitle: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
});
