import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

interface ErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
  title?: string;
  message?: string;
}

/**
 * Fallback UI displayed when an error is caught by ErrorBoundary.
 * Shows a friendly error message with retry option.
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  onReset,
  title = 'Something went wrong',
  message = "We're sorry, but something unexpected happened. Please try again.",
}) => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={colors.status.error}
            accessibilityLabel="Error icon"
          />
        </View>

        <Text
          style={styles.title}
          accessibilityRole="header"
        >
          {title}
        </Text>

        <Text style={styles.message}>
          {message}
        </Text>

        {__DEV__ && error && (
          <View style={styles.errorDetails}>
            <Text style={styles.errorLabel}>Error Details (Dev Only):</Text>
            <Text style={styles.errorText} numberOfLines={4}>
              {error.message}
            </Text>
          </View>
        )}

        {onReset && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onReset}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            accessibilityHint="Attempts to recover from the error"
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={colors.text.primary}
            />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.screenPadding,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderRadius: spacing.radius.full,
    backgroundColor: colors.status.errorLight,
  },
  title: {
    ...typography.presets.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  errorDetails: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  errorLabel: {
    ...typography.presets.label,
    color: colors.status.error,
    marginBottom: spacing.xs,
  },
  errorText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    fontFamily: 'monospace',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.blue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.radius.lg,
    gap: spacing.sm,
  },
  retryText: {
    ...typography.presets.label,
    color: colors.text.primary,
  },
});
