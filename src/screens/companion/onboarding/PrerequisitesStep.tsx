import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import type { ThemeTokens } from '../../../theme/tokens';
import { useThemedStyles } from '../../../theme/useThemedStyles';

export interface PrerequisiteItem {
  label: string;
  met: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onComplete?: () => void;
}

export interface UpcomingStepItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface PrerequisitesStepProps {
  prerequisites: PrerequisiteItem[];
  upcomingSteps: UpcomingStepItem[];
}

export const PrerequisitesStep: React.FC<PrerequisitesStepProps> = ({
  prerequisites,
  upcomingSteps,
}) => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;
  const allMet = prerequisites.every((item) => item.met);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prerequisites</Text>
      <Text style={styles.description}>
        Complete these before starting your Wingman application.
      </Text>

      {allMet ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
          <Text style={styles.successText}>All prerequisites met</Text>
        </View>
      ) : null}

      <View style={styles.rows}>
        {prerequisites.map((item) => (
          <View key={item.label} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: item.met ? colors.status.successLight : colors.background.tertiary }]}>
              <Ionicons
                name={item.icon}
                size={16}
                color={item.met ? colors.status.success : colors.text.tertiary}
              />
            </View>

            <Text style={[styles.rowLabel, item.met && styles.rowLabelMet]}>{item.label}</Text>

            {item.met ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.status.success} />
            ) : (
              <TouchableOpacity style={styles.completeButton} onPress={item.onComplete}>
                <Text style={styles.completeText}>Complete</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      <View style={styles.upcomingBlock}>
        <Text style={styles.subtitle}>What You&apos;ll Complete</Text>
        <Text style={styles.descriptionSmall}>
          The following steps are part of this application flow.
        </Text>

        {upcomingSteps.map((item) => (
          <View key={item.label} style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name={item.icon} size={16} color={colors.text.secondary} />
            </View>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.text.tertiary} />
          </View>
        ))}
      </View>
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  title: {
    ...typography.presets.h2,
    color: colors.text.primary,
  },
  description: {
    ...typography.presets.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.status.successLight,
    padding: spacing.md,
  },
  successText: {
    ...typography.presets.bodyMedium,
    color: colors.status.success,
  },
  rows: {
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.level1,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...typography.presets.body,
    color: colors.text.secondary,
    flex: 1,
  },
  rowLabelMet: {
    color: colors.text.primary,
  },
  completeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.round,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    backgroundColor: colors.primary.blueSoft,
  },
  completeText: {
    ...typography.presets.caption,
    color: colors.accent.primary,
    fontWeight: typography.weights.semibold,
  },
  upcomingBlock: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  descriptionSmall: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
});
