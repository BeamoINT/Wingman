import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface RatingProps {
  rating: number;
  reviewCount?: number;
  showCount?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

export const Rating: React.FC<RatingProps> = ({
  rating,
  reviewCount,
  showCount = true,
  size = 'medium',
  style,
}) => {
  const starSize = size === 'small' ? 12 : size === 'medium' ? 16 : 20;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.stars}>
        {[...Array(fullStars)].map((_, i) => (
          <Ionicons
            key={`full-${i}`}
            name="star"
            size={starSize}
            color={colors.primary.gold}
          />
        ))}
        {hasHalfStar && (
          <Ionicons
            name="star-half"
            size={starSize}
            color={colors.primary.gold}
          />
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Ionicons
            key={`empty-${i}`}
            name="star-outline"
            size={starSize}
            color={colors.text.tertiary}
          />
        ))}
      </View>
      <Text
        style={[
          styles.rating,
          size === 'small' && styles.smallText,
          size === 'large' && styles.largeText,
        ]}
      >
        {rating.toFixed(1)}
      </Text>
      {showCount && reviewCount !== undefined && (
        <Text
          style={[
            styles.count,
            size === 'small' && styles.smallText,
          ]}
        >
          ({reviewCount})
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  rating: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  count: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
  },
  smallText: {
    fontSize: typography.sizes.xs,
  },
  largeText: {
    fontSize: typography.sizes.md,
  },
});
