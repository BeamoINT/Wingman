import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { haptics } from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold' | 'accent' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticType?: 'light' | 'medium' | 'heavy' | 'selection';
  fullWidth?: boolean;
  /** Accessibility label for screen readers (defaults to title) */
  accessibilityLabel?: string;
  /** Accessibility hint for screen readers */
  accessibilityHint?: string;
  /** Test ID for E2E testing */
  testID?: string;
}

export type { ButtonProps };

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  hapticType = 'medium',
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const { tokens, reduceMotionEnabled } = useTheme();
  const { colors, spacing, typography, motion } = tokens;

  const pressed = useSharedValue(0);
  const isDisabled = disabled || loading;
  const disabledShared = useSharedValue(isDisabled ? 1 : 0);

  useEffect(() => {
    disabledShared.value = isDisabled ? 1 : 0;
  }, [disabledShared, isDisabled]);

  const resolvedVariant = variant === 'gold' ? 'accent' : variant;

  const handlePressIn = useCallback(() => {
    if (reduceMotionEnabled) {
      return;
    }
    pressed.value = withSpring(1, { damping: 18, stiffness: 260 });
  }, [pressed, reduceMotionEnabled]);

  const handlePressOut = useCallback(() => {
    if (reduceMotionEnabled) {
      return;
    }
    pressed.value = withSpring(0, { damping: 18, stiffness: 220 });
  }, [pressed, reduceMotionEnabled]);

  const handlePress = useCallback(async () => {
    if (isDisabled) {
      return;
    }
    await haptics[hapticType]();
    onPress();
  }, [hapticType, isDisabled, onPress]);

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotionEnabled) {
      return { opacity: disabledShared.value ? 0.55 : 1 };
    }

    const scale = interpolate(pressed.value, [0, 1], [1, motion.scale.press]);
    const opacity = interpolate(pressed.value, [0, 1], [1, 0.92]);

    return {
      transform: [{ scale }],
      opacity: disabledShared.value ? 0.55 : opacity,
    };
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          borderRadius: spacing.radius.md,
          borderWidth: 1,
          borderColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        },
        fullWidth: {
          width: '100%',
        },
        small: {
          minHeight: 40,
          paddingHorizontal: spacing.md,
          borderRadius: spacing.radius.sm,
        },
        medium: {
          minHeight: 48,
          paddingHorizontal: spacing.lg,
        },
        large: {
          minHeight: 54,
          paddingHorizontal: spacing.xl,
          borderRadius: spacing.radius.lg,
        },
        contentContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        },
        primary: {
          backgroundColor: colors.accent.primary,
          borderColor: colors.accent.primary,
          ...spacing.elevation.sm,
          shadowColor: colors.shadow.blueStrong,
        },
        accent: {
          backgroundColor: colors.accent.soft,
          borderColor: colors.accent.primary,
        },
        secondary: {
          backgroundColor: colors.surface.level2,
          borderColor: colors.border.light,
        },
        outline: {
          backgroundColor: 'transparent',
          borderColor: colors.border.strong,
        },
        ghost: {
          backgroundColor: colors.interactive.pressed,
          borderColor: 'transparent',
        },
        danger: {
          backgroundColor: colors.status.error,
          borderColor: colors.status.error,
        },
        text: {
          ...typography.presets.button,
          color: colors.text.primary,
        },
        smallText: {
          ...typography.presets.buttonSmall,
        },
        primaryText: {
          color: colors.text.onAccent,
        },
        outlineText: {
          color: colors.text.primary,
        },
        ghostText: {
          color: colors.text.primary,
        },
        accentText: {
          color: colors.text.primary,
        },
        dangerText: {
          color: colors.text.onDanger,
        },
        secondaryText: {
          color: colors.text.primary,
        },
        disabledText: {
          color: colors.text.tertiary,
        },
      }),
    [colors, size, spacing, typography],
  );

  const buttonStyles = [
    styles.base,
    styles[size],
    fullWidth && styles.fullWidth,
    styles[resolvedVariant === 'accent' ? 'accent' : resolvedVariant],
    style,
  ];

  const textStyles = [
    styles.text,
    size === 'small' && styles.smallText,
    resolvedVariant === 'primary' && styles.primaryText,
    resolvedVariant === 'outline' && styles.outlineText,
    resolvedVariant === 'ghost' && styles.ghostText,
    resolvedVariant === 'accent' && styles.accentText,
    resolvedVariant === 'secondary' && styles.secondaryText,
    resolvedVariant === 'danger' && styles.dangerText,
    disabled && styles.disabledText,
    textStyle,
  ];

  const iconColor = (() => {
    if (disabled) {
      return colors.text.tertiary;
    }

    if (resolvedVariant === 'outline') {
      return colors.text.primary;
    }

    if (resolvedVariant === 'primary' || resolvedVariant === 'danger') {
      return resolvedVariant === 'primary' ? colors.text.onAccent : colors.text.onDanger;
    }

    return colors.text.primary;
  })();

  const iconSize = size === 'small' ? 16 : size === 'large' ? 22 : 18;

  const spinnerColor = (
    resolvedVariant === 'primary' || resolvedVariant === 'danger'
      ? (resolvedVariant === 'primary' ? colors.text.onAccent : colors.text.onDanger)
      : colors.text.primary
  );

  const renderContent = () => (
    <View style={styles.contentContainer}>
      {loading ? (
        <ActivityIndicator color={spinnerColor} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' ? (
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={iconSize} color={iconColor} />
          ) : null}
          <Text style={textStyles}>{title}</Text>
          {icon && iconPosition === 'right' ? (
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={iconSize} color={iconColor} />
          ) : null}
        </>
      )}
    </View>
  );

  const accessibilityProps = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: accessibilityLabel || title,
    accessibilityHint,
    accessibilityState: {
      disabled: isDisabled,
      busy: loading,
    },
    testID,
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={isDisabled}
      style={[animatedStyle, buttonStyles]}
      {...accessibilityProps}
    >
      {renderContent()}
    </AnimatedPressable>
  );
};
