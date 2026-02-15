import React, { useCallback, useEffect } from 'react';
import {
    Dimensions, StyleProp, StyleSheet, TouchableWithoutFeedback, View, ViewStyle
} from 'react-native';
import {
    Gesture, GestureDetector
} from 'react-native-gesture-handler';
import Animated, {
    Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { springConfigs } from '../utils/animations';
import { haptics } from '../utils/haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: number[];
  initialSnapIndex?: number;
  style?: StyleProp<ViewStyle>;
  showHandle?: boolean;
  backdropOpacity?: number;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  children,
  snapPoints = [0.5],
  initialSnapIndex = 0,
  style,
  showHandle = true,
  backdropOpacity = 0.6,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const context = useSharedValue({ y: 0 });
  const isOpen = useSharedValue(false);

  const maxHeight = snapPoints[snapPoints.length - 1] * SCREEN_HEIGHT;
  const initialHeight = snapPoints[initialSnapIndex] * SCREEN_HEIGHT;

  const close = useCallback(() => {
    'worklet';
    translateY.value = withSpring(SCREEN_HEIGHT, springConfigs.smooth, () => {
      isOpen.value = false;
      runOnJS(onClose)();
    });
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      isOpen.value = true;
      translateY.value = withSpring(
        SCREEN_HEIGHT - initialHeight,
        springConfigs.smooth
      );
      haptics.light();
    } else {
      close();
    }
  }, [visible, initialHeight]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      translateY.value = Math.max(
        context.value.y + event.translationY,
        SCREEN_HEIGHT - maxHeight
      );
    })
    .onEnd((event) => {
      const shouldClose =
        event.velocityY > 500 ||
        translateY.value > SCREEN_HEIGHT - initialHeight / 2;

      if (shouldClose) {
        runOnJS(haptics.light)();
        close();
      } else {
        // Snap to closest snap point
        const currentPosition = SCREEN_HEIGHT - translateY.value;
        const snapHeights = snapPoints.map((p) => p * SCREEN_HEIGHT);
        let closestSnap = snapHeights[0];
        let minDiff = Math.abs(currentPosition - closestSnap);

        snapHeights.forEach((snap) => {
          const diff = Math.abs(currentPosition - snap);
          if (diff < minDiff) {
            minDiff = diff;
            closestSnap = snap;
          }
        });

        translateY.value = withSpring(
          SCREEN_HEIGHT - closestSnap,
          springConfigs.snappy
        );
        runOnJS(haptics.selection)();
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [SCREEN_HEIGHT, SCREEN_HEIGHT - initialHeight],
      [0, backdropOpacity],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  if (!visible && !isOpen.value) return null;

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />
      </TouchableWithoutFeedback>

      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.sheet,
            { maxHeight, paddingBottom: insets.bottom + spacing.lg },
            animatedSheetStyle,
            style,
          ]}
        >
          {showHandle && (
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>
          )}
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.elevated,
    borderTopLeftRadius: spacing.radius.xxl,
    borderTopRightRadius: spacing.radius.xxl,
    overflow: 'hidden',
    // Subtle top border for definition
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border.medium,
    borderRadius: 2,
  },
});
