import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface LoadingOverlayProps {
  /**
   * Whether the overlay is visible.
   */
  visible: boolean;
  /**
   * Optional message to display below the spinner.
   */
  message?: string;
  /**
   * Whether to use blur effect (default: true).
   */
  useBlur?: boolean;
  /**
   * Whether the overlay should be transparent (no background).
   */
  transparent?: boolean;
}

/**
 * Full-screen loading overlay with optional message.
 * Useful for blocking user interaction during async operations.
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message,
  useBlur = true,
  transparent = false,
}) => {
  if (!visible) return null;

  const content = (
    <View
      style={styles.content}
      accessibilityRole="progressbar"
      accessibilityLabel={message || 'Loading'}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.spinnerContainer}>
        <ActivityIndicator
          size="large"
          color={colors.primary.blue}
        />
      </View>
      {message && (
        <Text style={styles.message}>{message}</Text>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      {useBlur ? (
        <BlurView
          intensity={20}
          tint="dark"
          style={styles.container}
        >
          {content}
        </BlurView>
      ) : (
        <View style={[styles.container, !transparent && styles.solidBackground]}>
          {content}
        </View>
      )}
    </Modal>
  );
};

/**
 * Inline loading indicator for use within components.
 */
export const LoadingIndicator: React.FC<{
  message?: string;
  size?: 'small' | 'large';
}> = ({ message, size = 'large' }) => (
  <View
    style={styles.inlineContainer}
    accessibilityRole="progressbar"
    accessibilityLabel={message || 'Loading'}
  >
    <ActivityIndicator size={size} color={colors.primary.blue} />
    {message && (
      <Text style={[styles.message, styles.inlineMessage]}>{message}</Text>
    )}
  </View>
);

/**
 * Centered loading indicator that fills its container.
 */
export const LoadingScreen: React.FC<{
  message?: string;
}> = ({ message }) => (
  <View
    style={styles.screenContainer}
    accessibilityRole="progressbar"
    accessibilityLabel={message || 'Loading'}
  >
    <ActivityIndicator size="large" color={colors.primary.blue} />
    {message && (
      <Text style={styles.screenMessage}>{message}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  solidBackground: {
    backgroundColor: colors.background.overlay,
  },
  content: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  spinnerContainer: {
    width: 80,
    height: 80,
    borderRadius: spacing.radius.xl,
    backgroundColor: colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow.heavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    ...typography.presets.body,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  inlineMessage: {
    marginTop: 0,
    marginLeft: spacing.md,
  },
  screenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  screenMessage: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
});
