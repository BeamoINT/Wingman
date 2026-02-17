import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { friendsFeatureFlags } from '../config/featureFlags';
import { runtimeEnv } from '../config/env';
import { supportsNativeMapboxMaps } from '../config/runtime';
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

const SEARCH_DEBOUNCE_MS = 220;

export const MetroMapPickerScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  const [query, setQuery] = useState('');
  const [metros, setMetros] = useState<MetroArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isMapboxTokenConfigured = runtimeEnv.mapboxAccessToken.trim().length > 0;

  const loadMetros = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    setError(null);
    const { metros: rows, error: loadError } = await listMetroAreas({
      query: searchQuery.trim() || undefined,
      limit: 120,
      offset: 0,
    });
    if (loadError) {
      setError(loadError);
      setMetros([]);
    } else {
      setMetros(rows);
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
    if (!friendsFeatureFlags.friendsMapboxPickerEnabled) {
      return {
        title: 'Map selection disabled',
        message: 'Mapbox picker is disabled by feature flag. Use the metro list below.',
      };
    }

    if (!supportsNativeMapboxMaps) {
      return {
        title: 'List fallback in this runtime',
        message: 'Map marker rendering needs a Wingman native build. Metro list selection remains fully available.',
      };
    }

    if (!isMapboxTokenConfigured) {
      return {
        title: 'Mapbox token not configured',
        message: 'Metro list fallback is active. Add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to enable map markers in native builds.',
      };
    }

    return {
      title: 'Map marker mode',
      message: 'Mapbox marker rendering is available in native builds. List selection is always available as a reliable fallback.',
    };
  }, [isMapboxTokenConfigured]);

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

              return (
                <View style={styles.metroCard}>
                  <View style={styles.metroHeader}>
                    <View style={styles.markerIconWrap}>
                      <Ionicons name="location" size={15} color={colors.accent.primary} />
                    </View>
                    <View style={styles.metroTextWrap}>
                      <Text style={styles.metroTitle}>{item.metroAreaName}</Text>
                      <Text style={styles.metroSubtitle}>
                        {subtitle || 'Global metro'}
                      </Text>
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
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: spacing.sm,
  },
  metroCard: {
    backgroundColor: colors.surface.level1,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: spacing.radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  metroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  markerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metroTextWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  metroTitle: {
    ...typography.presets.h4,
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
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
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
    ...typography.presets.buttonSmall,
    color: colors.text.onAccent,
  },
  secondaryActionText: {
    ...typography.presets.buttonSmall,
    color: colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
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
