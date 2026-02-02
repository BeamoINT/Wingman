/**
 * VerificationStepItem Component
 *
 * Displays a single verification step with status indicator and optional action.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { haptics } from '../../utils/haptics';
import type { VerificationStep, VerificationStepStatus } from '../../types/verification';

interface VerificationStepItemProps {
  step: VerificationStep;
  onActionPress?: () => void;
  isLast?: boolean;
}

const STATUS_CONFIG: Record<VerificationStepStatus, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
}> = {
  completed: {
    icon: 'checkmark-circle',
    color: colors.status.success,
    backgroundColor: colors.status.successLight,
  },
  in_progress: {
    icon: 'time',
    color: colors.status.warning,
    backgroundColor: colors.status.warningLight,
  },
  pending: {
    icon: 'ellipse-outline',
    color: colors.text.tertiary,
    backgroundColor: colors.background.tertiary,
  },
  failed: {
    icon: 'close-circle',
    color: colors.status.error,
    backgroundColor: colors.status.errorLight,
  },
};

export const VerificationStepItem: React.FC<VerificationStepItemProps> = ({
  step,
  onActionPress,
  isLast = false,
}) => {
  const statusConfig = STATUS_CONFIG[step.status];

  const handleActionPress = async () => {
    await haptics.light();
    onActionPress?.();
  };

  return (
    <View style={[styles.container, !isLast && styles.withBorder]}>
      {/* Status Icon */}
      <View style={[styles.statusIcon, { backgroundColor: statusConfig.backgroundColor }]}>
        {step.status === 'in_progress' ? (
          <ActivityIndicator size="small" color={statusConfig.color} />
        ) : (
          <Ionicons
            name={statusConfig.icon}
            size={20}
            color={statusConfig.color}
          />
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={[
            styles.title,
            step.status === 'completed' && styles.titleCompleted,
          ]}>
            {step.title}
          </Text>
          <Text style={styles.description}>{step.description}</Text>
          {step.completedAt && step.status === 'completed' && (
            <Text style={styles.completedDate}>
              Completed {formatDate(step.completedAt)}
            </Text>
          )}
        </View>

        {/* Action Button */}
        {step.actionLabel && step.status !== 'completed' && onActionPress && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              step.status === 'in_progress' && styles.actionButtonDisabled,
            ]}
            onPress={handleActionPress}
            disabled={step.status === 'in_progress'}
          >
            <Text style={[
              styles.actionButtonText,
              step.status === 'in_progress' && styles.actionButtonTextDisabled,
            ]}>
              {step.actionLabel}
            </Text>
            {step.status !== 'in_progress' && (
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.primary.blue}
              />
            )}
          </TouchableOpacity>
        )}

        {/* Completed checkmark for mobile */}
        {step.status === 'completed' && (
          <View style={styles.completedBadge}>
            <Ionicons
              name="checkmark"
              size={16}
              color={colors.status.success}
            />
          </View>
        )}
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

const styles = StyleSheet.create({
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
    fontWeight: typography.weights.medium,
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
    backgroundColor: colors.primary.blueSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.md,
  },
  actionButtonDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  actionButtonText: {
    ...typography.presets.buttonSmall,
    color: colors.primary.blue,
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
