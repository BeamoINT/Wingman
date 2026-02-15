/**
 * VerificationStatusCard Component
 *
 * Displays the user's overall verification status with a visual progress indicator.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { OverallVerificationStatus, VerificationLevel } from '../../types/verification';

interface VerificationStatusCardProps {
  overallStatus: OverallVerificationStatus;
  verificationLevel: VerificationLevel;
  completedSteps: number;
  totalSteps: number;
}

const STATUS_CONFIG: Record<OverallVerificationStatus, {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: readonly [string, string];
}> = {
  not_started: {
    label: 'Not Verified',
    color: colors.text.tertiary,
    icon: 'shield-outline',
    gradient: [colors.background.card, colors.background.tertiary] as const,
  },
  in_progress: {
    label: 'Verification in Progress',
    color: colors.status.warning,
    icon: 'time-outline',
    gradient: [colors.status.warningLight, 'rgba(251, 191, 36, 0.05)'] as const,
  },
  verified: {
    label: 'ID Verified',
    color: colors.verification.verified,
    icon: 'checkmark-circle',
    gradient: [colors.status.successLight, 'rgba(52, 211, 153, 0.05)'] as const,
  },
  premium_verified: {
    label: 'Premium Verified',
    color: colors.verification.premium,
    icon: 'star',
    gradient: [colors.primary.goldSoft, 'rgba(255, 215, 0, 0.05)'] as const,
  },
};

export const VerificationStatusCard: React.FC<VerificationStatusCardProps> = ({
  overallStatus,
  verificationLevel,
  completedSteps,
  totalSteps,
}) => {
  const config = STATUS_CONFIG[overallStatus];
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

const styles = StyleSheet.create({
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
    fontWeight: typography.weights.semibold,
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
