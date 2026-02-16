import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Subscription } from '../types';
import { haptics } from '../utils/haptics';

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
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  const isProPlan = subscription.tier === 'pro';
  const isYearly = subscription.billingPeriod === 'yearly';
  const billingLabel = isYearly ? 'year' : 'month';
  const planLabel = isProPlan
    ? (isYearly ? 'Pro Yearly' : 'Pro Monthly')
    : 'Free';
  const priceLabel = isProPlan ? `$${subscription.price}/${billingLabel}` : '$0/month';

  const handlePress = async () => {
    await haptics.medium();
    onSelect();
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && styles.selectedContainer,
        isProPlan && styles.proContainer,
      ]}
      activeOpacity={0.85}
      onPress={handlePress}
    >
        <View style={styles.header}>
        <View style={[styles.iconWrap, isProPlan && styles.iconWrapPro]}>
          <Ionicons
            name={isProPlan ? 'sparkles' : 'person-outline'}
            size={18}
            color={isProPlan ? colors.accent.primary : colors.text.secondary}
          />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.tierLabel}>
            {planLabel}
          </Text>
          <Text style={styles.tierSubLabel}>
            {priceLabel}
          </Text>
        </View>

        {isSelected ? (
          <Ionicons name="checkmark-circle" size={22} color={colors.accent.primary} />
        ) : null}
      </View>

      <View style={styles.features}>
        {subscription.features.map((feature) => (
          <View key={feature.name} style={styles.featureRow}>
            <Ionicons
              name={feature.included ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={feature.included ? colors.status.success : colors.text.tertiary}
            />
            <Text style={[styles.featureText, !feature.included && styles.featureTextDisabled]}>
              {feature.name}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.surface.level1,
    padding: spacing.md,
    gap: spacing.md,
  },
  selectedContainer: {
    borderColor: colors.accent.primary,
  },
  proContainer: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: spacing.radius.sm,
    backgroundColor: colors.surface.level1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapPro: {
    backgroundColor: colors.accent.soft,
  },
  headerText: {
    flex: 1,
  },
  tierLabel: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  tierSubLabel: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  features: {
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  featureText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  featureTextDisabled: {
    color: colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
});
