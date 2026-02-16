/**
 * VerificationStepItem Component
 *
 * Displays a single verification step with status indicator and optional action.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { VerificationStep, VerificationStepStatus } from '../../types/verification';
import { haptics } from '../../utils/haptics';

interface VerificationStepItemProps {
  step: VerificationStep;
  onActionPress?: () => void;
  isLast?: boolean;
}

const getStatusConfig = (tokens: ThemeTokens): Record<VerificationStepStatus, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
}> => ({
  completed: {
    icon: 'checkmark-circle',
    color: tokens.colors.status.success,
    backgroundColor: tokens.colors.status.successLight,
  },
  in_progress: {
    icon: 'time',
    color: tokens.colors.status.warning,
    backgroundColor: tokens.colors.status.warningLight,
  },
  pending: {
    icon: 'ellipse-outline',
    color: tokens.colors.text.tertiary,
    backgroundColor: tokens.colors.surface.level2,
  },
  failed: {
    icon: 'close-circle',
    color: tokens.colors.status.error,
    backgroundColor: tokens.colors.status.errorLight,
  },
});

export const VerificationStepItem: React.FC<VerificationStepItemProps> = ({
  step,
  onActionPress,
  isLast = false,
}) => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const statusConfig = getStatusConfig(tokens);
  const config = statusConfig[step.status];

  const handleActionPress = async () => {
    await haptics.light();
    onActionPress?.();
  };

  return (
    <View style={[styles.container, !isLast && styles.withBorder]}>
      <View style={[styles.statusIcon, { backgroundColor: config.backgroundColor }]}>
        {step.status === 'in_progress' ? (
          <ActivityIndicator size="small" color={config.color} />
        ) : (
          <Ionicons name={config.icon} size={20} color={config.color} />
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={[styles.title, step.status === 'completed' && styles.titleCompleted]}>
            {step.title}
          </Text>
          <Text style={styles.description}>{step.description}</Text>
          {step.completedAt && step.status === 'completed' ? (
            <Text style={styles.completedDate}>Completed {formatDate(step.completedAt)}</Text>
          ) : null}
        </View>

        {step.actionLabel && step.status !== 'completed' && onActionPress ? (
          <TouchableOpacity
            style={[
              styles.actionButton,
              step.status === 'in_progress' && styles.actionButtonDisabled,
            ]}
            onPress={handleActionPress}
            disabled={step.status === 'in_progress'}
          >
            <Text
              style={[
                styles.actionButtonText,
                step.status === 'in_progress' && styles.actionButtonTextDisabled,
              ]}
            >
              {step.actionLabel}
            </Text>
            {step.status !== 'in_progress' ? (
              <Ionicons name="chevron-forward" size={16} color={tokens.colors.accent.primary} />
            ) : null}
          </TouchableOpacity>
        ) : null}

        {step.status === 'completed' ? (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark" size={16} color={tokens.colors.status.success} />
          </View>
        ) : null}
      </View>
    </View>
  );
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    alignItems: 'flex-start',
  },
  withBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: spacing.radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xxs,
  },
  titleCompleted: {
    color: colors.text.secondary,
  },
  description: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  completedDate: {
    ...typography.presets.caption,
    color: colors.status.success,
    marginTop: spacing.xxs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.soft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  actionButtonDisabled: {
    backgroundColor: colors.surface.level2,
  },
  actionButtonText: {
    ...typography.presets.buttonSmall,
    color: colors.accent.primary,
    marginRight: spacing.xs,
  },
  actionButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  completedBadge: {
    width: 28,
    height: 28,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.status.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
