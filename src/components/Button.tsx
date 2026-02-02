import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold' | 'danger';
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
  const pressed = useSharedValue(0);
  const isDisabled = disabled || loading;

  const handlePressIn = useCallback(() => {
    pressed.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, []);

  const handlePressOut = useCallback(() => {
    pressed.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, []);

  const handlePress = useCallback(async () => {
    if (isDisabled) return;
    await haptics[hapticType]();
    onPress();
  }, [isDisabled, hapticType, onPress]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, 0.97]);
    const opacity = interpolate(pressed.value, [0, 1], [1, 0.9]);
    return {
      transform: [{ scale }],
      opacity: isDisabled ? 0.5 : opacity,
    };
  });

  const buttonStyles = [
    styles.base,
    styles[size],
    fullWidth && styles.fullWidth,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${size}Text` as keyof typeof styles],
    variant === 'outline' && styles.outlineText,
    variant === 'ghost' && styles.ghostText,
    variant === 'gold' && styles.goldText,
    variant === 'danger' && styles.dangerText,
    disabled && styles.disabledText,
    textStyle,
  ];

  const getIconColor = () => {
    if (disabled) return colors.text.tertiary;
    if (variant === 'outline' || variant === 'ghost') return colors.primary.blue;
    if (variant === 'gold') return colors.primary.darkBlack;
    if (variant === 'danger') return colors.text.primary;
    return colors.text.primary;
  };

  const iconSize = size === 'small' ? 16 : size === 'large' ? 22 : 18;

  const renderContent = () => (
    <View style={styles.contentContainer}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? colors.primary.blue : colors.text.primary}
          size="small"
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons name={icon as any} size={iconSize} color={getIconColor()} />
          )}
          <Text style={textStyles}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <Ionicons name={icon as any} size={iconSize} color={getIconColor()} />
          )}
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

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={isDisabled}
        style={animatedStyle}
        {...accessibilityProps}
      >
        <LinearGradient
          colors={disabled ? ['#3A3A4A', '#2A2A3A'] : colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[buttonStyles, styles.gradient]}
        >
          {renderContent()}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  if (variant === 'gold') {
    return (
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={isDisabled}
        style={animatedStyle}
        {...accessibilityProps}
      >
        <LinearGradient
          colors={disabled ? ['#3A3A4A', '#2A2A3A'] : colors.gradients.gold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[buttonStyles, styles.gradient]}
        >
          {renderContent()}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      style={[
        animatedStyle,
        buttonStyles,
        variant === 'secondary' && styles.secondary,
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={isDisabled}
      {...accessibilityProps}
    >
      {renderContent()}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.radius.xl,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.radius.xl,
    // Subtle shadow for depth
    shadowColor: colors.primary.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  fullWidth: {
    width: '100%',
  },
  small: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.radius.lg,
  },
  medium: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
  },
  large: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  secondary: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary.blue,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.status.error,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.presets.button,
    color: colors.text.primary,
    letterSpacing: 0.3,
  },
  smallText: {
    ...typography.presets.buttonSmall,
  },
  mediumText: {
    ...typography.presets.button,
  },
  largeText: {
    ...typography.presets.button,
    fontSize: 17,
    fontWeight: '600',
  },
  outlineText: {
    color: colors.primary.blue,
  },
  ghostText: {
    color: colors.primary.blue,
  },
  goldText: {
    color: colors.primary.darkBlack,
    fontWeight: '600',
  },
  dangerText: {
    color: colors.text.primary,
  },
  disabledText: {
    color: colors.text.tertiary,
  },
});
