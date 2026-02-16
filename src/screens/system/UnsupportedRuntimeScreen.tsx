import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';

export const UnsupportedRuntimeScreen: React.FC = () => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;
  const styles = useThemedStyles(createStyles);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Build Required</Text>
        </View>

        <Text style={styles.title}>Open Wingman in the Wingman app build</Text>
        <Text style={styles.body}>
          This project no longer runs in Expo Go because secure messaging and subscriptions require
          native modules.
        </Text>

        <View style={styles.steps}>
          <Text style={styles.step}>1. Install the latest Wingman development build.</Text>
          <Text style={styles.step}>2. Keep Metro running with `npm start`.</Text>
          <Text style={styles.step}>3. Re-open the project from the Wingman app build.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
    backgroundColor: colors.accent.soft,
    borderWidth: 1,
    borderColor: colors.border.accent,
  },
  badgeText: {
    ...typography.presets.caption,
    color: colors.text.accent,
    fontWeight: '700',
  },
  title: {
    ...typography.presets.h2,
    color: colors.text.primary,
  },
  body: {
    ...typography.presets.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  steps: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.surface.level2,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  step: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
