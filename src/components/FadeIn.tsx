import React, { useEffect } from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { springConfigs, timingConfigs } from '../utils/animations';

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: Direction;
  distance?: number;
  style?: StyleProp<ViewStyle>;
  useSpring?: boolean;
}

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 400,
  direction = 'up',
  distance = 20,
  style,
  useSpring: shouldUseSpring = true,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (shouldUseSpring) {
      progress.value = withDelay(delay, withSpring(1, springConfigs.smooth));
    } else {
      progress.value = withDelay(
        delay,
        withTiming(1, { duration, easing: Easing.bezier(0.16, 1, 0.3, 1) })
      );
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP);

    let translateX = 0;
    let translateY = 0;

    switch (direction) {
      case 'up':
        translateY = interpolate(progress.value, [0, 1], [distance, 0], Extrapolation.CLAMP);
        break;
      case 'down':
        translateY = interpolate(progress.value, [0, 1], [-distance, 0], Extrapolation.CLAMP);
        break;
      case 'left':
        translateX = interpolate(progress.value, [0, 1], [distance, 0], Extrapolation.CLAMP);
        break;
      case 'right':
        translateX = interpolate(progress.value, [0, 1], [-distance, 0], Extrapolation.CLAMP);
        break;
    }

    return {
      opacity,
      transform: [{ translateX }, { translateY }],
    };
  });

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
};

// Staggered list component
interface StaggerProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  direction?: Direction;
  style?: StyleProp<ViewStyle>;
}

export const Stagger: React.FC<StaggerProps> = ({
  children,
  staggerDelay = 50,
  direction = 'up',
  style,
}) => {
  return (
    <>
      {React.Children.map(children, (child, index) => (
        <FadeIn
          delay={index * staggerDelay}
          direction={direction}
          style={style}
        >
          {child}
        </FadeIn>
      ))}
    </>
  );
};

// Scale in component
interface ScaleInProps {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export const ScaleIn: React.FC<ScaleInProps> = ({
  children,
  delay = 0,
  style,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, springConfigs.bouncy));
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [0.8, 1], Extrapolation.CLAMP);
    const opacity = interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
};
