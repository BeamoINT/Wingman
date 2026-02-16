import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
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
  const { tokens } = useTheme();
  const { colors } = tokens;
  const translateY = useSharedValue(-14);
  const opacity = useSharedValue(0);
  const dismissing = useSharedValue(0);
  const styles = useThemedStyles((themeTokens) => StyleSheet.create({
    container: {
      position: 'absolute',
      left: themeTokens.spacing.screenPadding,
      right: themeTokens.spacing.screenPadding,
      zIndex: 9999,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: themeTokens.spacing.sm,
      backgroundColor: themeTokens.colors.surface.level1,
      borderRadius: themeTokens.spacing.radius.md,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.light,
      borderLeftWidth: 3,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: themeTokens.spacing.radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: themeTokens.spacing.sm,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      ...themeTokens.typography.presets.bodyMedium,
      color: themeTokens.colors.text.primary,
    },
    message: {
      ...themeTokens.typography.presets.caption,
      color: themeTokens.colors.text.secondary,
      marginTop: 2,
    },
    actionButton: {
      paddingHorizontal: themeTokens.spacing.sm,
      paddingVertical: themeTokens.spacing.xs,
      marginLeft: themeTokens.spacing.xs,
      borderRadius: themeTokens.spacing.radius.sm,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.subtle,
    },
    actionText: {
      ...themeTokens.typography.presets.buttonSmall,
      color: themeTokens.colors.accent.primary,
    },
    closeButton: {
      padding: themeTokens.spacing.sm,
      marginLeft: themeTokens.spacing.xs,
    },
  }));

  const dismiss = useCallback(() => {
    if (dismissing.value) {
      return;
    }

    dismissing.value = 1;
    translateY.value = withTiming(-14, { duration: 170 });
    opacity.value = withTiming(0, { duration: 170 }, () => {
      dismissing.value = 0;
      runOnJS(onDismiss)();
    });
  }, [dismissing, onDismiss, opacity, translateY]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    translateY.value = withTiming(0, { duration: 180 });
    opacity.value = withTiming(1, { duration: 180 });

    if (type === 'success') {
      haptics.success();
    } else if (type === 'error') {
      haptics.error();
    } else if (type === 'warning') {
      haptics.warning();
    } else {
      haptics.light();
    }

    const timer = setTimeout(() => {
      dismiss();
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [dismiss, duration, opacity, translateY, type, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) {
    return null;
  }

  const iconByType: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
    success: 'checkmark-circle',
    error: 'close-circle',
    warning: 'warning',
    info: 'information-circle',
  };

  const accentByType: Record<ToastType, string> = {
    success: colors.status.success,
    error: colors.status.error,
    warning: colors.status.warning,
    info: colors.accent.primary,
  };

  const accentSoftByType: Record<ToastType, string> = {
    success: colors.status.successLight,
    error: colors.status.errorLight,
    warning: colors.status.warningLight,
    info: colors.accent.soft,
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + tokens.spacing.sm },
        animatedStyle,
      ]}
    >
      <AnimatedPressable onPress={dismiss} hapticFeedback="light">
        <View style={[styles.content, { borderLeftColor: accentByType[type] }]}>
          <View style={[styles.iconContainer, { backgroundColor: accentSoftByType[type] }]}>
            <Ionicons name={iconByType[type]} size={18} color={accentByType[type]} />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>

          {action ? (
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
          ) : null}

          <AnimatedPressable
            style={styles.closeButton}
            onPress={dismiss}
            hapticFeedback="light"
          >
            <Ionicons name="close" size={18} color={colors.text.tertiary} />
          </AnimatedPressable>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
};

