import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Dimensions, DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
    Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat,
    withTiming
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = spacing.radius.md,
  style,
}) => {
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    shimmerProgress.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerProgress.value,
      [0, 1],
      [-SCREEN_WIDTH, SCREEN_WIDTH]
    );
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View
      style={[
        styles.skeleton,
        { width: width as DimensionValue, height, borderRadius },
        style,
      ]}
    >
      <AnimatedLinearGradient
        colors={[
          'transparent',
          'rgba(255, 255, 255, 0.05)',
          'rgba(255, 255, 255, 0.1)',
          'rgba(255, 255, 255, 0.05)',
          'transparent',
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.shimmer, animatedStyle]}
      />
    </View>
  );
};

// Pre-built skeleton layouts
export const SkeletonCard: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => (
  <View style={[styles.card, style]}>
    <View style={styles.cardHeader}>
      <Skeleton width={60} height={60} borderRadius={30} />
      <View style={styles.cardHeaderText}>
        <Skeleton width={120} height={16} style={styles.mb8} />
        <Skeleton width={80} height={12} />
      </View>
    </View>
    <Skeleton width="100%" height={14} style={styles.mt16} />
    <Skeleton width="80%" height={14} style={styles.mt8} />
    <Skeleton width="60%" height={14} style={styles.mt8} />
  </View>
);

export const SkeletonCompanionCard: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => (
  <View style={[styles.companionCard, style]}>
    <Skeleton width="100%" height={160} borderRadius={spacing.radius.lg} />
    <View style={styles.companionCardContent}>
      <View style={styles.companionCardHeader}>
        <Skeleton width={100} height={18} />
        <Skeleton width={50} height={18} />
      </View>
      <Skeleton width={80} height={14} style={styles.mt8} />
      <View style={styles.companionCardTags}>
        <Skeleton width={60} height={24} borderRadius={12} />
        <Skeleton width={80} height={24} borderRadius={12} />
      </View>
    </View>
  </View>
);

export const SkeletonListItem: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => (
  <View style={[styles.listItem, style]}>
    <Skeleton width={48} height={48} borderRadius={24} />
    <View style={styles.listItemContent}>
      <Skeleton width={140} height={16} style={styles.mb8} />
      <Skeleton width={200} height={12} />
    </View>
  </View>
);

export const SkeletonAvatar: React.FC<{
  size?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ size = 48, style }) => (
  <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.background.tertiary,
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH * 2,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.xl,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  companionCard: {
    width: 180,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.xl,
    overflow: 'hidden',
  },
  companionCardContent: {
    padding: spacing.md,
  },
  companionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companionCardTags: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  listItemContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  mb8: {
    marginBottom: 8,
  },
  mt8: {
    marginTop: 8,
  },
  mt16: {
    marginTop: 16,
  },
});
