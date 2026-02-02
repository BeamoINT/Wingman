import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import type { Subscription } from '../types';

interface SubscriptionCardProps {
  subscription: Subscription;
  isSelected?: boolean;
  onSelect: () => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  isSelected = false,
  onSelect,
}) => {
  const handlePress = async () => {
    await haptics.medium();
    onSelect();
  };

  const isPremium = subscription.tier === 'premium' || subscription.tier === 'elite';

  const getTierIcon = () => {
    switch (subscription.tier) {
      case 'elite':
        return 'diamond';
      case 'premium':
        return 'star';
      case 'plus':
        return 'add-circle';
      default:
        return 'person';
    }
  };

  const getTierColor = () => {
    switch (subscription.tier) {
      case 'elite':
        return colors.primary.gold;
      case 'premium':
        return colors.verification.trusted;
      case 'plus':
        return colors.primary.blue;
      default:
        return colors.text.secondary;
    }
  };

  const formatPrice = () => {
    if (subscription.price === 0) return 'Free';
    const monthly = subscription.billingPeriod === 'yearly'
      ? subscription.price / 12
      : subscription.price;
    return `$${monthly.toFixed(0)}`;
  };

  const eliteColors = ['rgba(255, 215, 0, 0.1)', 'rgba(255, 215, 0, 0.05)'] as const;
  const premiumColors = ['rgba(167, 139, 250, 0.1)', 'rgba(167, 139, 250, 0.05)'] as const;
  const gradientColors = subscription.tier === 'elite' ? eliteColors : premiumColors;

  const cardContent = (
    <>
      {subscription.isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>MOST POPULAR</Text>
        </View>
      )}

      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${getTierColor()}20` }]}>
          <Ionicons name={getTierIcon()} size={24} color={getTierColor()} />
        </View>

        <View style={styles.tierInfo}>
          <Text style={[styles.tierName, { color: getTierColor() }]}>
            {subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}
          </Text>
          <Text style={styles.billingPeriod}>
            {subscription.billingPeriod === 'yearly' ? 'per year' : 'per month'}
          </Text>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.price}>{formatPrice()}</Text>
          {subscription.price > 0 && (
            <Text style={styles.priceUnit}>/mo</Text>
          )}
        </View>
      </View>

      <View style={styles.features}>
        {subscription.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons
              name={feature.included ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={feature.included ? colors.status.success : colors.text.tertiary}
            />
            <Text
              style={[
                styles.featureText,
                !feature.included && styles.featureDisabled,
              ]}
            >
              {feature.name}
            </Text>
          </View>
        ))}
      </View>

      {isSelected && (
        <View style={styles.selectedIndicator}>
          <Ionicons name="checkmark-circle" size={24} color={colors.primary.blue} />
        </View>
      )}
    </>
  );

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={[
        styles.container,
        isSelected && styles.selectedContainer,
        isPremium && styles.premiumContainer,
        subscription.tier === 'elite' && styles.eliteContainer,
      ]}
    >
      {isPremium ? (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.content}
        >
          {cardContent}
        </LinearGradient>
      ) : (
        <View style={styles.content}>
          {cardContent}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.radius.xl,
    borderWidth: 2,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },
  selectedContainer: {
    borderColor: colors.primary.blue,
  },
  premiumContainer: {
    borderColor: colors.verification.trusted,
  },
  eliteContainer: {
    borderColor: colors.primary.gold,
  },
  content: {
    padding: spacing.lg,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.primary.blue,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomLeftRadius: spacing.radius.md,
  },
  popularText: {
    ...typography.presets.label,
    color: colors.text.primary,
    fontSize: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  tierName: {
    ...typography.presets.h3,
  },
  billingPeriod: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    ...typography.presets.h1,
    color: colors.text.primary,
  },
  priceUnit: {
    ...typography.presets.body,
    color: colors.text.tertiary,
    marginLeft: 2,
  },
  features: {
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  featureDisabled: {
    color: colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  selectedIndicator: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
});
