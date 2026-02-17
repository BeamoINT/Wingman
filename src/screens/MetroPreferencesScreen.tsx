import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Card,
  Header,
  InlineBanner,
  PillTabs,
  ScreenScaffold,
  SectionHeader,
} from '../components';
import { useTheme } from '../context/ThemeContext';
import {
  getMetroPreferences,
  type MetroPreferences,
  type MetroSelectionMode,
  updateMetroPreferences,
} from '../services/api/locationApi';
import { trackEvent } from '../services/monitoring/events';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MODE_ITEMS = [
  { id: 'auto', label: 'Auto' },
  { id: 'manual', label: 'Manual' },
  { id: 'default', label: 'Default' },
] as const;

function metroLabel(preferences: MetroPreferences | null): string {
  if (!preferences?.effectiveMetroAreaName) {
    return 'Not set yet';
  }

  const pieces = [
    preferences.effectiveMetroAreaName,
    preferences.effectiveMetroState,
    preferences.effectiveMetroCountry,
  ].filter(Boolean);

  return pieces.join(', ');
}

export const MetroPreferencesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  const [preferences, setPreferences] = useState<MetroPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { preferences: loaded, error: loadError } = await getMetroPreferences();
    if (loadError) {
      setError(loadError);
    }
    setPreferences(loaded);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPreferences();
    }, [loadPreferences]),
  );

  const activeMode = useMemo<MetroSelectionMode>(() => {
    if (!preferences) return 'auto';
    return preferences.mode;
  }, [preferences]);

  const onBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const applyModeChange = useCallback(async (
    mode: MetroSelectionMode,
    manualMetroAreaId?: string | null,
    defaultMetroAreaId?: string | null,
  ) => {
    setIsSaving(true);
    const { preferences: updated, error: updateError } = await updateMetroPreferences({
      mode,
      manualMetroAreaId,
      defaultMetroAreaId,
    });

    if (updateError) {
      setError(updateError);
    } else if (updated) {
      setPreferences(updated);
      if (mode === 'auto') {
        trackEvent('metro_auto_mode_enabled');
      } else if (mode === 'manual' && updated.manualMetroAreaId) {
        trackEvent('metro_override_set', { metroAreaId: updated.manualMetroAreaId });
      } else if (mode === 'default' && updated.defaultMetroAreaId) {
        trackEvent('metro_default_set', { metroAreaId: updated.defaultMetroAreaId });
      }
    }
    setIsSaving(false);
  }, []);

  const onChangeMode = useCallback(async (nextMode: string) => {
    if (nextMode !== 'auto' && nextMode !== 'manual' && nextMode !== 'default') {
      return;
    }

    if (nextMode === activeMode) {
      return;
    }

    await haptics.selection();

    if (nextMode === 'manual' && !preferences?.manualMetroAreaId) {
      navigation.navigate('MetroMapPicker');
      return;
    }

    if (nextMode === 'default' && !preferences?.defaultMetroAreaId) {
      navigation.navigate('MetroMapPicker');
      return;
    }

    await applyModeChange(nextMode, preferences?.manualMetroAreaId, preferences?.defaultMetroAreaId);
  }, [activeMode, applyModeChange, navigation, preferences]);

  return (
    <ScreenScaffold scrollable withBottomPadding contentContainerStyle={styles.content}>
      <Header title="Metro Preferences" showBack onBackPress={onBackPress} />

      <Card variant="outlined" style={styles.statusCard}>
        <SectionHeader
          title="Current matching metro"
          subtitle="Friend recommendations prioritize your effective metro area."
        />
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.accent.primary} size="small" />
            <Text style={styles.loadingText}>Loading your metro preferences...</Text>
          </View>
        ) : (
          <View style={styles.currentMetroRow}>
            <View style={styles.metroIconWrap}>
              <Ionicons name="location" size={18} color={colors.accent.primary} />
            </View>
            <View style={styles.currentMetroTextWrap}>
              <Text style={styles.currentMetroLabel}>{metroLabel(preferences)}</Text>
              <Text style={styles.currentMetroMode}>
                Mode: {activeMode.charAt(0).toUpperCase() + activeMode.slice(1)}
              </Text>
            </View>
          </View>
        )}
      </Card>

      <Card variant="outlined">
        <SectionHeader
          title="Selection mode"
          subtitle="Manual mode always overrides automatic metro resolution."
        />
        <PillTabs
          items={MODE_ITEMS.map((item) => ({ id: item.id, label: item.label }))}
          activeId={activeMode}
          onChange={(id) => {
            void onChangeMode(id);
          }}
        />
        <InlineBanner
          title="Privacy protection"
          message="Wingman matching stores coarse metro areas only. Exact coordinates are never persisted."
          variant="info"
        />
      </Card>

      <Card variant="outlined" style={styles.actionsCard}>
        <SectionHeader title="Manage metros" />
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('MetroMapPicker')}
          disabled={isSaving}
        >
          <Ionicons name="map-outline" size={16} color={colors.accent.primary} />
          <Text style={styles.actionButtonText}>Choose metro on map/list</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          disabled={isSaving}
          onPress={() => {
            void applyModeChange('auto', null, preferences?.defaultMetroAreaId);
          }}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.text.secondary} />
          <Text style={styles.actionButtonText}>Use automatic metro detection</Text>
        </TouchableOpacity>
      </Card>

      {error ? (
        <InlineBanner title="Unable to update metro preferences" message={error} variant="error" />
      ) : null}
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.massive,
  },
  statusCard: {
    gap: spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  currentMetroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metroIconWrap: {
    width: 34,
    height: 34,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentMetroTextWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  currentMetroLabel: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  currentMetroMode: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  actionsCard: {
    gap: spacing.sm,
  },
  actionButton: {
    minHeight: 46,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButtonText: {
    ...typography.presets.bodyMedium,
    color: colors.text.primary,
  },
});
