import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

interface ScreenTransitionProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  type?: 'fade' | 'slide' | 'scale' | 'slideUp';
  delay?: number;
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({
  children,
  style,
  type = 'fade',
  delay = 0,
}) => {
  const { tokens, reduceMotionEnabled } = useTheme();
  const progress = useSharedValue(0);
  const styles = useThemedStyles((themeTokens) => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeTokens.colors.background.primary,
    },
  }));

  useEffect(() => {
    const timer = setTimeout(() => {
      progress.value = withTiming(1, {
        duration: reduceMotionEnabled ? 0 : tokens.motion.duration.normal,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, progress, reduceMotionEnabled, tokens.motion.duration.normal]);

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotionEnabled) {
      return { opacity: 1 };
    }

    switch (type) {
      case 'fade':
        return {
          opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
        };
      case 'slide':
        return {
          opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.6, 1], Extrapolation.CLAMP),
          transform: [
            {
              translateX: interpolate(progress.value, [0, 1], [18, 0], Extrapolation.CLAMP),
            },
          ],
        };
      case 'slideUp':
        return {
          opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.6, 1], Extrapolation.CLAMP),
          transform: [
            {
              translateY: interpolate(progress.value, [0, 1], [20, 0], Extrapolation.CLAMP),
            },
          ],
        };
      case 'scale':
        return {
          opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
          transform: [
            {
              scale: interpolate(progress.value, [0, 1], [0.985, 1], Extrapolation.CLAMP),
            },
          ],
        };
      default:
        return {
          opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
        };
    }
  });

  return (
    <Animated.View style={[styles.container, animatedStyle, style]}>
      {children}
    </Animated.View>
  );
};

