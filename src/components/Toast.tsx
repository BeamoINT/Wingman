import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useCallback, useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
    runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { springConfigs } from '../utils/animations';
import { haptics } from '../utils/haptics';
import { AnimatedPressable } from './AnimatedPressable';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onDismiss: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  type = 'info',
  title,
  message,
  duration = 4000,
  onDismiss,
  action,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  const dismiss = useCallback(() => {
    translateY.value = withSpring(-100, springConfigs.snappy);
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onDismiss)();
    });
  }, [onDismiss]);

  useEffect(() => {
    if (visible) {
      // Animate in
      translateY.value = withSpring(0, springConfigs.smooth);
      opacity.value = withTiming(1, { duration: 200 });

      // Haptic feedback based on type
      if (type === 'success') haptics.success();
      else if (type === 'error') haptics.error();
      else if (type === 'warning') haptics.warning();
      else haptics.light();

      // Auto dismiss
      const timer = setTimeout(dismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, type, duration, dismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle',
          iconColor: colors.status.success,
          bgColor: colors.status.successLight,
          borderColor: colors.status.success,
        };
      case 'error':
        return {
          icon: 'close-circle',
          iconColor: colors.status.error,
          bgColor: colors.status.errorLight,
          borderColor: colors.status.error,
        };
      case 'warning':
        return {
          icon: 'warning',
          iconColor: colors.status.warning,
          bgColor: colors.status.warningLight,
          borderColor: colors.status.warning,
        };
      default:
        return {
          icon: 'information-circle',
          iconColor: colors.status.info,
          bgColor: colors.status.infoLight,
          borderColor: colors.status.info,
        };
    }
  };

  const config = getTypeConfig();

  if (!visible) return null;

  const ToastContent = (
    <View
      style={[
        styles.content,
        { borderLeftColor: config.borderColor },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: config.bgColor },
        ]}
      >
        <Ionicons
          name={config.icon as any}
          size={22}
          color={config.iconColor}
        />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {message && (
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>
        )}
      </View>

      {action && (
        <AnimatedPressable
          style={styles.actionButton}
          onPress={() => {
            action.onPress();
            dismiss();
          }}
          hapticFeedback="medium"
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </AnimatedPressable>
      )}

      <AnimatedPressable
        style={styles.closeButton}
        onPress={dismiss}
        hapticFeedback="light"
      >
        <Ionicons name="close" size={18} color={colors.text.tertiary} />
      </AnimatedPressable>
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + spacing.md },
        animatedStyle,
      ]}
    >
      <AnimatedPressable onPress={dismiss} hapticFeedback="light">
        {Platform.OS === 'web' ? (
          <View style={[styles.blurContainer, styles.webBlurContainer]}>
            {ToastContent}
          </View>
        ) : (
          <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
            {ToastContent}
          </BlurView>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.screenPadding,
    right: spacing.screenPadding,
    zIndex: 9999,
  },
  blurContainer: {
    borderRadius: spacing.radius.xl,
    overflow: 'hidden',
  },
  webBlurContainer: {
    backgroundColor: colors.surface.overlay,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.elevated,
    borderRadius: spacing.radius.xl,
    borderLeftWidth: 3,
    // Subtle border
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  message: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginLeft: spacing.sm,
  },
  actionText: {
    ...typography.presets.buttonSmall,
    color: colors.primary.blue,
  },
  closeButton: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
  },
});
