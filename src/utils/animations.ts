import Animated, {
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';

// Spring configurations for different use cases
export const springConfigs = {
  // Gentle spring for subtle movements
  gentle: {
    damping: 20,
    stiffness: 90,
    mass: 1,
  },
  // Snappy spring for quick feedback
  snappy: {
    damping: 15,
    stiffness: 150,
    mass: 0.8,
  },
  // Bouncy spring for playful animations
  bouncy: {
    damping: 10,
    stiffness: 100,
    mass: 1,
  },
  // Smooth spring for elegant transitions
  smooth: {
    damping: 25,
    stiffness: 120,
    mass: 1,
  },
  // Quick spring for micro-interactions
  quick: {
    damping: 20,
    stiffness: 300,
    mass: 0.5,
  },
} as const;

// Timing configurations
export const timingConfigs = {
  fast: {
    duration: 150,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  },
  normal: {
    duration: 300,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  },
  slow: {
    duration: 500,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  },
  // iOS-style ease
  easeOut: {
    duration: 350,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  },
  // Smooth deceleration
  decelerate: {
    duration: 400,
    easing: Easing.bezier(0, 0, 0.2, 1),
  },
  // Smooth acceleration
  accelerate: {
    duration: 300,
    easing: Easing.bezier(0.4, 0, 1, 1),
  },
} as const;

// Animation presets for common use cases
export const animations = {
  // Fade in from opacity 0 to 1
  fadeIn: (delay = 0) => {
    'worklet';
    return withDelay(delay, withTiming(1, timingConfigs.normal));
  },

  // Fade out from opacity 1 to 0
  fadeOut: (delay = 0) => {
    'worklet';
    return withDelay(delay, withTiming(0, timingConfigs.fast));
  },

  // Scale up from 0.95 to 1
  scaleIn: (delay = 0) => {
    'worklet';
    return withDelay(delay, withSpring(1, springConfigs.smooth));
  },

  // Scale down for press feedback
  scalePress: () => {
    'worklet';
    return withSpring(0.96, springConfigs.quick);
  },

  // Scale up for release
  scaleRelease: () => {
    'worklet';
    return withSpring(1, springConfigs.snappy);
  },

  // Slide in from bottom
  slideInFromBottom: (delay = 0) => {
    'worklet';
    return withDelay(delay, withSpring(0, springConfigs.smooth));
  },

  // Slide in from right
  slideInFromRight: (delay = 0) => {
    'worklet';
    return withDelay(delay, withSpring(0, springConfigs.smooth));
  },

  // Bounce effect
  bounce: () => {
    'worklet';
    return withSequence(
      withSpring(1.1, springConfigs.quick),
      withSpring(1, springConfigs.bouncy)
    );
  },

  // Shake effect for errors
  shake: () => {
    'worklet';
    return withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  },

  // Pulse effect
  pulse: () => {
    'worklet';
    return withRepeat(
      withSequence(
        withTiming(1.05, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      true
    );
  },

  // Subtle breathing effect
  breathe: () => {
    'worklet';
    return withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  },
};

// Stagger animation helper for lists
export const staggerDelay = (index: number, baseDelay = 50) => {
  'worklet';
  return index * baseDelay;
};

// Interpolation helpers
export const interpolateScale = (
  progress: Animated.SharedValue<number>,
  inputRange = [0, 1],
  outputRange = [0.95, 1]
) => {
  'worklet';
  return interpolate(progress.value, inputRange, outputRange, Extrapolation.CLAMP);
};

export const interpolateOpacity = (
  progress: Animated.SharedValue<number>,
  inputRange = [0, 1],
  outputRange = [0, 1]
) => {
  'worklet';
  return interpolate(progress.value, inputRange, outputRange, Extrapolation.CLAMP);
};

export const interpolateTranslateY = (
  progress: Animated.SharedValue<number>,
  inputRange = [0, 1],
  outputRange = [20, 0]
) => {
  'worklet';
  return interpolate(progress.value, inputRange, outputRange, Extrapolation.CLAMP);
};

// Export types
export type SpringConfig = keyof typeof springConfigs;
export type TimingConfig = keyof typeof timingConfigs;
