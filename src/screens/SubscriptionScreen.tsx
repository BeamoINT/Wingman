import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Button, SubscriptionCard } from '../components';
import type { RootStackParamList, Subscription, SubscriptionTier } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Subscription tiers for the "Find New Friends" feature
 * NOTE: Companion booking is FREE for all users (10% platform fee)
 * Subscriptions are ONLY for the Friends feature
 */
const subscriptions: Subscription[] = [
  {
    id: 'free',
    tier: 'free',
    price: 0,
    billingPeriod: 'monthly',
    features: [
      { name: 'Unlimited companion bookings', description: '', included: true },
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
      { name: 'Unlimited companion bookings', description: '', included: true },
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
      { name: 'Unlimited companion bookings', description: '', included: true },
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
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('plus');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleSubscribe = async () => {
    await haptics.success();
    // Handle subscription
  };

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    await haptics.selection();
    setSelectedTier(tier);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={colors.gradients.premium}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Ionicons name="star" size={40} color={colors.primary.darkBlack} />
          <Text style={styles.heroTitle}>Upgrade Your Experience</Text>
          <Text style={styles.heroSubtitle}>
            Unlock the Find New Friends feature and start making real connections
          </Text>
        </LinearGradient>

        {/* Billing Toggle */}
        <View style={styles.billingToggle}>
          <TouchableOpacity
            style={[styles.toggleOption, billingPeriod === 'monthly' && styles.toggleActive]}
            onPress={() => {
              haptics.selection();
              setBillingPeriod('monthly');
            }}
          >
            <Text style={[
              styles.toggleText,
              billingPeriod === 'monthly' && styles.toggleTextActive,
            ]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleOption, billingPeriod === 'yearly' && styles.toggleActive]}
            onPress={() => {
              haptics.selection();
              setBillingPeriod('yearly');
            }}
          >
            <Text style={[
              styles.toggleText,
              billingPeriod === 'yearly' && styles.toggleTextActive,
            ]}>
              Yearly
            </Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveText}>Save 20%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Subscription Plans */}
        <View style={styles.plansSection}>
          {subscriptions.map((subscription) => (
            <SubscriptionCard
              key={subscription.id}
              subscription={{
                ...subscription,
                price: billingPeriod === 'yearly'
                  ? subscription.price * 12 * 0.8
                  : subscription.price,
                billingPeriod,
              }}
              isSelected={selectedTier === subscription.tier}
              onSelect={() => handleSelectPlan(subscription.tier)}
            />
          ))}
        </View>

        {/* Friend Matching Section */}
        <View style={styles.friendSection}>
          <Text style={styles.sectionTitle}>Meet New Friends</Text>
          <Text style={styles.sectionSubtitle}>
            Our subscription includes friend matching - connect with people who share your interests
          </Text>

          <View style={styles.benefitsGrid}>
            {friendMatchingBenefits.map((benefit, index) => (
              <View key={index} style={styles.benefitCard}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={benefit.icon as any} size={24} color={colors.primary.blue} />
                </View>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDescription}>{benefit.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Safety Guarantee */}
        <View style={styles.guaranteeSection}>
          <Ionicons name="shield-checkmark" size={24} color={colors.status.success} />
          <View style={styles.guaranteeText}>
            <Text style={styles.guaranteeTitle}>Safe & Secure</Text>
            <Text style={styles.guaranteeDescription}>
              All members are ID-verified. Cancel your subscription anytime.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <LinearGradient
        colors={['transparent', colors.background.primary]}
        style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <Button
          title={selectedTier === 'free' ? 'Continue with Free' : `Subscribe to ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}`}
          onPress={handleSubscribe}
          variant={selectedTier === 'free' ? 'secondary' : selectedTier === 'elite' ? 'gold' : 'primary'}
          size="large"
          fullWidth
        />
        <Text style={styles.termsText}>
          By subscribing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  hero: {
    margin: spacing.screenPadding,
    padding: spacing.xxl,
    borderRadius: spacing.radius.xl,
    alignItems: 'center',
  },
  heroTitle: {
    ...typography.presets.h2,
    color: colors.primary.darkBlack,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  heroSubtitle: {
    ...typography.presets.body,
    color: colors.primary.darkBlack,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    padding: 4,
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.xl,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: spacing.radius.md,
    gap: spacing.sm,
  },
  toggleActive: {
    backgroundColor: colors.background.card,
  },
  toggleText: {
    ...typography.presets.button,
    color: colors.text.tertiary,
  },
  toggleTextActive: {
    color: colors.text.primary,
  },
  saveBadge: {
    backgroundColor: colors.status.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.radius.sm,
  },
  saveText: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  plansSection: {
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.md,
  },
  friendSection: {
    padding: spacing.screenPadding,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.presets.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  benefitCard: {
    width: '47%',
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    padding: spacing.lg,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  benefitTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  benefitDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
  guaranteeSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.status.successLight,
    margin: spacing.screenPadding,
    padding: spacing.lg,
    borderRadius: spacing.radius.lg,
    gap: spacing.md,
  },
  guaranteeText: {
    flex: 1,
  },
  guaranteeTitle: {
    ...typography.presets.h4,
    color: colors.status.success,
    marginBottom: spacing.xs,
  },
  guaranteeDescription: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
  },
  termsText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
