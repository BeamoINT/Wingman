import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
    Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { springConfigs } from '../utils/animations';

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  index?: number;
  variant?: 'default' | 'outlined' | 'elevated' | 'glass';
  onPress?: () => void;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  style,
  delay = 0,
  index = 0,
  variant = 'default',
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    const staggerDelay = delay + (index * 60);
    progress.value = withDelay(staggerDelay, withSpring(1, springConfigs.smooth));
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      progress.value,
      [0, 1],
      [30, 0],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      progress.value,
      [0, 0.5, 1],
      [0, 0.5, 1],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      progress.value,
      [0, 1],
      [0.95, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border.light,
        };
      case 'elevated':
        return {
          backgroundColor: colors.background.card,
          shadowColor: colors.shadow.heavy,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 24,
          elevation: 8,
        };
      case 'glass':
        return {
          backgroundColor: colors.interactive.pressed,
          borderWidth: 1,
          borderColor: colors.border.light,
        };
      default:
        return {
          backgroundColor: colors.background.card,
        };
    }
  };

  return (
    <Animated.View style={[styles.card, getVariantStyle(), animatedStyle, style]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: spacing.radius.xl,
    padding: spacing.lg,
    overflow: 'hidden',
  },
});
