import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Header,
  InlineBanner,
  PillTabs,
  ScreenScaffold,
  SectionHeader,
  SubscriptionCard,
} from '../components';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootStackParamList, Subscription, SubscriptionTier } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Subscription tiers for the "Find New Friends" feature
 * NOTE: Wingman booking is FREE for all users (10% platform fee)
 * Subscriptions are ONLY for the Friends feature
 */
const subscriptions: Subscription[] = [
  {
    id: 'free',
    tier: 'free',
    price: 0,
    billingPeriod: 'monthly',
    features: [
      { name: 'Unlimited wingman bookings', description: '', included: true },
      { name: 'Browse Friends profiles', description: '', included: true },
      { name: 'Basic messaging', description: '', included: true },
      { name: 'Friend matching', description: '', included: false },
      { name: 'Join groups', description: '', included: false },
      { name: 'Create events', description: '', included: false },
    ],
  },
  {
    id: 'plus',
    tier: 'plus',
    price: 14.99,
    billingPeriod: 'monthly',
    features: [
      { name: 'Unlimited wingman bookings', description: '', included: true },
      { name: '5 friend matches/month', description: '', included: true },
      { name: 'Join up to 3 groups', description: '', included: true },
      { name: 'View social feed', description: '', included: true },
      { name: 'Post to feed', description: '', included: false },
      { name: 'Create events', description: '', included: false },
    ],
    isPopular: true,
  },
  {
    id: 'premium',
    tier: 'premium',
    price: 29.99,
    billingPeriod: 'monthly',
    features: [
      { name: 'Unlimited wingman bookings', description: '', included: true },
      { name: 'Unlimited friend matches', description: '', included: true },
      { name: 'Unlimited groups', description: '', included: true },
      { name: 'Post to feed', description: '', included: true },
      { name: 'Priority support', description: '', included: true },
      { name: 'Create events', description: '', included: false },
    ],
  },
  {
    id: 'elite',
    tier: 'elite',
    price: 99.99,
    billingPeriod: 'monthly',
    features: [
      { name: 'Everything in Premium', description: '', included: true },
      { name: 'Create and host events', description: '', included: true },
      { name: 'Priority matching', description: '', included: true },
      { name: 'VIP badge on profile', description: '', included: true },
      { name: 'Concierge service', description: '', included: true },
      { name: 'Personal account manager', description: '', included: true },
    ],
  },
];

const friendMatchingBenefits = [
  {
    icon: 'heart-outline',
    title: 'Genuine Connections',
    description: 'Meet like-minded people who want friendship, not dating',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Safe & Verified',
    description: 'All members are ID-verified for your safety',
  },
  {
    icon: 'people-outline',
    title: 'Group Activities',
    description: 'Join group outings and events in your area',
  },
  {
    icon: 'infinite-outline',
    title: 'No Pressure',
    description: 'Take your time to find friends at your own pace',
  },
];

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors, spacing } = tokens;

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('plus');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleSubscribe = async () => {
    await haptics.success();
    // Handle subscription flow
  };

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    await haptics.selection();
    setSelectedTier(tier);
  };

  const plans = useMemo(() => (
    subscriptions.map((subscription) => ({
      ...subscription,
      price: billingPeriod === 'yearly'
        ? subscription.price * 12 * 0.8
        : subscription.price,
      billingPeriod,
    }))
  ), [billingPeriod]);

  const billingItems = [
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
  ];

  return (
    <View style={styles.container}>
      <ScreenScaffold
        scrollable
        contentContainerStyle={styles.contentContainer}
        withBottomPadding={false}
      >
        <Header
          title="Subscription"
          showBack
          onBackPress={handleBackPress}
          transparent
        />

        <LinearGradient
          colors={colors.gradients.premium}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Ionicons name="sparkles" size={30} color={colors.primary.darkBlack} />
          <Text style={styles.heroTitle}>Upgrade Your Friends Experience</Text>
          <Text style={styles.heroSubtitle}>
            Wingman bookings stay free. Subscription unlocks advanced friends features.
          </Text>
        </LinearGradient>

        <InlineBanner
          title="All users are ID and photo verified before bookings"
          message="Subscriptions only affect Friends features, not core booking access."
          variant="info"
        />

        <View style={styles.section}>
          <SectionHeader
            title="Billing"
            subtitle="Choose monthly or yearly pricing"
          />
          <PillTabs
            items={billingItems}
            activeId={billingPeriod}
            onChange={(value) => {
              void haptics.selection();
              setBillingPeriod(value as 'monthly' | 'yearly');
            }}
          />
          {billingPeriod === 'yearly' ? (
            <View style={styles.savingsBadge}>
              <Ionicons name="pricetag" size={14} color={colors.status.success} />
              <Text style={styles.savingsText}>Yearly billing saves 20%</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Plans"
            subtitle="Select the tier that fits your usage"
          />
          <View style={styles.planList}>
            {plans.map((subscription) => (
              <SubscriptionCard
                key={subscription.id}
                subscription={subscription}
                isSelected={selectedTier === subscription.tier}
                onSelect={() => handleSelectPlan(subscription.tier)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="What You Unlock"
            subtitle="Designed for real friend discovery and safer social activity"
          />
          <View style={styles.benefitsGrid}>
            {friendMatchingBenefits.map((benefit) => (
              <View key={benefit.title} style={styles.benefitCard}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={benefit.icon as any} size={18} color={colors.accent.primary} />
                </View>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDescription}>{benefit.description}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.termsTap} onPress={() => haptics.light()}>
          <Ionicons name="document-text-outline" size={16} color={colors.text.tertiary} />
          <Text style={styles.termsText}>
            By subscribing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </TouchableOpacity>
      </ScreenScaffold>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title={selectedTier === 'free'
            ? 'Continue with Free'
            : `Subscribe to ${selectedTier.charAt(0).toUpperCase()}${selectedTier.slice(1)}`}
          onPress={handleSubscribe}
          variant={selectedTier === 'free' ? 'secondary' : selectedTier === 'elite' ? 'gold' : 'primary'}
          size="large"
          fullWidth
        />
      </View>
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  contentContainer: {
    gap: spacing.lg,
    paddingBottom: spacing.massive,
  },
  hero: {
    borderRadius: spacing.radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  heroTitle: {
    ...typography.presets.h2,
    color: colors.primary.darkBlack,
  },
  heroSubtitle: {
    ...typography.presets.body,
    color: colors.primary.darkBlack,
    opacity: 0.86,
    lineHeight: 22,
  },
  section: {
    gap: spacing.sm,
  },
  savingsBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.status.successLight,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  savingsText: {
    ...typography.presets.caption,
    color: colors.status.success,
    fontWeight: typography.weights.medium,
  },
  planList: {
    gap: spacing.md,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  benefitCard: {
    width: '48%',
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.surface.level1,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 140,
  },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: spacing.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.blueSoft,
    marginBottom: spacing.xs,
  },
  benefitTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  benefitDescription: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  termsTap: {
    marginBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  termsText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    lineHeight: 18,
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.screenPadding,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.surface.level1,
  },
});
