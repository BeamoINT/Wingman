import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { haptics } from '../utils/haptics';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outlined' | 'gradient' | 'premium' | 'accent';
  padding?: 'none' | 'small' | 'medium' | 'large';
  hapticOnPress?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = 'default',
  padding = 'medium',
  hapticOnPress = true,
}) => {
  const { tokens } = useTheme();
  const { colors, spacing } = tokens;

  const resolvedVariant = variant === 'premium' ? 'accent' : variant;

  const handlePress = async () => {
    if (hapticOnPress) {
      await haptics.light();
    }
    onPress?.();
  };

  const styles = StyleSheet.create({
    base: {
      borderRadius: spacing.radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    default: {
      backgroundColor: colors.surface.level3,
      borderColor: colors.border.subtle,
    },
    elevated: {
      backgroundColor: colors.surface.level4,
      borderColor: colors.border.light,
      shadowColor: colors.shadow.medium,
      ...spacing.elevation.md,
    },
    outlined: {
      backgroundColor: colors.surface.level2,
      borderColor: colors.border.light,
    },
    gradient: {
      borderColor: colors.border.light,
    },
    accent: {
      backgroundColor: colors.accent.soft,
      borderColor: colors.border.accent,
    },
    paddingNone: {
      padding: 0,
    },
    paddingSmall: {
      padding: spacing.sm,
    },
    paddingMedium: {
      padding: spacing.lg,
    },
    paddingLarge: {
      padding: spacing.xl,
    },
    pressed: {
      opacity: 0.94,
      transform: [{ scale: 0.992 }],
    },
    gradientContainer: {
      borderRadius: spacing.radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border.light,
    },
  });

  const paddingStyles = {
    none: styles.paddingNone,
    small: styles.paddingSmall,
    medium: styles.paddingMedium,
    large: styles.paddingLarge,
  } as const;

  const padStyle = paddingStyles[padding];

  if (resolvedVariant === 'gradient') {
    const content = (
      <View style={[styles.gradientContainer, style]}>
        <LinearGradient
          colors={colors.gradients.dark}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[padStyle]}
        >
          {children}
        </LinearGradient>
      </View>
    );

    if (!onPress) {
      return content;
    }

    return (
      <Pressable onPress={handlePress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  const cardStyles = [
    styles.base,
    styles[resolvedVariant],
    padStyle,
    style,
  ];

  if (!onPress) {
    return <View style={cardStyles}>{children}</View>;
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [cardStyles, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
};
