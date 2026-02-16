import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Dimensions, DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const useSkeletonStyles = () => useThemedStyles((tokens) => StyleSheet.create({
  skeleton: {
    backgroundColor: tokens.colors.surface.level2,
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH * 2,
  },
  card: {
    backgroundColor: tokens.colors.surface.level1,
    borderRadius: tokens.spacing.radius.md,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: tokens.spacing.sm,
    flex: 1,
  },
  companionCard: {
    width: 180,
    backgroundColor: tokens.colors.surface.level1,
    borderRadius: tokens.spacing.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
  },
  companionCardContent: {
    padding: tokens.spacing.sm,
  },
  companionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companionCardTags: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.sm,
  },
  listItemContent: {
    marginLeft: tokens.spacing.sm,
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
}));

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius,
  style,
}) => {
  const { tokens } = useTheme();
  const styles = useSkeletonStyles();
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    shimmerProgress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [shimmerProgress]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmerProgress.value, [0, 1], [-SCREEN_WIDTH, SCREEN_WIDTH]);
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View
      style={[
        styles.skeleton,
        { width: width as DimensionValue, height, borderRadius: borderRadius ?? tokens.spacing.radius.sm },
        style,
      ]}
    >
      <AnimatedLinearGradient
        colors={[
          'transparent',
          tokens.colors.interactive.pressed,
          tokens.colors.interactive.hover,
          tokens.colors.interactive.pressed,
          'transparent',
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.shimmer, animatedStyle]}
      />
    </View>
  );
};

export const SkeletonCard: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const styles = useSkeletonStyles();

  return (
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
};

export const SkeletonCompanionCard: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const styles = useSkeletonStyles();
  const { tokens } = useTheme();

  return (
    <View style={[styles.companionCard, style]}>
      <Skeleton width="100%" height={160} borderRadius={tokens.spacing.radius.md} />
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
};

export const SkeletonListItem: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const styles = useSkeletonStyles();

  return (
    <View style={[styles.listItem, style]}>
      <Skeleton width={48} height={48} borderRadius={24} />
      <View style={styles.listItemContent}>
        <Skeleton width={140} height={16} style={styles.mb8} />
        <Skeleton width={200} height={12} />
      </View>
    </View>
  );
};

export const SkeletonAvatar: React.FC<{
  size?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ size = 48, style }) => (
  <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />
);

