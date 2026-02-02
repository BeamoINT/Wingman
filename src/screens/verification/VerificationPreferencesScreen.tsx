/**
 * VerificationPreferencesScreen
 *
 * Allows users to configure their verification-based matching preferences.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { haptics } from '../../utils/haptics';
import { Card } from '../../components';
import { useVerification } from '../../context/VerificationContext';
import { defaultVerificationPreferences } from '../../types/verification';
import type { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface PreferenceItem {
  id: keyof typeof defaultVerificationPreferences;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}

const MATCHING_PREFERENCES: PreferenceItem[] = [
  {
    id: 'requireIdVerified',
    icon: 'card',
    title: 'Only ID Verified Users',
    description: 'Only see companions who have verified their identity',
    badge: 'Recommended',
    badgeColor: colors.primary.blue,
  },
  {
    id: 'requirePremiumVerified',
    icon: 'star',
    title: 'Only Premium Verified',
    description: 'Only see premium verified companions with full verification',
    badge: 'Premium',
    badgeColor: colors.verification.premium,
  },
];

const DISPLAY_PREFERENCES: PreferenceItem[] = [
  {
    id: 'showVerificationBadges',
    icon: 'ribbon',
    title: 'Show Verification Badges',
    description: 'Display verification badges on companion profiles',
  },
];

export const VerificationPreferencesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { preferences, updatePreferences, isLoading } = useVerification();

  const [localPrefs, setLocalPrefs] = useState(defaultVerificationPreferences);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize local prefs from context
  useEffect(() => {
    if (preferences) {
      setLocalPrefs({
        requireIdVerified: preferences.requireIdVerified,
        requirePremiumVerified: preferences.requirePremiumVerified,
        showVerificationBadges: preferences.showVerificationBadges,
      });
    }
  }, [preferences]);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleToggle = async (id: keyof typeof defaultVerificationPreferences, value: boolean) => {
    await haptics.selection();

    const newPrefs = { ...localPrefs, [id]: value };
    setLocalPrefs(newPrefs);

    // Save to server
    setIsSaving(true);
    try {
      await updatePreferences({ [id]: value });
    } catch (error) {
      // Revert on error
      setLocalPrefs(localPrefs);
      console.error('Failed to save preference:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderPreferenceItem = (item: PreferenceItem, isLast: boolean) => (
    <View
      key={item.id}
      style={[styles.preferenceRow, !isLast && styles.preferenceRowBorder]}
    >
      <View style={styles.preferenceIcon}>
        <Ionicons name={item.icon} size={20} color={colors.primary.blue} />
      </View>

      <View style={styles.preferenceContent}>
        <View style={styles.titleRow}>
          <Text style={styles.preferenceTitle}>{item.title}</Text>
          {item.badge && (
            <View style={[styles.badge, { backgroundColor: `${item.badgeColor}20` }]}>
              <Text style={[styles.badgeText, { color: item.badgeColor }]}>
                {item.badge}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.preferenceDescription}>{item.description}</Text>
      </View>

      <Switch
        value={localPrefs[item.id]}
        onValueChange={(value) => handleToggle(item.id, value)}
        trackColor={{ false: colors.background.tertiary, true: colors.primary.blue }}
        thumbColor={colors.text.primary}
        disabled={isSaving}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification Settings</Text>
        <View style={styles.headerRight}>
          {isSaving && <ActivityIndicator size="small" color={colors.primary.blue} />}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Matching Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Matching Preferences</Text>
          <Text style={styles.sectionDescription}>
            Filter which companions appear in your discover feed based on their verification status.
          </Text>

          <Card variant="outlined" style={styles.preferencesCard}>
            {MATCHING_PREFERENCES.map((item, index) =>
              renderPreferenceItem(item, index === MATCHING_PREFERENCES.length - 1)
            )}
          </Card>
        </View>

        {/* Display Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display Preferences</Text>
          <Text style={styles.sectionDescription}>
            Control how verification information is displayed throughout the app.
          </Text>

          <Card variant="outlined" style={styles.preferencesCard}>
            {DISPLAY_PREFERENCES.map((item, index) =>
              renderPreferenceItem(item, index === DISPLAY_PREFERENCES.length - 1)
            )}
          </Card>
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={20} color={colors.text.tertiary} />
          <View style={styles.infoNoteContent}>
            <Text style={styles.infoNoteTitle}>About Verification Preferences</Text>
            <Text style={styles.infoNoteText}>
              Enabling stricter verification requirements may reduce the number of companions you see,
              but can help ensure a safer experience. We recommend enabling the "ID Verified" filter.
            </Text>
          </View>
        </View>

        {/* Verification Level Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Levels</Text>
          <Card variant="outlined" style={styles.levelsCard}>
            <View style={styles.levelRow}>
              <View style={[styles.levelBadge, { backgroundColor: colors.status.successLight }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
              </View>
              <View style={styles.levelContent}>
                <Text style={styles.levelTitle}>ID Verified</Text>
                <Text style={styles.levelDescription}>
                  User has verified their identity with a government ID
                </Text>
              </View>
            </View>

            <View style={styles.levelDivider} />

            <View style={styles.levelRow}>
              <View style={[styles.levelBadge, { backgroundColor: colors.primary.goldSoft }]}>
                <Ionicons name="star" size={16} color={colors.verification.premium} />
              </View>
              <View style={styles.levelContent}>
                <Text style={styles.levelTitle}>Premium Verified</Text>
                <Text style={styles.levelDescription}>
                  Highest verification level with premium membership
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.presets.label,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  sectionDescription: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  preferencesCard: {
    padding: 0,
    overflow: 'hidden',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  preferenceRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  preferenceIcon: {
    width: 40,
    height: 40,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.primary.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  preferenceContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxs,
  },
  preferenceTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: spacing.radius.round,
  },
  badgeText: {
    ...typography.presets.caption,
    fontWeight: typography.weights.medium,
    fontSize: 10,
  },
  preferenceDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: spacing.screenPadding,
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
    gap: spacing.sm,
  },
  infoNoteContent: {
    flex: 1,
  },
  infoNoteTitle: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xxs,
  },
  infoNoteText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
  levelsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  levelDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginHorizontal: spacing.lg,
  },
  levelBadge: {
    width: 32,
    height: 32,
    borderRadius: spacing.radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  levelContent: {
    flex: 1,
  },
  levelTitle: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xxs,
  },
  levelDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
});
