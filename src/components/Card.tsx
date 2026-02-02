import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { haptics } from '../utils/haptics';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outlined' | 'gradient' | 'premium';
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
  const handlePress = async () => {
    if (hapticOnPress) {
      await haptics.light();
    }
    onPress?.();
  };

  const cardStyles = [
    styles.base,
    styles[variant],
    styles[`padding${padding.charAt(0).toUpperCase() + padding.slice(1)}` as keyof typeof styles],
    style,
  ];

  if (variant === 'gradient') {
    const content = (
      <LinearGradient
        colors={[colors.background.card, colors.background.tertiary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.base, styles.paddingMedium, style]}
      >
        {children}
      </LinearGradient>
    );

    return onPress ? (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    ) : (
      content
    );
  }

  if (variant === 'premium') {
    const content = (
      <View style={[styles.base, styles.premium, style]}>
        <LinearGradient
          colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.premiumGradient, styles[`padding${padding.charAt(0).toUpperCase() + padding.slice(1)}` as keyof typeof styles]]}
        >
          {children}
        </LinearGradient>
      </View>
    );

    return onPress ? (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    ) : (
      content
    );
  }

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          cardStyles,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyles}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: spacing.radius.lg,
    overflow: 'hidden',
  },
  default: {
    backgroundColor: colors.background.card,
  },
  elevated: {
    backgroundColor: colors.background.card,
    shadowColor: colors.shadow.heavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  outlined: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  gradient: {},
  premium: {
    borderWidth: 1,
    borderColor: colors.border.gold,
  },
  premiumGradient: {
    flex: 1,
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
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
