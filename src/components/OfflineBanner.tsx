import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    interpolate, useAnimatedStyle, useSharedValue, withSpring
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsConnected } from '../context/NetworkContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface OfflineBannerProps {
  /**
   * Optional message to display when offline.
   */
  message?: string;
}

/**
 * Animated banner that appears at the top of the screen when offline.
 * Automatically shows/hides based on network connectivity.
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  message = "You're offline. Some features may be unavailable.",
}) => {
  const isConnected = useIsConnected();
  const insets = useSafeAreaInsets();
  const animation = useSharedValue(0);

  useEffect(() => {
    animation.value = withSpring(isConnected ? 0 : 1, {
      damping: 20,
      stiffness: 200,
    });
  }, [isConnected]);

  const containerStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      animation.value,
      [0, 1],
      [-100, 0]
    );
    const opacity = interpolate(
      animation.value,
      [0, 1],
      [0, 1]
    );

    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  // Don't render when connected to avoid layout issues
  if (isConnected) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.sm },
        containerStyle,
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
    >
      <View style={styles.content}>
        <Ionicons
          name="cloud-offline-outline"
          size={18}
          color={colors.text.primary}
        />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.status.warning,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  text: {
    ...typography.presets.label,
    color: colors.text.inverse,
    textAlign: 'center',
  },
});
