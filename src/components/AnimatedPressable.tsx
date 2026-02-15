import React, { useCallback, useEffect } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    interpolate, useAnimatedStyle, useSharedValue, withSpring
} from 'react-native-reanimated';
import { springConfigs } from '../utils/animations';
import { haptics } from '../utils/haptics';

const AnimatedPressableComponent = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleValue?: number;
  hapticFeedback?: 'light' | 'medium' | 'heavy' | 'none';
  animationType?: 'scale' | 'opacity' | 'both';
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  style,
  scaleValue = 0.97,
  hapticFeedback = 'light',
  animationType = 'scale',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...props
}) => {
  const pressed = useSharedValue(0);
  const scaleShared = useSharedValue(scaleValue);
  // 0 = scale, 1 = opacity, 2 = both
  const animTypeShared = useSharedValue(animationType === 'scale' ? 0 : animationType === 'opacity' ? 1 : 2);

  useEffect(() => {
    scaleShared.value = scaleValue;
  }, [scaleValue]);

  useEffect(() => {
    animTypeShared.value = animationType === 'scale' ? 0 : animationType === 'opacity' ? 1 : 2;
  }, [animationType]);

  const handlePressIn = useCallback((e: any) => {
    pressed.value = withSpring(1, springConfigs.quick);
    if (hapticFeedback !== 'none') {
      haptics[hapticFeedback]();
    }
    onPressIn?.(e);
  }, [hapticFeedback, onPressIn]);

  const handlePressOut = useCallback((e: any) => {
    pressed.value = withSpring(0, springConfigs.snappy);
    onPressOut?.(e);
  }, [onPressOut]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, scaleShared.value]);
    const opacity = interpolate(pressed.value, [0, 1], [1, 0.8]);

    if (animTypeShared.value === 0) {
      return { transform: [{ scale }] };
    }
    if (animTypeShared.value === 1) {
      return { opacity };
    }
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <AnimatedPressableComponent
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      style={[animatedStyle, style, disabled && { opacity: 0.5 }]}
      {...props}
    >
      {children}
    </AnimatedPressableComponent>
  );
};
