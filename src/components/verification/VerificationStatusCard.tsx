/**
 * VerificationStatusCard Component
 *
 * Displays the user's overall verification status with a visual progress indicator.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeTokens } from '../../theme/tokens';
import type { OverallVerificationStatus, VerificationLevel } from '../../types/verification';

interface VerificationStatusCardProps {
  overallStatus: OverallVerificationStatus;
  verificationLevel: VerificationLevel;
  completedSteps: number;
  totalSteps: number;
}

const getStatusConfig = (tokens: ThemeTokens): Record<OverallVerificationStatus, {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: readonly [string, string];
}> => ({
  not_started: {
    label: 'Not Verified',
    color: tokens.colors.text.tertiary,
    icon: 'shield-outline',
    gradient: [tokens.colors.background.card, tokens.colors.background.tertiary] as const,
  },
  in_progress: {
    label: 'Verification in Progress',
    color: tokens.colors.status.warning,
    icon: 'time-outline',
    gradient: [tokens.colors.status.warningLight, tokens.colors.background.secondary] as const,
  },
  verified: {
    label: 'ID Verified',
    color: tokens.colors.verification.verified,
    icon: 'checkmark-circle',
    gradient: [tokens.colors.status.successLight, tokens.colors.background.secondary] as const,
  },
  premium_verified: {
    label: 'Premium Verified',
    color: tokens.colors.verification.premium,
    icon: 'star',
    gradient: [tokens.colors.primary.goldSoft, tokens.colors.primary.goldSoft] as const,
  },
});

export const VerificationStatusCard: React.FC<VerificationStatusCardProps> = ({
  overallStatus,
  verificationLevel,
  completedSteps,
  totalSteps,
}) => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const statusConfig = getStatusConfig(tokens);
  const config = statusConfig[overallStatus];
  const progressPercent = (completedSteps / totalSteps) * 100;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={config.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: `${config.color}20` }]}>
            <Ionicons name={config.icon} size={32} color={config.color} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.statusLabel, { color: config.color }]}>
              {config.label}
            </Text>
            <Text style={styles.levelText}>
              Level: {verificationLevel.charAt(0).toUpperCase() + verificationLevel.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              {completedSteps} of {totalSteps} steps completed
            </Text>
            <Text style={[styles.progressPercent, { color: config.color }]}>
              {Math.round(progressPercent)}%
            </Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${progressPercent}%`, backgroundColor: config.color },
              ]}
            />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    borderRadius: spacing.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  gradient: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: spacing.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  statusLabel: {
    ...typography.presets.h4,
    marginBottom: spacing.xxs,
  },
  levelText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  progressSection: {},
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  progressPercent: {
    ...typography.presets.bodySmall,
    fontFamily: typography.fontFamily.semibold,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.background.secondary,
    borderRadius: spacing.radius.round,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: spacing.radius.round,
  },
});
