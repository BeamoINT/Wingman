import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
    Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming
} from 'react-native-reanimated';
import { colors } from '../theme/colors';

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
  const progress = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      progress.value = withTiming(1, {
        duration: 400,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
    }, delay);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    switch (type) {
      case 'fade':
        return {
          opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
        };

      case 'slide':
        return {
          opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.5, 1], Extrapolation.CLAMP),
          transform: [
            {
              translateX: interpolate(
                progress.value,
                [0, 1],
                [30, 0],
                Extrapolation.CLAMP
              ),
            },
          ],
        };

      case 'slideUp':
        return {
          opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.5, 1], Extrapolation.CLAMP),
          transform: [
            {
              translateY: interpolate(
                progress.value,
                [0, 1],
                [40, 0],
                Extrapolation.CLAMP
              ),
            },
          ],
        };

      case 'scale':
        return {
          opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
          transform: [
            {
              scale: interpolate(
                progress.value,
                [0, 1],
                [0.95, 1],
                Extrapolation.CLAMP
              ),
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
});
